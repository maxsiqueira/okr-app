import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { AppUser } from '../types/user';

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

    const fetchUserData = async (firebaseUser: User) => {
        try {
            const userDocRef = doc(db, 'users', firebaseUser.uid);
            const userDoc = await getDoc(userDocRef);

            if (userDoc.exists()) {
                const userData = userDoc.data();
                setUser({
                    uid: firebaseUser.uid,
                    email: firebaseUser.email,
                    displayName: userData.displayName || firebaseUser.displayName,
                    role: userData.role || 'user',
                    allowedPanels: userData.allowedPanels || [],
                    isBlocked: userData.isBlocked || false,
                    createdAt: userData.createdAt,
                });

                // SE BLOQUEADO, DESLOGA IMEDIATAMENTE
                if (userData.isBlocked) {
                    await signOut(auth);
                    setUser(null);
                }
            } else {
                // Fallback para usuários sem registro no Firestore (apenas se doc não existir)
                setUser({
                    uid: firebaseUser.uid,
                    email: firebaseUser.email,
                    displayName: firebaseUser.displayName,
                    role: 'user',
                    allowedPanels: [],
                    createdAt: new Date().toISOString()
                });
            }

        } catch (err) {
            console.error("Error fetching user data:", err);
            setUser(null);
        }
    };

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            setLoading(true);
            if (firebaseUser) {
                await fetchUserData(firebaseUser);
            } else {
                setUser(null);
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const refreshUser = async () => {
        if (auth.currentUser) {
            await fetchUserData(auth.currentUser);
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
