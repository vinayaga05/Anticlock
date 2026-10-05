'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type {
  ModerationReport,
  ReportStatus,
  ContentType,
  ModerationActionRequest,
} from '@anticlock/contracts';
import { AdminShell } from '@/components/AdminShell';
import { apiFetch } from '@/lib/api';

type ModerationListResponse = {
  data: ModerationReport[];
  meta: { nextCursor: string | null };
};

const REPORT_REASON_LABELS: Record<string, string> = {
  harmful_content: 'Harmful content',
  bullying: 'Bullying',
  harassment: 'Harassment',
  violent_or_assault_content: 'Violent or assault content',
  adult_or_pornographic_material: 'Adult or pornographic material',
  hate_speech: 'Hate speech',
  misinformation: 'Misinformation',
  illegal_activity: 'Illegal activity',
  child_exploitation: 'Child exploitation',
  privacy_violation: 'Privacy violation',
  spam_or_scams: 'Spam or scams',
};

export default function ModerationPage() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<ReportStatus>('open');
  const [contentType, setContentType] = useState<ContentType | 'all'>('all');
  const [selectedReport, setSelectedReport] = useState<ModerationReport | null>(null);
  const [actionNote, setActionNote] = useState('');

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'moderation', 'reports', status, contentType],
    queryFn: () => {
      const params = new URLSearchParams({ status, limit: '50' });
      if (contentType !== 'all') params.append('contentType', contentType);
      return apiFetch<ModerationListResponse>(`/admin/moderation/reports?${params}`);
    },
  });

  const actionMutation = useMutation({
    mutationFn: async ({
      report,
      action,
      note,
    }: {
      report: ModerationReport;
      action: ModerationActionRequest['action'];
      note: string;
    }) => {
      await apiFetch(`/admin/moderation/reports/${report.contentType}/${report.id}/action`, {
        method: 'POST',
        body: JSON.stringify({ action, note }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'moderation', 'reports'] });
      setSelectedReport(null);
      setActionNote('');
    },
  });

  const handleAction = (action: ModerationActionRequest['action']) => {
    if (!selectedReport || !actionNote.trim()) return;
    actionMutation.mutate({ report: selectedReport, action, note: actionNote });
  };

  return (
    <AdminShell>
      <h1 className="page-title">Content Moderation</h1>
      <p className="page-sub">Review and take action on reported content.</p>

      <div style={{ marginBottom: '20px', display: 'flex', gap: '12px' }}>
        <div>
          <label htmlFor="status" style={{ marginRight: '8px' }}>
            Status:
          </label>
          <select
            id="status"
            value={status}
            onChange={e => setStatus(e.target.value as ReportStatus)}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              border: '1px solid #ddd',
            }}>
            <option value="open">Open</option>
            <option value="resolved">Resolved</option>
            <option value="dismissed">Dismissed</option>
          </select>
        </div>

        <div>
          <label htmlFor="contentType" style={{ marginRight: '8px' }}>
            Content Type:
          </label>
          <select
            id="contentType"
            value={contentType}
            onChange={e => setContentType(e.target.value as ContentType | 'all')}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              border: '1px solid #ddd',
            }}>
            <option value="all">All</option>
            <option value="reel">Reels</option>
            <option value="content_post">Posts</option>
          </select>
        </div>
      </div>

      <div className="card">
        {isLoading ? <p className="muted">Loading reports…</p> : null}
        {error ? <p className="error">{(error as Error).message}</p> : null}
        {data && data.data.length === 0 ? (
          <p className="muted">No reports found.</p>
        ) : null}
        {data && data.data.length > 0 ? (
          <table className="table">
            <thead>
              <tr>
                <th>Content</th>
                <th>Type</th>
                <th>Reporter</th>
                <th>Reason</th>
                <th>Count</th>
                <th>Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.data.map(report => (
                <tr key={report.id}>
                  <td>
                    <div style={{ maxWidth: '300px' }}>
                      <strong>{report.contentTitle || 'Untitled'}</strong>
                      {report.contentCaption && (
                        <div
                          style={{
                            fontSize: '0.9em',
                            color: '#666',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}>
                          {report.contentCaption}
                        </div>
                      )}
                      {report.contentCreatorName && (
                        <div style={{ fontSize: '0.85em', color: '#888' }}>
                          by {report.contentCreatorName}
                        </div>
                      )}
                    </div>
                  </td>
                  <td>
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontSize: '0.85em',
                        backgroundColor: '#f0f0f0',
                      }}>
                      {report.contentType}
                    </span>
                  </td>
                  <td>{report.reporterName}</td>
                  <td>{REPORT_REASON_LABELS[report.reason] || report.reason}</td>
                  <td>
                    <span
                      style={{
                        fontWeight: report.reportCount > 1 ? 'bold' : 'normal',
                        color: report.reportCount > 3 ? '#d32f2f' : 'inherit',
                      }}>
                      {report.reportCount}
                    </span>
                  </td>
                  <td>{new Date(report.createdAt).toLocaleDateString()}</td>
                  <td>
                    {status === 'open' ? (
                      <button
                        onClick={() => setSelectedReport(report)}
                        style={{
                          padding: '4px 12px',
                          borderRadius: '4px',
                          border: '1px solid #2196f3',
                          backgroundColor: '#fff',
                          color: '#2196f3',
                          cursor: 'pointer',
                          fontSize: '0.9em',
                        }}>
                        Review
                      </button>
                    ) : (
                      <div style={{ fontSize: '0.85em', color: '#666' }}>
                        {report.resolutionAction || 'N/A'}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </div>

      {selectedReport && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => setSelectedReport(null)}>
          <div
            style={{
              backgroundColor: '#fff',
              borderRadius: '12px',
              padding: '24px',
              maxWidth: '600px',
              width: '90%',
              maxHeight: '80vh',
              overflow: 'auto',
            }}
            onClick={e => e.stopPropagation()}>
            <h2 style={{ marginTop: 0 }}>Review Report</h2>

            <div style={{ marginBottom: '20px' }}>
              <h3>Content Details</h3>
              <p>
                <strong>Type:</strong> {selectedReport.contentType}
              </p>
              <p>
                <strong>Title:</strong> {selectedReport.contentTitle || 'Untitled'}
              </p>
              {selectedReport.contentCaption && (
                <p>
                  <strong>Caption:</strong> {selectedReport.contentCaption}
                </p>
              )}
              {selectedReport.contentCreatorName && (
                <p>
                  <strong>Creator:</strong> {selectedReport.contentCreatorName}
                </p>
              )}
              <p>
                <strong>Status:</strong> {selectedReport.contentStatus}
              </p>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <h3>Report Details</h3>
              <p>
                <strong>Reporter:</strong> {selectedReport.reporterName}
              </p>
              <p>
                <strong>Reason:</strong>{' '}
                {REPORT_REASON_LABELS[selectedReport.reason] || selectedReport.reason}
              </p>
              {selectedReport.details && (
                <p>
                  <strong>Details:</strong> {selectedReport.details}
                </p>
              )}
              <p>
                <strong>Total Reports:</strong> {selectedReport.reportCount}
              </p>
              <p>
                <strong>Reported:</strong>{' '}
                {new Date(selectedReport.createdAt).toLocaleString()}
              </p>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label htmlFor="actionNote">
                <strong>Moderation Note (required):</strong>
              </label>
              <textarea
                id="actionNote"
                value={actionNote}
                onChange={e => setActionNote(e.target.value)}
                placeholder="Explain your decision..."
                style={{
                  width: '100%',
                  minHeight: '80px',
                  padding: '8px',
                  borderRadius: '6px',
                  border: '1px solid #ddd',
                  marginTop: '8px',
                  fontFamily: 'inherit',
                }}
              />
            </div>

            {actionMutation.error && (
              <p style={{ color: '#d32f2f', marginBottom: '12px' }}>
                {(actionMutation.error as Error).message}
              </p>
            )}

            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <button
                onClick={() => handleAction('dismiss')}
                disabled={!actionNote.trim() || actionMutation.isPending}
                style={{
                  padding: '8px 16px',
                  borderRadius: '6px',
                  border: '1px solid #ddd',
                  backgroundColor: '#fff',
                  cursor: actionNote.trim() ? 'pointer' : 'not-allowed',
                  opacity: actionNote.trim() ? 1 : 0.5,
                }}>
                Dismiss
              </button>
              <button
                onClick={() => handleAction('remove_content')}
                disabled={!actionNote.trim() || actionMutation.isPending}
                style={{
                  padding: '8px 16px',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: '#d32f2f',
                  color: '#fff',
                  cursor: actionNote.trim() ? 'pointer' : 'not-allowed',
                  opacity: actionNote.trim() ? 1 : 0.5,
                }}>
                Remove Content
              </button>
              <button
                onClick={() => handleAction('warn_user')}
                disabled={!actionNote.trim() || actionMutation.isPending}
                style={{
                  padding: '8px 16px',
                  borderRadius: '6px',
                  border: '1px solid #ff9800',
                  backgroundColor: '#fff',
                  color: '#ff9800',
                  cursor: actionNote.trim() ? 'pointer' : 'not-allowed',
                  opacity: actionNote.trim() ? 1 : 0.5,
                }}>
                Warn User
              </button>
              <button
                onClick={() => handleAction('suspend_user')}
                disabled={!actionNote.trim() || actionMutation.isPending}
                style={{
                  padding: '8px 16px',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: '#000',
                  color: '#fff',
                  cursor: actionNote.trim() ? 'pointer' : 'not-allowed',
                  opacity: actionNote.trim() ? 1 : 0.5,
                }}>
                Suspend User
              </button>
            </div>

            <button
              onClick={() => {
                setSelectedReport(null);
                setActionNote('');
              }}
              style={{
                marginTop: '16px',
                padding: '8px 16px',
                borderRadius: '6px',
                border: '1px solid #ddd',
                backgroundColor: '#fff',
                cursor: 'pointer',
              }}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
