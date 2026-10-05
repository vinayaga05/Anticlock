'use client';

import { useMemo, useState } from 'react';
import { AdminShell } from '@/components/AdminShell';

type Community = {
  id: string;
  name: string;
  slug: string;
  memberCount: number;
  postCount: number;
  status: string;
  ownerName: string;
  createdAt: string;
};

type PostReport = {
  id: string;
  communityName: string;
  postContent: string;
  reporterName: string;
  reason: string;
  details?: string;
  status: string;
  createdAt: string;
};

type Tab = 'communities' | 'reports';

const SAMPLE_COMMUNITIES: Community[] = [
  {
    id: 'comm-1',
    name: 'Chennai Cricket Fans',
    slug: 'chennai-cricket-fans',
    memberCount: 1248,
    postCount: 156,
    status: 'published',
    ownerName: 'Arun Kumar',
    createdAt: '2026-07-15',
  },
  {
    id: 'comm-2',
    name: 'Fitness & Wellness',
    slug: 'fitness-wellness',
    memberCount: 892,
    postCount: 234,
    status: 'published',
    ownerName: 'Priya Sharma',
    createdAt: '2026-08-01',
  },
  {
    id: 'comm-3',
    name: 'Tech Talk Chennai',
    slug: 'tech-talk-chennai',
    memberCount: 456,
    postCount: 89,
    status: 'published',
    ownerName: 'Ravi Chandran',
    createdAt: '2026-08-20',
  },
];

const SAMPLE_REPORTS: PostReport[] = [
  {
    id: 'report-1',
    communityName: 'Chennai Cricket Fans',
    postContent: 'Check out this amazing cricket gear deal...',
    reporterName: 'Karthik',
    reason: 'spam',
    details: 'Looks like spam advertising',
    status: 'open',
    createdAt: '2026-10-01',
  },
  {
    id: 'report-2',
    communityName: 'Fitness & Wellness',
    postContent: 'Here is my workout routine for beginners...',
    reporterName: 'Meera',
    reason: 'misinformation',
    details: 'Contains unsafe workout advice',
    status: 'open',
    createdAt: '2026-10-02',
  },
];

