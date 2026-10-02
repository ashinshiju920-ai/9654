'use client';

import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, AlertCircle, Clock, Filter } from 'lucide-react';

interface AuditLog {
  id: string;
  adminId: string;
  adminEmail: string;
  action: string;
  targetType: string;
  targetId: string | null;
  details: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

export function AuditLogViewer() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [targetTypeFilter, setTargetTypeFilter] = useState('all');

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ limit: '100' });
      if (targetTypeFilter !== 'all') params.set('targetType', targetTypeFilter);

      const res = await fetch(`/api/admin/audit-logs?${params.toString()}`);
      if (!res.ok) {
        throw new Error(`Failed to load audit logs (${res.status})`);
      }
      const data = (await res.json()) as { logs?: AuditLog[] };
      setLogs(data.logs || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error loading audit logs');
    } finally {
      setLoading(false);
    }
  }, [targetTypeFilter]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const params = new URLSearchParams({ limit: '100' });
        if (targetTypeFilter !== 'all') params.set('targetType', targetTypeFilter);

        const res = await fetch(`/api/admin/audit-logs?${params.toString()}`);
        if (!res.ok) {
          throw new Error(`Failed to load audit logs (${res.status})`);
        }
        const data = (await res.json()) as { logs?: AuditLog[] };
        if (active) setLogs(data.logs || []);
      } catch (err: unknown) {
        if (active) setError(err instanceof Error ? err.message : 'Error loading audit logs');
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [targetTypeFilter]);

  const formatAction = (action: string) => {
    return action.replace(/_/g, ' ').toUpperCase();
  };

  return (
    <div className="admin-audit-logs">
      <div className="admin-actions-bar">
        <div className="admin-filter-wrap">
          <Filter size={16} />
          <select
            value={targetTypeFilter}
            onChange={(e) => setTargetTypeFilter(e.target.value)}
            className="admin-select"
          >
            <option value="all">All Targets</option>
            <option value="course">Courses</option>
            <option value="material">Materials</option>
            <option value="question">Questions</option>
            <option value="student">Students</option>
          </select>
        </div>

        <button onClick={fetchLogs} className="admin-btn admin-btn-secondary">
          <RefreshCw size={16} /> Refresh
        </button>
      </div>

      <div className="admin-card">
        {loading ? (
          <div className="admin-loading-state">
            <RefreshCw size={24} className="spin" />
            <p>Loading audit trail...</p>
          </div>
        ) : error ? (
          <div className="admin-empty-state">
            <AlertCircle size={32} style={{ color: 'var(--red-500, #ef4444)' }} />
            <p>{error}</p>
            <button onClick={fetchLogs} className="admin-btn admin-btn-secondary" style={{ marginTop: '0.75rem' }}>
              Retry
            </button>
          </div>
        ) : logs.length === 0 ? (
          <div className="admin-empty-state">
            <Clock size={40} style={{ color: 'var(--slate-400, #94a3b8)' }} />
            <h3>No audit records recorded yet</h3>
            <p>Administrative mutations to courses, materials, questions, and accounts will be logged here.</p>
          </div>
        ) : (
          <div className="admin-table-responsive">
            <table className="admin-table">
              <thead>
                <tr>
                  <th style={{ width: '18%' }}>Timestamp</th>
                  <th style={{ width: '22%' }}>Admin</th>
                  <th style={{ width: '22%' }}>Action</th>
                  <th style={{ width: '14%' }}>Target</th>
                  <th style={{ width: '24%' }}>Details</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td>
                      <div style={{ fontSize: '0.8125rem', color: 'var(--slate-700, #334155)', fontWeight: 500 }}>
                        {new Date(log.createdAt).toLocaleDateString()}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--slate-400, #94a3b8)' }}>
                        {new Date(log.createdAt).toLocaleTimeString()}
                      </div>
                    </td>
                    <td>
                      <span style={{ fontWeight: 600, color: 'var(--navy-900, #062a52)', fontSize: '0.8125rem' }}>
                        {log.adminEmail}
                      </span>
                    </td>
                    <td>
                      <span className="admin-badge admin-badge-action">
                        {formatAction(log.action)}
                      </span>
                    </td>
                    <td>
                      <span className="admin-badge admin-badge-neutral">
                        {log.targetType.toUpperCase()}
                      </span>
                      {log.targetId && (
                        <div style={{ fontSize: '0.6875rem', color: 'var(--slate-400, #94a3b8)', marginTop: '0.125rem', fontFamily: 'monospace' }}>
                          {log.targetId.substring(0, 8)}...
                        </div>
                      )}
                    </td>
                    <td>
                      <div style={{ fontSize: '0.8125rem', color: 'var(--slate-600, #475569)' }}>
                        {log.details || '—'}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
