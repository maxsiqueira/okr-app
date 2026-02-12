import { useState, useEffect } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";

export interface GlobalConfig {
    logoUrl: string;
    refreshInterval: number;
}

export function useGlobalConfig() {
    const [config, setConfig] = useState<GlobalConfig>({
        logoUrl: "",
        refreshInterval: 0
    });

    useEffect(() => {
        try {
            const unsub = onSnapshot(doc(db, "config", "ui"), (docSnapshot) => {
                if (docSnapshot.exists()) {
                    const data = docSnapshot.data();
                    setConfig({
                        logoUrl: data.logoUrl || "",
                        // Ensure it's a number
                        refreshInterval: Number(data.refreshInterval) || 0
                    });
                }
            });
            return () => unsub();
        } catch (err) {
            console.error("Error subscribing to global config:", err);
            // Default config empty
            return () => { };
        }
    }, []);

    return config;
}
