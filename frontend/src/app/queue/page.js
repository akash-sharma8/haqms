'use client';
import { useState, useEffect, useMemo } from 'react';
import Navbar from '@/components/common/Navbar';
import { useAuth } from '@/context/AuthContext';
import { Bell, Monitor, RefreshCw, AlertCircle } from 'lucide-react';

export default function QueueMonitor() {
  const [queueTokens, setQueueTokens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshCount, setRefreshCount] = useState(0);

  // `token` here is the JWT auth token — renamed from the original to avoid
  // collision with the queue token objects used throughout this component.
  const { API_BASE_URL, token: authToken } = useAuth();

  useEffect(() => {
    let isMounted = true;

    const fetchQueueData = async () => {
      try {
        // FIX 1: Added Authorization header.
        // GET /api/queue uses the `authenticate` middleware, so every request
        // without a valid Bearer token gets a 401 — the original code sent no
        // headers at all, meaning the board never loaded for any logged-in user.
        //
        // FIX 2: Pass a high limit to avoid silent pagination truncation.
        // The backend defaults to limit=10 per page. A busy clinic with 30+ tokens
        // across doctors would silently drop records beyond page 1. Since this is a
        // read-only display board that needs ALL active tokens at once, we request
        // the maximum the backend allows (100, enforced by Math.min on the server).
        // If the queue ever exceeds 100, multi-page fetching would be needed —
        // but 100 is a safe ceiling for a single clinic's daily queue.
        const res = await fetch(`${API_BASE_URL}/queue?limit=100`, {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        });

        if (!res.ok) {
          throw new Error(`Server responded with ${res.status}: Failed to retrieve active token queue.`);
        }

        // FIX 3: Removed the `data.data || data` fallback.
        // The backend always returns { success: true, data: [...], pagination: {...} }.
        // The `|| data` fallback silently accepted the entire envelope object as the
        // token array if `data.data` was ever falsy, causing the groupedTokens useMemo
        // to iterate over object keys ("success", "pagination") instead of tokens.
        const envelope = await res.json();

        if (!envelope.success) {
          throw new Error('Queue API returned a failure response.');
        }

        if (isMounted) {
          // FIX 4: Filter to only WAITING and CALLING tokens for today's date.
          // The backend GET /api/queue has no server-side date filter — it returns
          // all-time tokens. Without client-side filtering, yesterday's COMPLETED
          // and SKIPPED tokens would clutter the display board on the next day.
          const todayStart = new Date();
          todayStart.setHours(0, 0, 0, 0);

          const activeToday = (envelope.data || []).filter((t) => {
            const created = new Date(t.createdAt);
            return (
              created >= todayStart &&
              (t.status === 'WAITING' || t.status === 'CALLING')
            );
          });

          setQueueTokens(activeToday);
          setError('');
        }
      } catch (err) {
        console.error('QueueMonitor fetch error:', err);
        if (isMounted) {
          setError(err.message);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchQueueData();

    const intervalId = setInterval(() => {
      fetchQueueData();
      setRefreshCount((prev) => prev + 1);
    }, 3000);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };

    // Re-run if auth token or API base changes (e.g. after login/logout).
  }, [API_BASE_URL, authToken]);

  // Group active tokens by doctorId into { calling, waiting[] } buckets.
  // Each token from the backend includes doctor: { id, name, specialization }
  // and patient: { id, name, phoneNumber } as selected by the Prisma include.
  const groupedByDoctor = useMemo(() => {
    return queueTokens.reduce((groups, queueToken) => {
      const docId = queueToken.doctorId;

      if (!groups[docId]) {
        groups[docId] = {
          doctorName: queueToken.doctor?.name ?? 'Unknown Doctor',
          specialization: queueToken.doctor?.specialization ?? '',
          calling: null,
          waiting: [],
        };
      }

      if (queueToken.status === 'CALLING') {
        // If multiple CALLING tokens exist for the same doctor (shouldn't happen
        // in normal operation, but possible if the backend allows it), keep the
        // one with the lowest tokenNumber as the canonical "now calling" display.
        if (
          !groups[docId].calling ||
          queueToken.tokenNumber < groups[docId].calling.tokenNumber
        ) {
          groups[docId].calling = queueToken;
        }
      } else if (queueToken.status === 'WAITING') {
        groups[docId].waiting.push(queueToken);
      }

      return groups;
    }, {});
  }, [queueTokens]);

  // Sort waiting tokens by tokenNumber ascending so the queue list reads in order.
  const sortedGroups = useMemo(() => {
    return Object.entries(groupedByDoctor).map(([docId, info]) => ({
      docId,
      ...info,
      waiting: [...info.waiting].sort((a, b) => a.tokenNumber - b.tokenNumber),
    }));
  }, [groupedByDoctor]);

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto p-6 sm:p-8">

        {/* Header */}
        <div className="glass p-6 sm:p-8 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-800 mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-teal-500/10 text-teal-600 dark:text-teal-400 rounded-xl">
              <Monitor className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-slate-800 dark:text-slate-100">
                Live Public Monitor Board
              </h1>
              <p className="text-xs text-slate-400 font-semibold mt-1">
                Real-time physician calling boards. Auto-syncs every 3 seconds.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-500/15 text-teal-600 dark:text-teal-400 text-xs font-bold uppercase tracking-wide border border-teal-500/20">
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              Auto Refreshing
            </span>
            <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-400 text-xs font-mono">
              Polls: {refreshCount}
            </div>
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div className="p-4 mb-6 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 flex items-center gap-3 text-sm">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <div>
              <strong>Sync Error:</strong> {error} — Please verify that the backend API server is online.
            </div>
          </div>
        )}

        {/* Loading */}
        {loading && queueTokens.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="pulse-loader">
              <div></div>
              <div></div>
            </div>
            <p className="mt-4 text-sm font-semibold text-slate-400">Loading active token queues...</p>
          </div>

        ) : sortedGroups.length === 0 ? (
          <div className="glass p-12 text-center rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
            <Bell className="h-12 w-12 text-slate-400 mx-auto animate-bounce" />
            <h3 className="mt-4 text-lg font-bold text-slate-800 dark:text-slate-100">No Active Tokens</h3>
            <p className="mt-2 text-slate-500 dark:text-slate-400 text-sm max-w-md mx-auto">
              There are currently no patient check-ins for today. Use the receptionist portal in the Staff Dashboard to check-in patients.
            </p>
          </div>

        ) : (
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {sortedGroups.map(({ docId, doctorName, specialization, calling, waiting }) => (
              <div
                key={docId}
                className="glass rounded-2xl shadow-lg border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col h-full hover:shadow-teal-500/5 hover:border-teal-500/30 transition-all duration-300"
              >
                {/* Doctor Header */}
                <div className="bg-slate-500/5 p-5 border-b border-slate-200 dark:border-slate-800">
                  <h3 className="font-extrabold text-lg text-slate-800 dark:text-slate-100">{doctorName}</h3>
                  <p className="text-xs text-teal-600 dark:text-teal-400 font-bold uppercase tracking-wider mt-0.5">
                    {specialization}
                  </p>
                </div>

                <div className="p-6 flex-1 flex flex-col justify-between">

                  {/* Now Calling */}
                  <div className="mb-6">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2.5">
                      Now Calling
                    </h4>
                    {calling ? (
                      <div className="bg-teal-500/10 dark:bg-teal-500/5 border border-teal-500/30 p-6 rounded-2xl text-center shadow-inner">
                        <span className="block text-5xl font-black text-teal-600 dark:text-teal-400 tracking-wider animate-pulse">
                          #{calling.tokenNumber}
                        </span>
                        {/* patient is always present: Prisma include selects id/name/phoneNumber */}
                        <span className="block text-xs font-bold text-slate-400 uppercase tracking-wide mt-2">
                          Patient: {calling.patient?.name ?? '—'}
                        </span>
                      </div>
                    ) : (
                      <div className="bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800/80 p-6 rounded-2xl text-center shadow-inner">
                        <span className="block text-2xl font-extrabold text-slate-400 dark:text-slate-500 tracking-wider italic">
                          Idle
                        </span>
                        <span className="block text-xs font-medium text-slate-400 mt-2">
                          No active patients being called
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Waiting Queue */}
                  <div>
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">
                      Queue List
                      {waiting.length > 0 && (
                        <span className="ml-2 px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500 text-xxs font-extrabold">
                          {waiting.length} waiting
                        </span>
                      )}
                    </h4>
                    {waiting.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {waiting.map((qt) => (
                          <div
                            key={qt.id}
                            className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300"
                            title={`Patient: ${qt.patient?.name ?? 'Unknown'}`}
                          >
                            #{qt.tokenNumber}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400 dark:text-slate-500 italic block">
                        No upcoming patients in queue
                      </span>
                    )}
                  </div>

                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}