/**
 * Firebase Functions Helper for Jira Service
 * 
 * This module provides helper functions to call Firebase Cloud Functions
 * for Jira data fetching, replacing the failed /api/proxy approach.
 */

import { getFunctions, httpsCallable } from 'firebase/functions'
import { app } from '@/lib/firebase'

const functions = getFunctions(app)

/**
 * Call Firebase callable function: fetchEpicData
 * 
 * @param epicKey - Jira epic key (e.g., "ION-123")
 * @param forceRefresh - Skip Firestore cache
 * @returns Epic data with children
 */
export const callFetchEpicData = async (
    epicKey: string,
    forceRefresh = false
): Promise<{ status: string, epic: any, children: any[], message?: string, syncStats?: any }> => {
    if (!epicKey) {
        console.error(`[Firebase] callFetchEpicData aborted: Missing epicKey`);
        throw new Error('epicKey is required');
    }

    console.log(`[Firebase] Calling fetchEpicData for ${epicKey}`)

    const fetchEpicDataFn = httpsCallable(functions, 'fetchEpicData')

    try {
        const result = await fetchEpicDataFn({ epicKey, forceRefresh }) as any

        if (result.data) {
            console.log(`[Firebase] fetchEpicData success for ${epicKey}`)
            return result.data
        } else {
            console.error(`[Firebase] fetchEpicData returned empty data for ${epicKey}`, result)
            throw new Error('Empty response from Firebase Function')
        }
    } catch (error: any) {
        console.error(`[Firebase] fetchEpicData error for ${epicKey}:`, error)

        // Parse Firebase function errors
        if (error.code === 'unauthenticated') {
            throw new Error('Not authenticated. Please login.')
        } else if (error.code === 'failed-precondition') {
            throw new Error('Jira not configured. Admin must configure Jira in Settings.')
        } else if (error.code === 'not-found') {
            throw new Error(`Epic ${epicKey} not found in Jira`)
        } else {
            throw new Error(error.message || 'Failed to fetch epic data')
        }
    }
}

/**
 * Call Firebase callable function for multiple epics
 * Used for Extra Epics analysis
 * 
 * @param epicKeys - Array of epic keys
 * @param forceRefresh - Skip cache
 * @returns Array of epics with progress calculated
 */
