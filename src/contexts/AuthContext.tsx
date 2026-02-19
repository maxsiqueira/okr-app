import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { AppUser, UserRole } from '../types/user';

interface AuthContextType {
    user: AppUser | null;
    loading: boolean;
    refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    loading: true,
    refreshUser: async () => { },
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<AppUser | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let unsubscribeUserDoc: (() => void) | null = null;

        const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
            if (firebaseUser) {
                setLoading(true);

                const userDocRef = doc(db, 'users', firebaseUser.uid);

                // Real-time listener for user data changes
                unsubscribeUserDoc = onSnapshot(userDocRef, async (userDoc) => {
                    if (!userDoc.exists()) {
                        // New user - create document
                        console.log("New user detected, creating document");
                        const defaultPanels = ['strategic', 'okr', 'reports'];

                        const newUserState = {
                            uid: firebaseUser.uid,
                            email: firebaseUser.email,
                            displayName: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
                            role: 'user' as UserRole,
                            allowedPanels: defaultPanels,
                            isBlocked: false,
                            createdAt: new Date().toISOString()
                        };

                        await setDoc(userDocRef, { ...newUserState, email: firebaseUser.email });
                        setLoading(false);
                        return;
                    }

                    // Existing user - update state from Firestore
                    const userData = userDoc.data();
                    let userPanels = userData?.allowedPanels || [];

                    // Assign defaults if panels are empty (but not for admins)
                    if (userPanels.length === 0 && !userData?.isBlocked && userData?.role !== 'admin') {
                        userPanels = ['strategic', 'okr', 'reports'];
                    }

                    const appUser: AppUser = {
                        uid: firebaseUser.uid,
                        email: firebaseUser.email,
                        displayName: userData?.displayName || firebaseUser.displayName,
                        role: userData?.role || 'user',
                        allowedPanels: userPanels,
                        isBlocked: userData?.isBlocked || false,
                        createdAt: userData?.createdAt,

                        // Optional configs
                        jiraUrl: userData?.jiraUrl,
                        jiraEmail: userData?.jiraEmail,
                        jiraToken: userData?.jiraToken,
                        proxyUrl: userData?.proxyUrl,
                        okrEpics: userData?.okrEpics,
                        extraEpics: userData?.extraEpics,
                        defaultEpicKey: userData?.defaultEpicKey,
                        geminiApiKey: userData?.geminiApiKey,
                        debugMode: userData?.debugMode,
                        autoRefresh: userData?.autoRefresh,
                        customLogo: userData?.customLogo
                    };

                    console.log("[AuthContext] User data updated:", {
                        email: appUser.email,
                        role: appUser.role,
                        allowedPanels: appUser.allowedPanels
                    });

                    setUser(appUser);
                    setLoading(false);

                    // Block check - sign out if blocked
                    if (userData?.isBlocked) {
                        console.log("User is blocked, signing out");
                        await signOut(auth);
                        setUser(null);
                    }
                }, (error) => {
                    console.error("Firestore snapshot error:", error);
                    setLoading(false);
                });

            } else {
                // User logged out
                if (unsubscribeUserDoc) {
                    unsubscribeUserDoc();
                    unsubscribeUserDoc = null;
                }

                // Clear Jira cache
                Object.keys(localStorage).forEach(key => {
                    if (key.startsWith('jira_cache_')) {
                        localStorage.removeItem(key);
                    }
                });

                setUser(null);
                setLoading(false);
            }
        });

        return () => {
            unsubscribeAuth();
            if (unsubscribeUserDoc) unsubscribeUserDoc();
        };
    }, []);

    const refreshUser = async () => {
        if (auth.currentUser) {
            // The onSnapshot listener will handle updates automatically
            // But we can force a re-read if needed
            const userDocRef = doc(db, 'users', auth.currentUser.uid);
            const userDoc = await getDoc(userDocRef);
            if (userDoc.exists()) {
                console.log("Manual refresh triggered");
            }
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-slate-950">
                <div className="text-blue-400 text-xl font-bold animate-pulse">Carregando Ion Dashboard...</div>
            </div>
        );
    }

    return (
        <AuthContext.Provider value={{ user, loading, refreshUser }}>
            {children}
        </AuthContext.Provider>
    );
};
