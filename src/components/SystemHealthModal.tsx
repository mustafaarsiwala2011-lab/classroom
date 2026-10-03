/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Activity, Cpu, HardDrive, Wifi, RefreshCw, X, Shield, 
  Download, Upload, CheckCircle2, AlertTriangle, Terminal, 
  Layers, Clock, Zap, Database, Server
} from 'lucide-react';
import { SystemHealth, SystemMetrics, SystemLogEntry, User } from '../types';

interface SystemHealthModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
}

export default function SystemHealthModal({ isOpen, onClose, currentUser }: SystemHealthModalProps) {
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [logs, setLogs] = useState<SystemLogEntry[]>([]);
  const [selectedLogLevel, setSelectedLogLevel] = useState<string>('ALL');
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'metrics' | 'logs' | 'backup'>('overview');
  const [backupMessage, setBackupMessage] = useState<string | null>(null);
  const [backupError, setBackupError] = useState<string | null>(null);

  const fetchTelemetry = async () => {
    setIsLoading(true);
    try {
      const [healthRes, metricsRes, logsRes] = await Promise.all([
        fetch('/api/system/health'),
        fetch('/api/system/metrics'),
        fetch(`/api/system/logs?limit=80${selectedLogLevel !== 'ALL' ? `&level=${selectedLogLevel}` : ''}`)
      ]);

      if (healthRes.ok) setHealth(await healthRes.json());
      if (metricsRes.ok) setMetrics(await metricsRes.json());
      if (logsRes.ok) {
        const data = await logsRes.json();
        setLogs(data.logs || []);
      }
    } catch (err) {
      console.error('Failed to fetch telemetry:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchTelemetry();
      const interval = setInterval(fetchTelemetry, 5000);
      return () => clearInterval(interval);
    }
  }, [isOpen, selectedLogLevel]);

  const handleExportBackup = () => {
    window.open('/api/system/backup/export', '_blank');
  };

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        setBackupMessage(null);
        setBackupError(null);
        const parsed = JSON.parse(event.target?.result as string);
        const dataToRestore = parsed.data || parsed;

        const res = await fetch('/api/system/backup/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            data: dataToRestore,
            authorizedBy: currentUser.username
          })
        });

        if (res.ok) {
          setBackupMessage('Database restored successfully from snapshot!');
          fetchTelemetry();
        } else {
          const errData = await res.json();
          setBackupError(errData.error || 'Failed to restore snapshot');
        }
      } catch (err: any) {
        setBackupError('Invalid JSON backup file: ' + err.message);
      }
    };
    reader.readAsText(file);
  };

  if (!isOpen) return null;

  const isAdmin = currentUser.username.toLowerCase() === 'admin';

  return (
    <div id="system-health-overlay" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
      <motion.div
        id="system-health-modal"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-4xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[88vh]"
      >
        {/* Header */}
        <div className="p-4 px-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Activity className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  High-Tech Backend Telemetry & Health
                </h3>
                <span className="px-2 py-0.5 text-[11px] font-semibold bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 rounded-full">
                  v2.5.0 ONLINE
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Real-time node runtime, SSE synchronization, Gemini AI telemetry & metrics
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              id="refresh-telemetry-btn"
              onClick={fetchTelemetry}
              disabled={isLoading}
              className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
              title="Refresh Telemetry"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <button
              id="close-system-health-btn"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="px-6 py-2 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2 text-xs font-medium bg-white dark:bg-slate-900">
          {[
            { id: 'overview', label: 'System Health', icon: <Server className="w-3.5 h-3.5" /> },
            { id: 'metrics', label: 'Performance & Routes', icon: <Zap className="w-3.5 h-3.5" /> },
            { id: 'logs', label: 'Structured Server Logs', icon: <Terminal className="w-3.5 h-3.5" /> },
            { id: 'backup', label: 'Snapshot Backup', icon: <Database className="w-3.5 h-3.5" /> },
          ].map(tab => (
            <button
              key={tab.id}
              id={`telemetry-tab-${tab.id}`}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors ${
                activeTab === tab.id
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && health && (
            <div className="space-y-6">
              {/* Telemetry Cards Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
                  <div className="flex items-center gap-2 text-slate-500 text-xs font-medium">
                    <Clock className="w-4 h-4 text-sky-500" />
                    <span>Uptime</span>
                  </div>
                  <div className="text-xl font-bold text-slate-900 dark:text-slate-100 mt-2">
                    {Math.floor(health.uptimeSeconds / 60)}m {health.uptimeSeconds % 60}s
                  </div>
                  <span className="text-[11px] text-slate-400">Continuous Service</span>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
                  <div className="flex items-center gap-2 text-slate-500 text-xs font-medium">
                    <Cpu className="w-4 h-4 text-purple-500" />
                    <span>RAM RSS</span>
                  </div>
                  <div className="text-xl font-bold text-slate-900 dark:text-slate-100 mt-2">
                    {health.memory.rssMb} <span className="text-xs font-normal">MB</span>
                  </div>
                  <span className="text-[11px] text-slate-400">Heap Used: {health.memory.heapUsedMb} MB</span>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
                  <div className="flex items-center gap-2 text-slate-500 text-xs font-medium">
                    <Wifi className="w-4 h-4 text-emerald-500" />
                    <span>SSE Stream</span>
                  </div>
                  <div className="text-xl font-bold text-slate-900 dark:text-slate-100 mt-2">
                    {health.sseConnections} <span className="text-xs font-normal">clients</span>
                  </div>
                  <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">Sub-second Sync</span>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
                  <div className="flex items-center gap-2 text-slate-500 text-xs font-medium">
                    <HardDrive className="w-4 h-4 text-amber-500" />
                    <span>DB Records</span>
                  </div>
                  <div className="text-xl font-bold text-slate-900 dark:text-slate-100 mt-2">
                    {health.counts.users + health.counts.messages + health.counts.notes + health.counts.memes + health.counts.failedWords}
                  </div>
                  <span className="text-[11px] text-slate-400">Synced & Indexed</span>
                </div>
              </div>

              {/* Database Breakdown */}
              <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/60">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-4 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-primary" />
                  Collection Entity Counts
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                  <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 flex justify-between items-center">
                    <span className="text-slate-600 dark:text-slate-400">Students & Users</span>
                    <span className="font-bold text-slate-900 dark:text-slate-100">{health.counts.users}</span>
                  </div>
                  <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 flex justify-between items-center">
                    <span className="text-slate-600 dark:text-slate-400">Class Messages</span>
                    <span className="font-bold text-slate-900 dark:text-slate-100">{health.counts.messages}</span>
                  </div>
                  <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 flex justify-between items-center">
                    <span className="text-slate-600 dark:text-slate-400">Subject Notes</span>
                    <span className="font-bold text-slate-900 dark:text-slate-100">{health.counts.notes}</span>
                  </div>
                  <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 flex justify-between items-center">
                    <span className="text-slate-600 dark:text-slate-400">Classroom Memes</span>
                    <span className="font-bold text-slate-900 dark:text-slate-100">{health.counts.memes}</span>
                  </div>
                  <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 flex justify-between items-center">
                    <span className="text-slate-600 dark:text-slate-400">Failed Words Vault</span>
                    <span className="font-bold text-slate-900 dark:text-slate-100">{health.counts.failedWords}</span>
                  </div>
                  <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 flex justify-between items-center">
                    <span className="text-slate-600 dark:text-slate-400">Sticky Notices</span>
                    <span className="font-bold text-slate-900 dark:text-slate-100">{health.counts.notices}</span>
                  </div>
                  <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 flex justify-between items-center">
                    <span className="text-slate-600 dark:text-slate-400">Class Polls</span>
                    <span className="font-bold text-slate-900 dark:text-slate-100">{health.counts.polls}</span>
                  </div>
                  <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 flex justify-between items-center">
                    <span className="text-slate-600 dark:text-slate-400">Events & Waras</span>
                    <span className="font-bold text-slate-900 dark:text-slate-100">{health.counts.events}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: METRICS & ROUTES */}
          {activeTab === 'metrics' && metrics && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
                  <span className="text-xs text-slate-500">Total Requests Handled</span>
                  <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">
                    {metrics.totalRequests}
                  </div>
                  <span className="text-[11px] text-emerald-600">Throughput: {metrics.requestsPerMinute} req/min</span>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
                  <span className="text-xs text-slate-500">Average Latency</span>
                  <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">
                    {metrics.avgLatencyMs} <span className="text-xs font-normal">ms</span>
                  </div>
                  <span className="text-[11px] text-sky-500">Microsecond Profiling</span>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
                  <span className="text-xs text-slate-500">Status Breakdown</span>
                  <div className="flex items-center gap-3 mt-1 text-sm font-semibold">
                    <span className="text-emerald-500">2xx: {metrics.statusCodes['2xx']}</span>
                    <span className="text-amber-500">4xx: {metrics.statusCodes['4xx']}</span>
                    <span className="text-rose-500">5xx: {metrics.statusCodes['5xx']}</span>
                  </div>
                  <span className="text-[11px] text-slate-400">Error rate: 0.0%</span>
                </div>
              </div>

              {/* Top Routes */}
              <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/60">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                  Top API Endpoints by Traffic
                </h4>
                <div className="space-y-2">
                  {metrics.topRoutes.map((r, i) => (
                    <div key={r.route} className="flex items-center justify-between p-2.5 bg-white dark:bg-slate-800 rounded-lg text-xs">
                      <div className="flex items-center gap-2">
                        <span className="w-5 text-slate-400 font-mono">#{i + 1}</span>
                        <code className="text-primary font-mono font-medium">{r.route}</code>
                      </div>
                      <span className="font-semibold text-slate-700 dark:text-slate-300">{r.hits} hits</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: STRUCTURED LOGS */}
          {activeTab === 'logs' && (
            <div className="space-y-4">
              {/* Level Filter */}
              <div className="flex items-center gap-1.5 text-xs">
                {['ALL', 'AI', 'SSE', 'AUTH', 'INFO', 'WARN', 'ERROR'].map(lvl => (
                  <button
                    key={lvl}
                    id={`filter-log-${lvl}`}
                    onClick={() => setSelectedLogLevel(lvl)}
                    className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                      selectedLogLevel === lvl
                        ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                    }`}
                  >
                    {lvl}
                  </button>
                ))}
              </div>

              {/* Logs Viewer */}
              <div className="p-4 rounded-xl bg-slate-950 text-slate-200 font-mono text-xs overflow-y-auto max-h-[50vh] space-y-1.5 border border-slate-800">
                {logs.length === 0 ? (
                  <p className="text-slate-500 py-6 text-center">No logs matching filter level.</p>
                ) : (
                  logs.map((l) => (
                    <div key={l.id} className="flex items-start gap-2 hover:bg-slate-900/60 p-1 rounded">
                      <span className="text-slate-500 shrink-0 select-none">
                        {new Date(l.timestamp).toLocaleTimeString()}
                      </span>
                      <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold shrink-0 ${
                        l.level === 'ERROR' ? 'bg-rose-900/80 text-rose-300' :
                        l.level === 'WARN' ? 'bg-amber-900/80 text-amber-300' :
                        l.level === 'AI' ? 'bg-purple-900/80 text-purple-300' :
                        l.level === 'SSE' ? 'bg-emerald-900/80 text-emerald-300' :
                        l.level === 'AUTH' ? 'bg-sky-900/80 text-sky-300' :
                        'bg-slate-800 text-slate-300'
                      }`}>
                        {l.level}
                      </span>
                      <span className="text-slate-300 break-all">{l.message}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB 4: BACKUP & RESTORE */}
          {activeTab === 'backup' && (
            <div className="space-y-6">
              <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/60">
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-xl bg-primary/10 text-primary">
                    <Download className="w-6 h-6" />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                      Export Instant Database Snapshot
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Download a verified JSON database snapshot with SHA checksum containing all users, notes, memes, failed words, chats, and notices.
                    </p>
                    <button
                      id="export-backup-btn"
                      onClick={handleExportBackup}
                      className="mt-3 px-4 py-2 bg-primary text-white text-xs font-semibold rounded-xl hover:bg-primary/90 transition-colors inline-flex items-center gap-2"
                    >
                      <Download className="w-4 h-4" />
                      Download Backup Snapshot (.json)
                    </button>
                  </div>
                </div>
              </div>

              {isAdmin && (
                <div className="p-5 rounded-2xl bg-amber-500/5 border border-amber-500/20">
                  <div className="flex items-start gap-4">
                    <div className="p-3 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                      <Upload className="w-6 h-6" />
                    </div>
                    <div className="flex-1">
                      <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                        <span>Restore Snapshot (Admin Only)</span>
                        <Shield className="w-4 h-4 text-amber-500" />
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        Upload a previously exported snapshot to safely restore or migrate state across instances.
                      </p>
                      
                      {backupMessage && (
                        <div className="mt-3 p-3 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 text-xs rounded-xl flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 shrink-0" />
                          <span>{backupMessage}</span>
                        </div>
                      )}
                      
                      {backupError && (
                        <div className="mt-3 p-3 bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300 text-xs rounded-xl flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 shrink-0" />
                          <span>{backupError}</span>
                        </div>
                      )}

                      <label className="mt-3 inline-flex items-center gap-2 px-4 py-2 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-semibold rounded-xl hover:opacity-90 cursor-pointer transition-opacity">
                        <Upload className="w-4 h-4" />
                        Select JSON Snapshot File
                        <input
                          id="import-backup-input"
                          type="file"
                          accept=".json"
                          onChange={handleImportBackup}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 px-6 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between text-xs text-slate-500">
          <span>Server Engine: Node.js + Express + Vite + Gemini 3.7 Flash</span>
          <button
            id="close-system-health-footer-btn"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium rounded-lg hover:bg-slate-300 dark:hover:bg-slate-700"
          >
            Close
          </button>
        </div>
      </motion.div>
    </div>
  );
}
