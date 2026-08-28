'use client';

import { useMemo, useState } from 'react';
import { AdminShell } from '@/components/AdminShell';

type ReviewStatus =
  | 'pending_review'
  | 'approved'
  | 'needs_changes'
  | 'rejected_policy';

type Visibility = 'followers_only' | 'public';

type QueueItem = {
  id: string;
  kind: 'event' | 'product';
  title: string;
  submittedBy: string;
  submittedAt: string;
  reviewStatus: ReviewStatus;
  visibility: Visibility;
  price: number;
  detail: string;
  reviewNote?: string;
};

type JoinRequest = {
  id: string;
  teamName: string;
  userName: string;
  requestedAt: string;
  status: 'pending' | 'accepted' | 'rejected';
};

type ChallengeRow = {
  id: string;
  title: string;
  status: string;
  organizer: string;
  participants: number;
};

const SAMPLE_QUEUE: QueueItem[] = [
  {
    id: 'sub-evt-yoga',
    kind: 'event',
    title: 'Yoga Workshop',
    submittedBy: 'Priya',
    submittedAt: '2026-08-26',
    reviewStatus: 'pending_review',
    visibility: 'followers_only',
    price: 499,
    detail: 'Sep 6 · 7:00 AM · T. Nagar, Chennai',
  },
  {
    id: 'sub-prod-band',
    kind: 'product',
    title: 'Resistance Band Set',
    submittedBy: 'Ravi',
    submittedAt: '2026-08-25',
    reviewStatus: 'pending_review',
    visibility: 'followers_only',
    price: 899,
    detail: 'Fitness gear · seller Ravi',
  },
  {
    id: 'sub-evt-cycle',
    kind: 'event',
    title: 'Weekend Cycling Meetup',
    submittedBy: 'Priya',
    submittedAt: '2026-08-24',
    reviewStatus: 'needs_changes',
    visibility: 'followers_only',
    price: 499,
    detail: 'Aug 30 · 6:00 AM · Chennai',
    reviewNote: 'Please add venue details and a clearer cover image.',
  },
];

const SAMPLE_TEAMS = [
  { id: 'team-strikers', name: 'Chennai Strikers', sport: 'Cricket', members: 12 },
  { id: 'team-hawks', name: 'Blue Hawks', sport: 'Hockey', members: 9 },
  { id: 'team-running', name: 'Anticlock Running Team', sport: 'Running', members: 186 },
  { id: 'team-football', name: 'Guindy United FC', sport: 'Football', members: 42 },
];

const SAMPLE_CHALLENGES: ChallengeRow[] = [
  {
    id: 'chal-weekend-cricket',
    title: 'Weekend Cricket Challenge',
    status: 'upcoming',
    organizer: 'Anticlock',
    participants: 16,
  },
  {
    id: 'chal-30-run',
    title: '30 Day Running Challenge',
    status: 'active',
    organizer: 'Anticlock Running Team',
    participants: 1248,
  },
  {
    id: 'chal-weekend-cycle',
    title: 'Weekend Cycling Challenge',
    status: 'active',
    organizer: 'Coastal Cyclists',
    participants: 312,
  },
  {
    id: 'chal-100km',
    title: '100 KM Cycling Challenge',
    status: 'upcoming',
    organizer: 'Anticlock',
    participants: 89,
  },
];

const SAMPLE_JOIN_REQUESTS: JoinRequest[] = [
  {
    id: 'jr-1',
    teamName: 'Blue Hawks',
    userName: 'Karthik',
    requestedAt: '2026-08-25',
    status: 'pending',
  },
  {
    id: 'jr-2',
    teamName: 'Blue Hawks',
    userName: 'You',
    requestedAt: '2026-08-26',
    status: 'pending',
  },
];

function statusLabel(status: ReviewStatus): string {
  switch (status) {
    case 'pending_review':
      return 'Pending Review';
    case 'approved':
      return 'Approved';
    case 'needs_changes':
      return 'Needs Changes';
    case 'rejected_policy':
      return 'Rejected';
  }
}

