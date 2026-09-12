/**
 * usePoliceAlert
 * ─────────────────────────────────────────────────────────────
 * Polls the police information workflow status for an active
 * emergency event. Returns the current state machine record
 * so the UI can display live progress through the stages.
 *
 * Polling interval: 3 seconds while emergency is active.
 * Backed by: GET /api/police/status/:eventId
 *
 * Offline behaviour:
 *   - If the fetch fails, returns the last known state
 *   - Shows NETWORK_UNAVAILABLE state so the UI can display
 *     the retry button
 */

import { useState, useEffect, useRef, useCallback } from "react";

const POLL_INTERVAL_MS = 3000;

// Human-readable labels for each state
export const POLICE_STATE_LABELS = {
  SOS_TRIGGERED:             "SOS Triggered",
  INFORMATION_COLLECTED:     "Information Collected",
  CONTACTS_ALERTED:          "Contacts Alerted",
  POLICE_REPORT_PREPARED:    "Police Report Prepared",
  POLICE_SUBMISSION_PENDING: "Submission Pending",
  POLICE_SUBMITTED:          "Report Submitted",
  POLICE_ACKNOWLEDGED:       "Report Acknowledged",
  POLICE_SUBMISSION_FAILED:  "Submission Failed",
  POLICE_API_UNAVAILABLE:    "Police API Unavailable",
  NETWORK_UNAVAILABLE:       "Network Unavailable",
};

// Which states are "terminal" (no more progression expected)
const TERMINAL_STATES = new Set([
  "POLICE_ACKNOWLEDGED",
  "POLICE_SUBMISSION_FAILED",
]);

// Which states indicate a failure that can be retried
export const RETRYABLE_STATES = new Set([
  "POLICE_SUBMISSION_FAILED",
  "POLICE_API_UNAVAILABLE",
  "NETWORK_UNAVAILABLE",
]);

// Progress percentage for each state (for a progress bar)
export const POLICE_STATE_PROGRESS = {
  SOS_TRIGGERED:             10,
  INFORMATION_COLLECTED:     25,
  CONTACTS_ALERTED:          40,
  POLICE_REPORT_PREPARED:    55,
  POLICE_SUBMISSION_PENDING: 70,
  POLICE_SUBMITTED:          85,
  POLICE_ACKNOWLEDGED:       100,
  POLICE_SUBMISSION_FAILED:  70,
  POLICE_API_UNAVAILABLE:    55,
  NETWORK_UNAVAILABLE:       55,
};

export function usePoliceAlert({ eventId, apiBaseUrl, enabled = true }) {
  const [policeData, setPoliceData] = useState(null);
  const [isLoading, setIsLoading]   = useState(false);
  const [isConfigured, setIsConfigured] = useState(null); // null = unknown
  const intervalRef = useRef(null);
  const lastEventIdRef = useRef(null);

  // Fetch once whether a real API is configured (affects UI labels)
  useEffect(() => {
    if (!apiBaseUrl) return;
    fetch(`${apiBaseUrl}/api/police/is-configured`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) setIsConfigured(d.configured);
      })
      .catch(() => setIsConfigured(false));
  }, [apiBaseUrl]);

  const fetchStatus = useCallback(async () => {
    if (!eventId || !apiBaseUrl) return;

    try {
      const res = await fetch(`${apiBaseUrl}/api/police/status/${eventId}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setPoliceData(data);

      // Stop polling once we reach a terminal state
      if (TERMINAL_STATES.has(data.status) && intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    } catch (err) {
      // Network down — update status to NETWORK_UNAVAILABLE but keep last data
      setPoliceData((prev) => prev
        ? { ...prev, status: "NETWORK_UNAVAILABLE" }
        : {
            eventId,
            status: "NETWORK_UNAVAILABLE",
            timeline: [],
            isDemo: true,
          }
      );
    }
  }, [eventId, apiBaseUrl]);

  const retry = useCallback(async () => {
    if (!eventId || !apiBaseUrl) return;
    try {
      await fetch(`${apiBaseUrl}/api/police/retry/${eventId}`, { method: "POST" });
      // Fetch fresh status after retry
      setTimeout(fetchStatus, 500);
    } catch {
      /* ignore */
    }
  }, [eventId, apiBaseUrl, fetchStatus]);

  // Listen for online events to automatically recover from offline/network failure
  useEffect(() => {
    const handleOnline = () => {
      console.log("[usePoliceAlert] Network back online — fetching status & retrying if needed...");
      fetchStatus();
      if (policeData && RETRYABLE_STATES.has(policeData.status)) {
        retry();
      }
    };

    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [fetchStatus, retry, policeData]);

  // Start / stop polling based on eventId and enabled flag
  useEffect(() => {
    if (!enabled || !eventId || !apiBaseUrl) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      // Reset when event changes
      if (eventId !== lastEventIdRef.current) {
        setPoliceData(null);
        lastEventIdRef.current = eventId;
      }
      return;
    }

    // New event — reset state
    if (eventId !== lastEventIdRef.current) {
      setPoliceData(null);
      lastEventIdRef.current = eventId;
      setIsLoading(true);
    }

    // Immediate first fetch
    fetchStatus().finally(() => setIsLoading(false));

    // Start polling interval
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(fetchStatus, POLL_INTERVAL_MS);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [enabled, eventId, apiBaseUrl, fetchStatus]);

  return {
    policeData,
    isLoading,
    isConfigured,  // true = real API, false = demo, null = unknown
    retry,
    status: policeData?.status || null,
    timeline: policeData?.timeline || [],
    isDemo: policeData?.isDemo ?? true,
    reportHash: policeData?.reportHash || null,
    blockchainProof: policeData?.blockchainProof || null,
    isRetryable: RETRYABLE_STATES.has(policeData?.status),
  };
}
