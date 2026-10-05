'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { AdminShell } from '@/components/AdminShell';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth';

type Notification = {
  id: string;
  mobileUserId: string;
  type: string;
  title: string;
  body: string;
  data: Record<string, unknown> | null;
  readAt: string | null;
  createdAt: string;
};

type MobileUser = {
  id: string;
  phone: string;
  displayName: string;
};

const NOTIFICATION_TYPES = [
  'booking_confirmed',
  'booking_cancelled',
  'booking_reminder',
  'provider_assigned',
  'status_update',
  'new_message',
  'community_post_comment',
  'community_post_like',
  'order_confirmed',
  'order_shipped',
  'order_delivered',
  'system',
];

export default function NotificationsPage() {
  const { hasPermission } = useAuth();
  const qc = useQueryClient();
  const [selectedUserId, setSelectedUserId] = useState('');
  const [notificationTitle, setNotificationTitle] = useState('');
  const [notificationBody, setNotificationBody] = useState('');
  const [notificationType, setNotificationType] = useState('system');
  const [userQuery, setUserQuery] = useState('');

  const users = useQuery({
    queryKey: ['admin', 'mobile-users', userQuery],
    queryFn: () =>
      apiFetch<{ data: MobileUser[] }>(
        `/admin/users/mobile?q=${encodeURIComponent(userQuery)}&limit=10`
      ),
    enabled: hasPermission('catalog.read') && userQuery.length > 0,
  });

  const recentNotifications = useQuery({
    queryKey: ['admin', 'notifications', selectedUserId],
    queryFn: () =>
      apiFetch<{ notifications: Notification[]; nextCursor: string | null; unreadCount: number }>(
        `/admin/notifications/recent?userId=${selectedUserId}`
      ),
    enabled: hasPermission('catalog.read') && selectedUserId.length > 0,
  });

  const sendTestNotification = useMutation({
    mutationFn: (input: {
      userId: string;
      title: string;
      body: string;
      type: string;
    }) =>
      apiFetch('/admin/notifications/send-test', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'notifications'] });
      setNotificationTitle('');
      setNotificationBody('');
      alert('Test notification sent successfully');
    },
  });

  const handleSendTest = () => {
    if (!selectedUserId || !notificationTitle || !notificationBody) {
      alert('Please select a user and enter title and body');
      return;
    }

    sendTestNotification.mutate({
      userId: selectedUserId,
      title: notificationTitle,
      body: notificationBody,
      type: notificationType,
    });
  };

  return (
    <AdminShell>
      <h1 className="page-title">Push Notifications</h1>
      <p className="page-sub">
        Send test push notifications to mobile users and view recent notification
        history.
      </p>

      <div className="grid-2">
        <div className="card">
          <h3>Send Test Notification</h3>

          <div style={{ marginBottom: 16 }}>
            <label>
              <div style={{ marginBottom: 4 }}>Search User by Phone or Name</div>
              <input
                type="text"
                className="input"
                value={userQuery}
                onChange={(e) => setUserQuery(e.target.value)}
                placeholder="Enter phone or name..."
              />
            </label>
          </div>

          {users.data && users.data.data.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <label>
                <div style={{ marginBottom: 4 }}>Select User</div>
                <select
                  className="input"
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                >
                  <option value="">-- Select a user --</option>
                  {users.data.data.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.displayName} ({user.phone})
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}

          {users.isLoading && <p className="muted">Loading users...</p>}

          <div style={{ marginBottom: 16 }}>
            <label>
              <div style={{ marginBottom: 4 }}>Notification Type</div>
              <select
                className="input"
                value={notificationType}
                onChange={(e) => setNotificationType(e.target.value)}
              >
                {NOTIFICATION_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label>
              <div style={{ marginBottom: 4 }}>Title</div>
              <input
                type="text"
                className="input"
                value={notificationTitle}
                onChange={(e) => setNotificationTitle(e.target.value)}
                placeholder="Notification title"
                maxLength={100}
              />
            </label>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label>
              <div style={{ marginBottom: 4 }}>Body</div>
              <textarea
                className="input"
                value={notificationBody}
                onChange={(e) => setNotificationBody(e.target.value)}
                placeholder="Notification body"
                maxLength={500}
                rows={4}
              />
            </label>
          </div>

          <button
            type="button"
            className="btn"
            disabled={
              !selectedUserId ||
              !notificationTitle ||
              !notificationBody ||
              sendTestNotification.isPending
            }
            onClick={handleSendTest}
          >
            {sendTestNotification.isPending ? 'Sending...' : 'Send Test Notification'}
          </button>

          {sendTestNotification.isError && (
            <p className="error" style={{ marginTop: 8 }}>
              {(sendTestNotification.error as Error).message}
            </p>
          )}
        </div>

        <div className="card">
          <h3>Recent Notifications</h3>
          {!selectedUserId && (
            <p className="muted">Select a user to view their recent notifications</p>
          )}

          {selectedUserId && recentNotifications.isLoading && (
            <p className="muted">Loading...</p>
          )}

          {selectedUserId && recentNotifications.error && (
            <p className="error">
              {(recentNotifications.error as Error).message}
            </p>
          )}

          {selectedUserId && recentNotifications.data && (
            <>
              <p className="muted" style={{ marginBottom: 12 }}>
                Unread: {recentNotifications.data.unreadCount} | Total:{' '}
                {recentNotifications.data.notifications.length}
              </p>
              <div style={{ maxHeight: 500, overflowY: 'auto' }}>
                {recentNotifications.data.notifications.length === 0 && (
                  <p className="muted">No notifications found</p>
                )}
                {recentNotifications.data.notifications.map((notif) => (
                  <div
                    key={notif.id}
                    style={{
                      padding: 12,
                      marginBottom: 8,
                      border: '1px solid #ddd',
                      borderRadius: 4,
                      backgroundColor: notif.readAt ? '#fff' : '#f0f8ff',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <strong>{notif.title}</strong>
                      <span className="badge">{notif.type}</span>
                    </div>
                    <p style={{ margin: '4px 0', color: '#666' }}>{notif.body}</p>
                    <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>
                      {new Date(notif.createdAt).toLocaleString()}
                      {notif.readAt && ' • Read'}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </AdminShell>
  );
}