export default function CommunitiesAdminPage() {
  const [tab, setTab] = useState<Tab>('communities');
  const [communities] = useState<Community[]>(SAMPLE_COMMUNITIES);
  const [reports, setReports] = useState<PostReport[]>(SAMPLE_REPORTS);
  const [statusFilter, setStatusFilter] = useState<'all' | 'published' | 'archived'>('all');
  const [reportFilter, setReportFilter] = useState<'open' | 'resolved'>('open');

  const filteredCommunities = useMemo(() => {
    if (statusFilter === 'all') return communities;
    return communities.filter((c) => c.status === statusFilter);
  }, [communities, statusFilter]);

  const filteredReports = useMemo(() => {
    return reports.filter((r) => r.status === reportFilter);
  }, [reports, reportFilter]);

  function suspendCommunity(id: string) {
    alert(`Suspend community ${id} - implement via API`);
  }

  function deleteCommunity(id: string) {
    if (confirm('Are you sure you want to delete this community? This cannot be undone.')) {
      alert(`Delete community ${id} - implement via API`);
    }
  }

  function removePost(reportId: string) {
    alert(`Remove post from report ${reportId} - implement via API`);
  }

  function resolveReport(reportId: string) {
    setReports((prev) =>
      prev.map((r) => (r.id === reportId ? { ...r, status: 'resolved' } : r))
    );
  }

  return (
    <AdminShell>
      <h1 className="page-title">Communities</h1>
      <p className="page-sub">
        Manage user-created communities and moderate reported posts.
      </p>

      <div className="toolbar" style={{ marginBottom: 16 }}>
        <div className="tabs">
          <button
            type="button"
            className={tab === 'communities' ? 'btn' : 'btn secondary'}
            onClick={() => setTab('communities')}>
            Communities
          </button>
          <button
            type="button"
            className={tab === 'reports' ? 'btn' : 'btn secondary'}
            onClick={() => setTab('reports')}>
            Post Reports
          </button>
        </div>
      </div>

      {tab === 'communities' ? (
        <>
          <div className="toolbar" style={{ marginBottom: 16 }}>
            <div className="tabs">
              {(['all', 'published', 'archived'] as const).map((filter) => (
                <button
                  key={filter}
                  type="button"
                  className={statusFilter === filter ? 'btn' : 'btn secondary'}
                  onClick={() => setStatusFilter(filter)}>
                  {filter.charAt(0).toUpperCase() + filter.slice(1)}
                </button>
              ))}
            </div>
            <span className="muted">{filteredCommunities.length} communities</span>
          </div>

          <div className="card">
            {filteredCommunities.length === 0 ? (
              <p className="muted">No communities in this tab.</p>
            ) : null}

            {filteredCommunities.map((community) => (
              <div
                key={community.id}
                style={{
                  padding: '16px 0',
                  borderBottom: '1px solid var(--line)',
                }}>
                <div className="toolbar" style={{ alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <span className="badge">{community.status.toUpperCase()}</span>
                    </div>
                    <strong style={{ display: 'block', marginTop: 8 }}>
                      {community.name}
                    </strong>
                    <div className="muted" style={{ marginTop: 4 }}>
                      @{community.slug} · {community.memberCount} members ·{' '}
                      {community.postCount} posts · Owner: {community.ownerName}
                    </div>
                    <div className="muted" style={{ marginTop: 4 }}>
                      Created {community.createdAt}
                    </div>
                  </div>

                  <div className="toolbar" style={{ gap: 8, flexWrap: 'wrap' }}>
                    {community.status === 'published' ? (
                      <button
                        type="button"
                        className="btn secondary"
                        onClick={() => suspendCommunity(community.id)}>
                        Suspend
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="btn secondary"
                      onClick={() => deleteCommunity(community.id)}>
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <>
          <div className="toolbar" style={{ marginBottom: 16 }}>
            <div className="tabs">
              {(['open', 'resolved'] as const).map((filter) => (
                <button
                  key={filter}
                  type="button"
                  className={reportFilter === filter ? 'btn' : 'btn secondary'}
                  onClick={() => setReportFilter(filter)}>
                  {filter.charAt(0).toUpperCase() + filter.slice(1)}
                </button>
              ))}
            </div>
            <span className="muted">{filteredReports.length} reports</span>
          </div>

          <div className="card">
            {filteredReports.length === 0 ? (
              <p className="muted">No reports in this tab.</p>
            ) : null}

            {filteredReports.map((report) => (
              <div
                key={report.id}
                style={{
                  padding: '16px 0',
                  borderBottom: '1px solid var(--line)',
                }}>
                <div className="toolbar" style={{ alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <span className="badge">{report.reason.toUpperCase()}</span>
                      <span className="badge">{report.status.toUpperCase()}</span>
                    </div>
                    <strong style={{ display: 'block', marginTop: 8 }}>
                      {report.communityName}
                    </strong>
                    <p style={{ margin: '8px 0 0', maxWidth: 560 }}>
                      {report.postContent}
                    </p>
                    <div className="muted" style={{ marginTop: 4 }}>
                      Reported by {report.reporterName} on {report.createdAt}
                    </div>
                    {report.details ? (
                      <p className="muted" style={{ margin: '8px 0 0' }}>
                        Details: {report.details}
                      </p>
                    ) : null}
                  </div>

                  {report.status === 'open' ? (
                    <div className="toolbar" style={{ gap: 8, flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        className="btn"
                        onClick={() => removePost(report.id)}>
                        Remove Post
                      </button>
                      <button
                        type="button"
                        className="btn secondary"
                        onClick={() => resolveReport(report.id)}>
                        Dismiss Report
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </AdminShell>
  );
}
