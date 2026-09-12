import { useState, useEffect, useCallback } from "react";
import { syncEngine } from "../lib/syncEngine";
import { getPendingSyncQueue, getResilienceStats } from "../lib/offlineDb";

/**
 * useOfflineSync
 * React Hook that monitors online status, pending synchronization items in IndexedDB,
 * and enables manual or reactive sync triggering.
 */
export function useOfflineSync({ apiBaseUrl } = {}) {
  const [isOnline, setIsOnline] = useState(() => (typeof navigator !== "undefined" ? navigator.onLine : true));
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [lastSyncTime, setLastSyncTime] = useState(null);
  const [stats, setStats] = useState({});

  const refreshCounts = useCallback(async () => {
    try {
      const pending = await getPendingSyncQueue();
      setPendingCount(pending.length);
      const resStats = await getResilienceStats();
      setStats(resStats);
    } catch {
      // Ignore initial IDB open delays
    }
  }, []);

  useEffect(() => {
    if (apiBaseUrl) {
      syncEngine.setApiBaseUrl(apiBaseUrl);
    }

    refreshCounts();

    const unsubscribe = syncEngine.subscribe((event) => {
      if (event.type === "network_change") {
        setIsOnline(event.isOnline);
      } else if (event.type === "sync_start") {
        setIsSyncing(true);
      } else if (event.type === "sync_complete") {
        setIsSyncing(false);
        setLastSyncTime(Date.now());
        refreshCounts();
      } else if (event.type === "sync_error") {
        setIsSyncing(false);
        refreshCounts();
      }
    });

    // Check counts periodically every 10 seconds
    const interval = setInterval(refreshCounts, 10000);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, [apiBaseUrl, refreshCounts]);

  const triggerManualSync = useCallback(async () => {
    await syncEngine.drainQueue();
  }, []);

  return {
    isOnline,
    isSyncing,
    pendingCount,
    lastSyncTime,
    stats,
    triggerManualSync,
    refreshCounts,
  };
}
