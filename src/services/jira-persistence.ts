import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db, auth } from '@/lib/firebase'

export class JiraPersistenceService {
    // Plan said: users/{userId}/epics/{epicKey}. 
    // But 'user_settings' is the collection used in settings.ts. 
    // Let's use a root collection for users if it exists, or stick to the plan `users/{userId}/epics`.
    // Wait, looking at settings.ts, it uses `user_settings` collection where key is userId.
    // So the structure is `db.collection('user_settings').doc(userId)`.
    // We can add a subcollection `epics` to that user doc.

    /**
     * Save Epic Analysis Data (Deep Dive)
     * Path: user_settings/{userId}/epics/{epicKey}
     */
    static async saveEpicData(epicKey: string, data: { epic: any, children: any[] }): Promise<void> {
        const userId = auth.currentUser?.uid
        if (!userId) {
            console.warn('[JiraPersistence] Cannot save: User not authenticated')
            return
        }
        if (!epicKey) return

        try {
            // Reference: user_settings/{userId}/epics/{epicKey}
            const epicRef = doc(db, 'user_settings', userId, 'epics', epicKey.toUpperCase())

            // We save the raw data plus a timestamp
            await setDoc(epicRef, {
                ...data,
                lastUpdated: new Date().toISOString(),
                savedBy: userId
            })

            console.log(`[JiraPersistence] ✅ Saved epic ${epicKey} to Firestore`)
        } catch (error) {
            console.error('[JiraPersistence] ❌ Error saving epic data:', error)
            // Don't throw, we don't want to break the UI if sync fails
        }
    }

    /**
     * Load Epic Analysis Data from Cache
     */
    static async loadEpicData(epicKey: string): Promise<{ epic: any, children: any[], lastUpdated?: string } | null> {
        const userId = auth.currentUser?.uid
        if (!userId) return null
        if (!epicKey) return null

        try {
            const epicRef = doc(db, 'user_settings', userId, 'epics', epicKey.toUpperCase())
            const docSnap = await getDoc(epicRef)

            if (docSnap.exists()) {
                console.log(`[JiraPersistence] 📂 Loaded epic ${epicKey} from Firestore cache`)
                return docSnap.data() as { epic: any, children: any[], lastUpdated?: string }
            }
        } catch (error) {
            console.error('[JiraPersistence] ❌ Error loading epic data:', error)
        }
        return null
    }

    /**
     * Save Extra Epics List (Summary Data)
     * Path: user_settings/{userId}/epics_summary/extra_epics
     * Or we can store them individually if we want.
     * The prompt said "persist communication with jira and epics", implying full data.
     * extraEpicsData in EpicAnalysis is an array of simplified objects.
     */
    static async saveExtraEpicsData(data: any[]): Promise<void> {
        const userId = auth.currentUser?.uid
        if (!userId) return

        try {
            const ref = doc(db, 'user_settings', userId, 'epics_summary', 'extra_epics')
            await setDoc(ref, {
                epics: data,
                lastUpdated: new Date().toISOString()
            })
            console.log(`[JiraPersistence] ✅ Saved extra epics summary to Firestore`)
        } catch (error) {
            console.error('[JiraPersistence] ❌ Error saving extra epics:', error)
        }
    }

    /**
     * Load Extra Epics List
     */
    static async loadExtraEpicsData(): Promise<any[] | null> {
        const userId = auth.currentUser?.uid
        if (!userId) return null

        try {
            const ref = doc(db, 'user_settings', userId, 'epics_summary', 'extra_epics')
            const docSnap = await getDoc(ref)

            if (docSnap.exists()) {
                console.log(`[JiraPersistence] 📂 Loaded extra epics from Firestore`)
                return docSnap.data().epics || []
            }
        } catch (error) {
            console.error('[JiraPersistence] ❌ Error loading extra epics:', error)
        }
        return null
    }
}
