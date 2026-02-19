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
): Promise<{ status: string, epic: any, children: any[], message?: string }> => {
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

                // DATA FIX: Recalculate aggregatetimespent from children
                let trueTotalSeconds = 0;
                children.forEach((child: any) => {
                    // Use child's aggregate if available, else timespent
                    let childTime = child.fields.aggregatetimespent;
                    if (childTime === undefined || childTime === null) {
                        childTime = child.fields.timespent || 0;
                    }
                    trueTotalSeconds += childTime;
                });

                // If our calculated total is significantly different/valid, use it.
                // Assuming Jira's aggregation is broken (615h vs 2000h+), we prefer our sum.
                // But only if we actually found children.
                if (children.length > 0) {
                    if (!epic.fields) epic.fields = {};
                    epic.fields.aggregatetimespent = trueTotalSeconds;
                }

                return epic;
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