export const callFetchMultipleEpics = async (
    epicKeys: string[],
    forceRefresh = false
): Promise<any[]> => {
    // Filter invalid keys
    if (!Array.isArray(epicKeys)) {
        console.error('[Firebase] epicKeys is not an array:', epicKeys);
        return [];
    }
    const validKeys = epicKeys.filter(k => k && typeof k === 'string' && k.trim().length > 0);

    console.log(`[Firebase] Fetching ${validKeys.length} epics via Firebase Function (filtered from ${epicKeys.length})`)

    if (validKeys.length === 0) {
        console.warn('[Firebase] No valid epic keys to fetch');
        return [];
    }

    try {
        // Call fetchEpicData for each epic (throttled in batches)
        // EMERGNCY FIX: Reduced to 1 to strictly avoid rate limits (Step 1012)
        const CHUNK_SIZE = 1;
        const results: PromiseSettledResult<any>[] = [];

        for (let i = 0; i < validKeys.length; i += CHUNK_SIZE) {
            const chunk = validKeys.slice(i, i + CHUNK_SIZE);
            console.log(`[Firebase] Fetching batch ${Math.floor(i / CHUNK_SIZE) + 1}/${Math.ceil(validKeys.length / CHUNK_SIZE)} (${chunk.length} epics)...`);

            const promises = chunk.map(key => callFetchEpicData(key, forceRefresh));
            const chunkResults = await Promise.allSettled(promises);
            results.push(...chunkResults);

            // Add delay between batches to respect rate limits
            if (i + CHUNK_SIZE < validKeys.length) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }

        // Extract successful results
        const epics = results
            .filter(r => r.status === 'fulfilled')
            .filter(r => r.status === 'fulfilled')
            .map(r => {
                const val = (r as PromiseFulfilledResult<any>).value;
                const epic = val.epic;
                const children = val.children || [];

                // 1. Calculate progress based on issue type
                let progress = 0;
                const issuetype = (epic.fields?.issuetype?.name || "").toLowerCase();
                const isEpic = issuetype.includes('epic');

                const majorIssues = children.filter((child: any) => {
                    if (isEpic) {
                        // For Epics: count Stories/Tasks/Bugs (non-subtasks)
                        return !child.fields?.issuetype?.subtask;
                    } else {
                        // For Stories/Tasks: count their subtasks
                        return child.fields?.issuetype?.subtask;
                    }
                });

                const totalCount = majorIssues.length;
                const doneCount = majorIssues.filter((child: any) =>
                    child.fields?.status?.statusCategory?.key === 'done'
                ).length;

                if (totalCount > 0) {
                    progress = Math.round((doneCount / totalCount) * 100);
                } else {
                    // Fallback: use issue's own status category (100% if done, else 0%)
                    progress = (epic.fields?.status?.statusCategory?.key === 'done') ? 100 : 0;
                }

                // 2. Calculate Total Spent Hours
                // Sum issue's own time + children's aggregate time
                let totalSpentSeconds = epic.fields?.aggregatetimespent || epic.fields?.timespent || 0;

                // Ensure we capture children's effort if Epic aggregate time is missing or 0
                if (children.length > 0 && totalSpentSeconds === 0) {
                    children.forEach((child: any) => {
                        totalSpentSeconds += (child.fields?.aggregatetimespent || child.fields?.timespent || 0);
                    });
                }

                const totalHours = totalSpentSeconds / 3600;

                return {
                    ...epic,
                    progress: progress,
                    totalHours: totalHours,
                    children: children
                };
            })
            .filter(Boolean);

        // Log failures
        const failures = results.filter(r => r.status === 'rejected');
        if (failures.length > 0) {
            console.warn(`[Firebase] ${failures.length} epics failed to load`);
            // If ALL failed, throw the first error to propagate the issue (likely Auth/Network)
            if (failures.length === validKeys.length && validKeys.length > 0) {
                const firstError = (failures[0] as PromiseRejectedResult).reason;
                throw new Error(firstError.message || "Failed to load any epics. Check configuration/permissions.");
            }
        }

        console.log(`[Firebase] Successfully loaded ${epics.length}/${validKeys.length} epics`)
        return epics
    } catch (error: any) {
        console.error(`[Firebase] callFetchMultipleEpics error:`, error)
        throw error
    }
}

/**
 * Call fetchStrategicObjectives (Project Scan)
 */
export const callFetchStrategicObjectives = async (
    projectKey: string = 'ION',
    forceRefresh = false
): Promise<any[]> => {
    console.log(`[Firebase] Calling fetchStrategicObjectives for ${projectKey}`)
    const fn = httpsCallable(functions, 'fetchStrategicObjectives')
    try {
        const res = await fn({ projectKey, forceRefresh }) as any
        if (res.data && res.data.objectives) {
            console.log(`[Firebase] fetchStrategicObjectives success: ${res.data.objectives.length} epics`)
            return res.data.objectives
        }
        return []
    } catch (error: any) {
        console.error(`[Firebase] fetchStrategicObjectives failed:`, error)
        // Propagate error to let UI know
        throw new Error(error.message || "Failed to fetch project objectives")
    }
}
/**
 * Call getOkrMetrics (Executive Panel)
 */
export const callGetOkrMetrics = async (
    projectKey: string = 'ION',
    forceRefresh = false
): Promise<any> => {
    console.log(`[Firebase] Calling getOkrMetrics for ${projectKey}`)
    const fn = httpsCallable(functions, 'getOkrMetrics')
    try {
        const res = await fn({ projectKey, forceRefresh }) as any
        if (res.data) {
            console.log(`[Firebase] getOkrMetrics success`)
            return res.data
        }
        throw new Error('Empty response from getOkrMetrics')
    } catch (error: any) {
        console.error(`[Firebase] getOkrMetrics failed:`, error)
        throw new Error(error.message || "Failed to fetch OKR metrics")
    }
}

/**
 * Send email via Firebase Function
 */
export const callSendEmail = async (data: { to: string, subject: string, html: string }): Promise<any> => {
    console.log(`[Firebase] Calling sendEmail to ${data.to}`)
    const fn = httpsCallable(functions, 'sendEmail')
    try {
        const res = await fn(data) as any
        return res.data
    } catch (error: any) {
        console.error(`[Firebase] sendEmail failed:`, error)
        throw new Error(error.message || "Failed to send email")
    }
}
