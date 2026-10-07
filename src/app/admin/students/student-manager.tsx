'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Users,
  Search,
  Filter,
  CheckCircle2,
  AlertCircle,
  Shield,
  UserCheck,
  UserX,
  RefreshCw,
  Crown,
  Trash2,
  UserCog
} from 'lucide-react';

interface StudentItem {
  id: string;
  email: string;
  role: 'student' | 'admin';
  accountStatus: 'active' | 'suspended' | 'pending';
  emailVerified: boolean;
  createdAt: string;
  activeSessionsCount: number;
  isOwner?: boolean;
}

export function StudentManager() {
  const [students, setStudents] = useState<StudentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // Confirmation Modals
  const [statusModalTarget, setStatusModalTarget] = useState<StudentItem | null>(null);
  const [roleModalTarget, setRoleModalTarget] = useState<StudentItem | null>(null);
  const [deleteModalTarget, setDeleteModalTarget] = useState<StudentItem | null>(null);
  const [revokeModalTarget, setRevokeModalTarget] = useState<StudentItem | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchStudents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (roleFilter !== 'all') params.set('role', roleFilter);
      if (statusFilter !== 'all') params.set('status', statusFilter);

      const res = await fetch(`/api/admin/students?${params.toString()}`);
      if (!res.ok) {
        throw new Error(`Failed to load students (${res.status})`);
      }
      const data = (await res.json()) as { students?: StudentItem[] };
      setStudents(data.students || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error loading students');
    } finally {
      setLoading(false);
    }
  }, [search, roleFilter, statusFilter]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const params = new URLSearchParams();
        if (search.trim()) params.set('search', search.trim());
        if (roleFilter !== 'all') params.set('role', roleFilter);
        if (statusFilter !== 'all') params.set('status', statusFilter);

        const res = await fetch(`/api/admin/students?${params.toString()}`);
        if (!res.ok) {
          throw new Error(`Failed to load students (${res.status})`);
        }
        const data = (await res.json()) as { students?: StudentItem[] };
        if (active) setStudents(data.students || []);
      } catch (err: unknown) {
        if (active) setError(err instanceof Error ? err.message : 'Error loading students');
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [search, roleFilter, statusFilter]);

  const handleToggleStatus = async () => {
    if (!statusModalTarget) return;
    setActionLoading(true);
    const newStatus = statusModalTarget.accountStatus === 'active' ? 'suspended' : 'active';

    try {
      const res = await fetch(`/api/admin/students/${statusModalTarget.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountStatus: newStatus })
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error || 'Failed to update account status');

      setFeedback({
        type: 'success',
        message: `Account status for ${statusModalTarget.email} updated to ${newStatus}.`
      });
      setStatusModalTarget(null);
      fetchStudents();
    } catch (err: unknown) {
      setFeedback({ type: 'error', message: err instanceof Error ? err.message : 'Error updating status' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleRevokeSessions = async () => {
    if (!revokeModalTarget) return;
    setActionLoading(true);

    try {
      const res = await fetch(`/api/admin/students/${revokeModalTarget.id}/revoke-sessions`, {
        method: 'POST'
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error || 'Failed to revoke sessions');

      setFeedback({
        type: 'success',
        message: `Successfully invalidated all active sessions for ${revokeModalTarget.email}.`
      });
      setRevokeModalTarget(null);
      fetchStudents();
    } catch (err: unknown) {
      setFeedback({ type: 'error', message: err instanceof Error ? err.message : 'Error revoking sessions' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleRole = async () => {
    if (!roleModalTarget) return;
    setActionLoading(true);
    const newRole = roleModalTarget.role === 'admin' ? 'student' : 'admin';

    try {
      const res = await fetch(`/api/admin/students/${roleModalTarget.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole })
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error || 'Failed to update role');

      setFeedback({
        type: 'success',
        message: `${roleModalTarget.email} is now a ${newRole}.`
      });
      setRoleModalTarget(null);
      fetchStudents();
    } catch (err: unknown) {
      setFeedback({ type: 'error', message: err instanceof Error ? err.message : 'Error updating role' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteModalTarget) return;
    setActionLoading(true);

    try {
      const res = await fetch(`/api/admin/students/${deleteModalTarget.id}`, {
        method: 'DELETE'
      });
      const data = (await res.json()) as { error?: string; message?: string };
      if (!res.ok) throw new Error(data.error || 'Failed to remove user');

      setFeedback({
        type: 'success',
        message: data.message || `${deleteModalTarget.email} has been removed.`
      });
      setDeleteModalTarget(null);
      fetchStudents();
    } catch (err: unknown) {
      setFeedback({ type: 'error', message: err instanceof Error ? err.message : 'Error removing user' });
    } finally {
      setActionLoading(false);
    }
  };

  const isOwnerAccount = (email: string) => email === 'ashinshiju920@gmail.com';

  return (
    <div className="admin-student-manager">
      {feedback && (
        <div className={`admin-alert admin-alert-${feedback.type}`}>
          {feedback.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          <span>{feedback.message}</span>
          <button onClick={() => setFeedback(null)} className="admin-alert-dismiss">×</button>
        </div>
      )}

      {/* Security notice */}
      <div className="admin-info-banner">
        <Shield size={18} style={{ color: 'var(--teal-600, #0d9488)', flexShrink: 0 }} />
        <span>
          <strong>Open access:</strong> Anyone can create a student account. Passwords are never stored in plaintext, and admins can activate, suspend, promote, demote, remove users, or revoke sessions here.
        </span>
      </div>

      {/* Filter Bar */}
      <div className="admin-actions-bar">
        <div className="admin-search-group">
          <div className="admin-search-input-wrap">
            <Search size={16} className="admin-search-icon" />
            <input
              type="text"
              placeholder="Search by user email or name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="admin-input admin-search-input"
            />
          </div>

          <div className="admin-filter-wrap">
            <Filter size={16} />
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="admin-select"
            >
              <option value="all">All Roles</option>
              <option value="student">Students</option>
              <option value="admin">Admins</option>
            </select>
          </div>

          <div className="admin-filter-wrap">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="admin-select"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
            </select>
          </div>
        </div>

        <button onClick={fetchStudents} className="admin-btn admin-btn-secondary">
          <RefreshCw size={16} /> Refresh
        </button>
      </div>

      {/* Students Table */}
      <div className="admin-card">
        {loading ? (
          <div className="admin-loading-state">
            <RefreshCw size={24} className="spin" />
            <p>Loading user accounts...</p>
          </div>
        ) : error ? (
          <div className="admin-empty-state">
            <AlertCircle size={32} style={{ color: 'var(--red-500, #ef4444)' }} />
            <p>{error}</p>
            <button onClick={fetchStudents} className="admin-btn admin-btn-secondary" style={{ marginTop: '0.75rem' }}>
              Retry
            </button>
          </div>
        ) : students.length === 0 ? (
          <div className="admin-empty-state">
            <Users size={40} style={{ color: 'var(--slate-400, #94a3b8)' }} />
            <h3>No users found</h3>
            <p>No user accounts matched your current search filters.</p>
          </div>
        ) : (
          <div className="admin-table-responsive">
            <table className="admin-table">
              <thead>
                <tr>
                  <th style={{ width: '30%' }}>User / Email</th>
                  <th style={{ width: '12%' }}>Role</th>
                  <th style={{ width: '12%' }}>Status</th>
                  <th style={{ width: '14%' }}>Email Verified</th>
                  <th style={{ width: '15%' }}>Active Sessions</th>
                  <th style={{ width: '17%', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {students.map((student) => {
                  const isOwner = isOwnerAccount(student.email);

                  return (
                    <tr key={student.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ fontWeight: 600, color: 'var(--navy-900, #062a52)' }}>
                            {student.email}
                          </span>
                          {isOwner && (
                            <span className="admin-badge admin-badge-owner" title="Permanent System Owner">
                              <Crown size={12} /> Owner
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--slate-500, #64748b)', marginTop: '0.125rem' }}>
                          Joined: {new Date(student.createdAt).toLocaleDateString()}
                        </div>
                      </td>
                      <td>
                        <span className={`admin-badge ${student.role === 'admin' ? 'admin-badge-admin' : 'admin-badge-neutral'}`}>
                          {student.role === 'admin' ? 'Admin' : 'Student'}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`admin-badge ${
                            student.accountStatus === 'active'
                              ? 'admin-badge-success'
                              : 'admin-badge-danger'
                          }`}
                        >
                          {student.accountStatus === 'active' ? 'Active' : 'Suspended'}
                        </span>
                      </td>
                      <td>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                            fontSize: '0.8125rem',
                            color: student.emailVerified ? 'var(--teal-700, #0f766e)' : 'var(--amber-700, #b45309)'
                          }}
                        >
                          {student.emailVerified ? (
                            <>
                              <UserCheck size={14} /> Verified
                            </>
                          ) : (
                            <>
                              <UserX size={14} /> Pending
                            </>
                          )}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>
                            {student.activeSessionsCount}
                          </span>
                          {student.activeSessionsCount > 0 && !isOwner && (
                            <button
                              type="button"
                              onClick={() => setRevokeModalTarget(student)}
                              className="admin-link-btn"
                              title="Revoke all active sessions"
                            >
                              Revoke
                            </button>
                          )}
                        </div>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {isOwner ? (
                          <span style={{ fontSize: '0.75rem', color: 'var(--slate-400, #94a3b8)', fontStyle: 'italic' }}>
                            Protected
                          </span>
                        ) : (
                          <div className="admin-row-actions">
                            <button
                              type="button"
                              onClick={() => setStatusModalTarget(student)}
                              className={`admin-btn admin-btn-sm ${
                                student.accountStatus === 'active'
                                  ? 'admin-btn-secondary'
                                  : 'admin-btn-primary'
                              }`}
                            >
                              {student.accountStatus === 'active' ? 'Suspend' : 'Activate'}
                            </button>
                            <button
                              type="button"
                              onClick={() => setRoleModalTarget(student)}
                              className="admin-icon-btn"
                              title={student.role === 'admin' ? 'Make student' : 'Make admin'}
                            >
                              <UserCog size={15} />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteModalTarget(student)}
                              className="admin-icon-btn admin-icon-btn-danger"
                              title="Remove user"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Suspend / Activate Confirmation Modal */}
      {statusModalTarget && (
        <div className="admin-modal-backdrop" onClick={() => !actionLoading && setStatusModalTarget(null)}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '460px' }}>
            <div className="admin-modal-header">
              <h3>
                {statusModalTarget.accountStatus === 'active' ? 'Suspend Student Account' : 'Reactivate Account'}
              </h3>
              <button
                type="button"
                onClick={() => setStatusModalTarget(null)}
                className="admin-modal-close"
                disabled={actionLoading}
              >
                ×
              </button>
            </div>
            <div className="admin-modal-body">
              <p style={{ color: 'var(--slate-700, #334155)', fontSize: '0.9375rem', marginBottom: '1rem' }}>
                Are you sure you want to {statusModalTarget.accountStatus === 'active' ? 'suspend' : 'reactivate'} the account for:
              </p>
              <div className="admin-confirm-target">
                <strong>{statusModalTarget.email}</strong>
              </div>
              <p style={{ color: 'var(--slate-500, #64748b)', fontSize: '0.8125rem', marginTop: '0.75rem' }}>
                {statusModalTarget.accountStatus === 'active'
                  ? 'Suspended accounts cannot log in, access private study materials, or take Mock Tests. Active sessions will be terminated.'
                  : 'Reactivating this account will restore standard login and portal access privileges.'}
              </p>
            </div>
            <div className="admin-modal-footer">
              <button
                type="button"
                onClick={() => setStatusModalTarget(null)}
                className="admin-btn admin-btn-secondary"
                disabled={actionLoading}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleToggleStatus}
                className={`admin-btn ${
                  statusModalTarget.accountStatus === 'active' ? 'admin-btn-danger' : 'admin-btn-primary'
                }`}
                disabled={actionLoading}
              >
                {actionLoading ? 'Processing...' : statusModalTarget.accountStatus === 'active' ? 'Confirm Suspend' : 'Confirm Activate'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Role Change Confirmation Modal */}
      {roleModalTarget && (
        <div className="admin-modal-backdrop" onClick={() => !actionLoading && setRoleModalTarget(null)}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '460px' }}>
            <div className="admin-modal-header">
              <h3>{roleModalTarget.role === 'admin' ? 'Make User a Student' : 'Make User an Admin'}</h3>
              <button
                type="button"
                onClick={() => setRoleModalTarget(null)}
                className="admin-modal-close"
                disabled={actionLoading}
              >
                Ã—
              </button>
            </div>
            <div className="admin-modal-body">
              <p style={{ color: 'var(--slate-700, #334155)', fontSize: '0.9375rem', marginBottom: '1rem' }}>
                Change role for:
              </p>
              <div className="admin-confirm-target">
                <strong>{roleModalTarget.email}</strong>
              </div>
              <p style={{ color: 'var(--slate-500, #64748b)', fontSize: '0.8125rem', marginTop: '0.75rem' }}>
                {roleModalTarget.role === 'admin'
                  ? 'This removes admin panel access and revokes current sessions.'
                  : 'This grants admin panel access. Only give this to trusted staff.'}
              </p>
            </div>
            <div className="admin-modal-footer">
              <button
                type="button"
                onClick={() => setRoleModalTarget(null)}
                className="admin-btn admin-btn-secondary"
                disabled={actionLoading}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleToggleRole}
                className="admin-btn admin-btn-primary"
                disabled={actionLoading}
              >
                {actionLoading ? 'Processing...' : roleModalTarget.role === 'admin' ? 'Make Student' : 'Make Admin'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete User Confirmation Modal */}
      {deleteModalTarget && (
        <div className="admin-modal-backdrop" onClick={() => !actionLoading && setDeleteModalTarget(null)}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '460px' }}>
            <div className="admin-modal-header">
              <h3>Remove User</h3>
              <button
                type="button"
                onClick={() => setDeleteModalTarget(null)}
                className="admin-modal-close"
                disabled={actionLoading}
              >
                Ã—
              </button>
            </div>
            <div className="admin-modal-body">
              <p style={{ color: 'var(--slate-700, #334155)', fontSize: '0.9375rem', marginBottom: '1rem' }}>
                Permanently remove this user account:
              </p>
              <div className="admin-confirm-target">
                <strong>{deleteModalTarget.email}</strong>
              </div>
              <p style={{ color: 'var(--slate-500, #64748b)', fontSize: '0.8125rem', marginTop: '0.75rem' }}>
                Their sessions, quiz attempts, answers, and course access records will be deleted where the database relationship allows cascading.
              </p>
            </div>
            <div className="admin-modal-footer">
              <button
                type="button"
                onClick={() => setDeleteModalTarget(null)}
                className="admin-btn admin-btn-secondary"
                disabled={actionLoading}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteUser}
                className="admin-btn admin-btn-danger"
                disabled={actionLoading}
              >
                {actionLoading ? 'Removing...' : 'Confirm Remove'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Revoke Sessions Confirmation Modal */}
      {revokeModalTarget && (
        <div className="admin-modal-backdrop" onClick={() => !actionLoading && setRevokeModalTarget(null)}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '460px' }}>
            <div className="admin-modal-header">
              <h3>Revoke Active Sessions</h3>
              <button
                type="button"
                onClick={() => setRevokeModalTarget(null)}
                className="admin-modal-close"
                disabled={actionLoading}
              >
                ×
              </button>
            </div>
            <div className="admin-modal-body">
              <p style={{ color: 'var(--slate-700, #334155)', fontSize: '0.9375rem', marginBottom: '1rem' }}>
                Revoke all active login sessions for:
              </p>
              <div className="admin-confirm-target">
                <strong>{revokeModalTarget.email}</strong>
              </div>
              <p style={{ color: 'var(--slate-500, #64748b)', fontSize: '0.8125rem', marginTop: '0.75rem' }}>
                This user will immediately be logged out of all connected browsers and devices. They will need to log in again with their password.
              </p>
            </div>
            <div className="admin-modal-footer">
              <button
                type="button"
                onClick={() => setRevokeModalTarget(null)}
                className="admin-btn admin-btn-secondary"
                disabled={actionLoading}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRevokeSessions}
                className="admin-btn admin-btn-danger"
                disabled={actionLoading}
              >
                {actionLoading ? 'Revoking...' : 'Confirm Revoke Sessions'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
