# Messages (Stream Chat) - Admin & Moderation

The Anticlock mobile app uses **Stream Chat** (getstream.io) for real-time 1:1 messaging.

## Admin Access

There is no custom admin page for messages in this codebase. All moderation and management should be done through the **Stream Dashboard**:

👉 **https://getstream.io/dashboard/**

## What You Can Do in the Stream Dashboard

- **View conversations** and message history
- **Monitor** user activity and message volume
- **Moderate content** - review flagged messages, block users
- **Export data** for compliance or auditing
- **Manage channels** - delete, archive, or modify channels
- **Configure moderation rules** and auto-moderation
- **View analytics** - message counts, active users, engagement

## Authentication

Stream users are automatically synced from the Anticlock user database when they first connect. The API endpoint `/v1/messages/token` handles:

1. Upserting the user in Stream (id, name, avatar)
2. Generating a secure token for the mobile app

## Environment Setup

Required environment variables (set in `apps/api/.env`):

```
STREAM_API_KEY=your-api-key
STREAM_API_SECRET=your-api-secret
```

Get these credentials from https://getstream.io/dashboard/

## Technical Notes

- **Channel Type**: Uses Stream's `messaging` type for 1:1 conversations
- **Channel IDs**: Deterministic (sorted user IDs: `userId1_userId2`)
- **User Sync**: Automatic on token generation
- **Authorization**: Users can only access conversations they're members of
- **No Webhooks**: Webhook integration is currently out of scope

## Future Enhancements

- Push notifications via FCM/APNs (Stream supports this)
- Webhook integration for custom business logic
- Advanced moderation automation
- Message retention policies
