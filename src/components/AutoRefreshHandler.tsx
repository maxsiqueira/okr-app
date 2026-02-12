import { useEffect } from "react";

export function AutoRefreshHandler() {
    useEffect(() => {
        const checkAndSchedule = () => {
            const intervalValue = localStorage.getItem("ion_auto_refresh_minutes");
            if (!intervalValue) return null;

            const minutes = parseInt(intervalValue, 10);
            if (isNaN(minutes) || minutes <= 0) return null;

            console.log(`[AutoRefresh] Active: refreshing every ${minutes} minutes.`);

            const ms = minutes * 60 * 1000;
            const timer = setInterval(() => {
                console.log("[AutoRefresh] Triggering reload...");
                window.location.reload();
            }, ms);

            return timer;
        };

        const timer = checkAndSchedule();

        return () => {
            if (timer) clearInterval(timer);
        };
    }, []);

    return null;
}