function visibilityLabel(visibility: Visibility): string {
  return visibility === 'public' ? 'Public in Explore' : 'Followers only';
}

type Tab = 'explore' | 'teams';

export default function CommunityAdminPage() {
  const [tab, setTab] = useState<Tab>('explore');
  const [items, setItems] = useState<QueueItem[]>(SAMPLE_QUEUE);
  const [filter, setFilter] = useState<'open' | 'resolved'>('open');
  const [noteDraft, setNoteDraft] = useState<Record<string, string>>({});
  const [joinRequests, setJoinRequests] = useState(SAMPLE_JOIN_REQUESTS);

  const visible = useMemo(() => {
    if (filter === 'open') {
      return items.filter(
        i =>
          i.reviewStatus === 'pending_review' ||
          i.reviewStatus === 'needs_changes',
      );
    }
    return items.filter(
      i =>
        i.reviewStatus === 'approved' || i.reviewStatus === 'rejected_policy',
    );
  }, [items, filter]);

  const pendingJoins = joinRequests.filter(r => r.status === 'pending');

  function updateItem(
    id: string,
    next: Partial<Pick<QueueItem, 'reviewStatus' | 'visibility' | 'reviewNote'>>,
  ) {
    setItems(prev =>
      prev.map(item => (item.id === id ? { ...item, ...next } : item)),
    );
  }

  function resolveJoin(id: string, accept: boolean) {
    setJoinRequests(prev =>
      prev.map(r =>
        r.id === id ? { ...r, status: accept ? 'accepted' : 'rejected' } : r,
      ),
    );
  }

  return (
    <AdminShell>
      <h1 className="page-title">Community</h1>
      <p className="page-sub">
        Moderate Explore submissions and review Teams &amp; Challenges activity.
      </p>

      <div className="toolbar" style={{ marginBottom: 16 }}>
        <div className="tabs">
          <button
            type="button"
            className={tab === 'explore' ? 'btn' : 'btn secondary'}
            onClick={() => setTab('explore')}>
            Explore Moderation
          </button>
          <button
            type="button"
            className={tab === 'teams' ? 'btn' : 'btn secondary'}
            onClick={() => setTab('teams')}>
            Teams &amp; Challenges
          </button>
        </div>
      </div>

      {tab === 'explore' ? (
        <>
          <div className="toolbar" style={{ marginBottom: 16 }}>
            <div className="tabs">
              {(
                [
                  ['open', 'Needs action'],
                  ['resolved', 'Resolved'],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  className={filter === key ? 'btn' : 'btn secondary'}
                  onClick={() => setFilter(key)}>
                  {label}
                </button>
              ))}
            </div>
            <span className="muted">{visible.length} item(s)</span>
          </div>

          <div className="card">
            {visible.length === 0 ? (
              <p className="muted">No submissions in this tab.</p>
            ) : null}

            {visible.map(item => (
              <div
                key={item.id}
                style={{
                  padding: '16px 0',
                  borderBottom: '1px solid var(--line)',
                }}>
                <div className="toolbar" style={{ alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <span className="badge">{item.kind.toUpperCase()}</span>
                      <span className="badge">{statusLabel(item.reviewStatus)}</span>
                      <span className="badge">{visibilityLabel(item.visibility)}</span>
                    </div>
                    <strong style={{ display: 'block', marginTop: 8 }}>
                      {item.title}
                    </strong>
                    <div className="muted" style={{ marginTop: 4 }}>
                      by {item.submittedBy} · submitted {item.submittedAt} · ₹
                      {item.price}
                    </div>
                    <p style={{ margin: '8px 0 0', maxWidth: 560 }}>{item.detail}</p>
                    {item.reviewNote ? (
                      <p className="muted" style={{ margin: '8px 0 0' }}>
                        Note: {item.reviewNote}
                      </p>
                    ) : null}
                    {filter === 'open' ? (
                      <div className="field" style={{ marginTop: 12, maxWidth: 420 }}>
                        <label>Request-changes note</label>
                        <input
                          value={noteDraft[item.id] ?? item.reviewNote ?? ''}
                          onChange={e =>
                            setNoteDraft(prev => ({
                              ...prev,
                              [item.id]: e.target.value,
                            }))
                          }
                          placeholder="What should the creator fix?"
                        />
                      </div>
                    ) : null}
                  </div>

                  {filter === 'open' ? (
                    <div className="toolbar" style={{ gap: 8, flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        className="btn"
                        onClick={() =>
                          updateItem(item.id, {
                            reviewStatus: 'approved',
                            visibility: 'public',
                            reviewNote: undefined,
                          })
                        }>
                        Approve
                      </button>
                      <button
                        type="button"
                        className="btn secondary"
                        onClick={() =>
                          updateItem(item.id, {
                            reviewStatus: 'needs_changes',
                            visibility: 'followers_only',
                            reviewNote:
                              noteDraft[item.id]?.trim() ||
                              'Please update details and resubmit.',
                          })
                        }>
                        Request Changes
                      </button>
                      <button
                        type="button"
                        className="btn secondary"
                        onClick={() =>
                          updateItem(item.id, {
                            reviewStatus: 'rejected_policy',
                            visibility: 'followers_only',
                            reviewNote:
                              noteDraft[item.id]?.trim() ||
                              'Does not meet Explore guidelines.',
                          })
                        }>
                        Reject
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <>
          <div className="card" style={{ marginBottom: 16 }}>
            <h2 style={{ marginTop: 0 }}>Teams overview</h2>
            <p className="muted">{SAMPLE_TEAMS.length} teams in catalog</p>
            {SAMPLE_TEAMS.map(team => (
              <div
                key={team.id}
                style={{
                  padding: '12px 0',
                  borderBottom: '1px solid var(--line)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 12,
                }}>
                <div>
                  <strong>{team.name}</strong>
                  <div className="muted">
                    {team.sport} · {team.members} members
                  </div>
                </div>
                <span className="badge">{team.id}</span>
              </div>
            ))}
          </div>

          <div className="card" style={{ marginBottom: 16 }}>
            <h2 style={{ marginTop: 0 }}>Challenges</h2>
            {SAMPLE_CHALLENGES.map(chal => (
              <div
                key={chal.id}
                style={{
                  padding: '12px 0',
                  borderBottom: '1px solid var(--line)',
                }}>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <span className="badge">{chal.status.toUpperCase()}</span>
                </div>
                <strong style={{ display: 'block', marginTop: 8 }}>{chal.title}</strong>
                <div className="muted" style={{ marginTop: 4 }}>
                  {chal.organizer} · {chal.participants.toLocaleString()} participants
                </div>
              </div>
            ))}
          </div>

          <div className="card">
            <h2 style={{ marginTop: 0 }}>Pending team join requests</h2>
            {pendingJoins.length === 0 ? (
              <p className="muted">No pending requests.</p>
            ) : null}
            {pendingJoins.map(req => (
              <div
                key={req.id}
                className="toolbar"
                style={{
                  padding: '12px 0',
                  borderBottom: '1px solid var(--line)',
                  alignItems: 'center',
                }}>
                <div style={{ flex: 1 }}>
                  <strong>{req.userName}</strong>
                  <div className="muted">
                    wants to join {req.teamName} · {req.requestedAt}
                  </div>
                </div>
                <button
                  type="button"
                  className="btn"
                  onClick={() => resolveJoin(req.id, true)}>
                  Accept
                </button>
                <button
                  type="button"
                  className="btn secondary"
                  onClick={() => resolveJoin(req.id, false)}>
                  Reject
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </AdminShell>
  );
}
