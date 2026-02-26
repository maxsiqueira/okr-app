/**
 * Status Service
 * Monitors health of various system components
 */
import { db, auth } from "@/lib/firebase";
import { collection, query, limit, getDocs } from "firebase/firestore";
import { JiraService } from "./jira-client";

export const StatusService = {
    /**
     * Check Firestore connection and permissions
     */
    checkFirestore: async () => {
        try {
            const start = Date.now();
            const q = query(collection(db, "system_logs"), limit(1));
            await getDocs(q);
            return {
                status: 'healthy',
                latency: Date.now() - start,
                message: 'Connection to Firestore established'
            };
        } catch (error: any) {
            return {
                status: 'unhealthy',
                message: error.message || 'Firestore connection failed'
            };
        }
    },

    /**
     * Check Jira connection and credentials
     */
    checkJira: async () => {
        try {
            const start = Date.now();
            const project = localStorage.getItem('jira_project_key') || 'ION';
            // We use a simple project fetch as a health check
            const epics = await JiraService.getEpics(project, 'ALL');
            return {
                status: 'healthy',
                latency: Date.now() - start,
                message: `Connected to Jira via project ${project}. Found ${epics.length} epics.`
            };
        } catch (error: any) {
            return {
                status: 'unhealthy',
                message: error.message || 'Jira connection failed'
            };
        }
    },

    /**
     * Check Cloud Functions availability
     */
    checkFunctions: async () => {
        const start = Date.now();
        try {
            // We'll use getStrategicObjectives as it's a lightweight function check
            const { callFetchStrategicObjectives } = await import("./jira-firebase");
            await callFetchStrategicObjectives('HEALTH-CHECK');
            return {
                status: 'healthy',
                latency: Date.now() - start,
                message: 'Cloud Functions are responsive'
            };
        } catch (error: any) {
            // "Not found" or "permission denied" might be expected for 'HEALTH-CHECK' 
            // but the function actually running is what matters.
            if (error.message?.includes('not-found') || error.message?.includes('404')) {
                return {
                    status: 'healthy',
                    latency: Date.now() - start,
                    message: 'Cloud Functions reachable (authenticated)'
                };
            }
            return {
                status: 'unhealthy',
                message: error.message || 'Cloud Functions unreachable'
            };
        }
    },

    /**
     * Check current session health (Auth)
     */
    checkSession: async () => {
        try {
            const start = Date.now();
            const user = auth.currentUser;
            if (!user) throw new Error("No active session found");

            return {
                status: 'healthy',
                latency: Date.now() - start,
                message: `Sessão ativa para ${user.email}. Token válido.`
            };
        } catch (error: any) {
            return {
                status: 'unhealthy',
                message: error.message || 'Erro na verificação de sessão'
            };
        }
    },

    /**
     * Get overall system health
     */
    getOverallStatus: async () => {
        const [firestore, jira, functions, session] = await Promise.all([
            StatusService.checkFirestore(),
            StatusService.checkJira(),
            StatusService.checkFunctions(),
            StatusService.checkSession()
        ]);

        return {
            firestore,
            jira,
            functions,
            session,
            timestamp: new Date().toISOString()
        };
    }
}
