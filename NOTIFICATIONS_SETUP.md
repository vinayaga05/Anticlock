# Notifications Setup Guide

This document describes the manual setup steps required to enable push notifications in the Anticlock app.

## Prerequisites

1. **Firebase Project**: Create a Firebase project at https://console.firebase.google.com/
2. **FCM Configuration**: Enable Firebase Cloud Messaging (FCM) in your Firebase project

## Backend Setup (API)

### 1. Firebase Service Account

1. In Firebase Console, go to Project Settings → Service Accounts
2. Click "Generate new private key" to download the JSON file
3. Add the JSON content as an environment variable in your API deployment:

```bash
FIREBASE_SERVICE_ACCOUNT_JSON='{"type":"service_account","project_id":"...","private_key":"...","client_email":"..."}'
```

4. Update `apps/api/.env` for local development (never commit this file)

### 2. Run Migrations

```bash
cd apps/api
pnpm db:migrate
```

This creates the `notifications` and `device_tokens` tables.

## Mobile Setup (Android)

### 1. Add google-services.json

1. In Firebase Console, go to Project Settings → General
2. Under "Your apps", add an Android app or select existing one
3. Download `google-services.json`
4. Place it at: `apps/mobile/android/app/google-services.json`
5. **DO NOT commit this file** (already in .gitignore)

### 2. Gradle Configuration

The following changes are already in the codebase:

- `android/build.gradle`: Added `google-services` classpath
- `android/app/build.gradle`: Applied `com.google.gms.google-services` plugin
- `AndroidManifest.xml`: Added `POST_NOTIFICATIONS` permission

### 3. Build the App

```bash
cd apps/mobile
pnpm android
```

## Mobile Setup (iOS)

### 1. Add GoogleService-Info.plist

1. In Firebase Console, go to Project Settings → General
2. Under "Your apps", add an iOS app or select existing one
3. Download `GoogleService-Info.plist`
4. Add it to your Xcode project: `apps/mobile/ios/Anticlock/GoogleService-Info.plist`
5. **DO NOT commit this file** (already in .gitignore)

### 2. Configure APNs

1. In Firebase Console, go to Project Settings → Cloud Messaging
2. Under "Apple app configuration", upload your APNs certificate or key
3. Ensure your app has the "Push Notifications" capability enabled in Xcode

### 3. Install Pods

```bash
cd apps/mobile/ios
pod install
```

### 4. Build the App

```bash
cd apps/mobile
pnpm ios
```

## Testing

### Test Notifications from Admin Panel

1. Navigate to `/notifications` in the admin app
2. Search for a mobile user by phone or name
3. Enter notification title and body
4. Click "Send Test Notification"

### Verify in Mobile App

1. Log in to the mobile app
2. Device token should be automatically registered on login
3. Navigate to the "Knock" tab to see notifications
4. Test foreground notifications (app open)
5. Test background notifications (app minimized)
6. Test quit notifications (app closed, tap notification to open)

## Features

### API Routes

- `POST /v1/devices` - Register FCM token
- `DELETE /v1/devices` - Unregister FCM token
- `GET /v1/notifications` - List notifications (cursor pagination)
- `GET /v1/notifications/unread-count` - Get unread count
- `POST /v1/notifications/:id/read` - Mark notification as read
- `POST /v1/notifications/read-all` - Mark all as read
- `DELETE /v1/notifications/:id` - Delete notification
- `POST /admin/notifications/send-test` - Send test notification (admin)
- `GET /admin/notifications/recent` - List recent notifications (admin)

### Notification Types

- `booking_confirmed`, `booking_cancelled`, `booking_reminder`
- `provider_assigned`, `status_update`
- `new_message`
- `community_post_comment`, `community_post_like`
- `order_confirmed`, `order_shipped`, `order_delivered`
- `system`

### Mobile Features

- Automatic device token registration on login
- Automatic unregistration on logout
- Token refresh handling
- Foreground notification handling
- Background/quit notification tap handling
- Unread badge count
- Mark read/all read
- Loading/error/empty states
- Mock fallback when API is disabled

## Integration Points

To send notifications from business logic, use the `NotificationService`:

```typescript
import { notificationService } from './notifications/NotificationService.js';

await notificationService.notifyUser(userId, {
  type: 'booking_confirmed',
  title: 'Booking Confirmed',
  body: 'Your appointment is scheduled for tomorrow at 3 PM',
  data: { bookingId: '...' },
});
```

The service will:
1. Create a notification record in the database
2. Send push notifications to all registered devices
3. Automatically remove invalid tokens
4. Log warnings if Firebase is not configured

## Troubleshooting

### Push Not Received

1. Check device token is registered: Admin → Notifications → Select user
2. Verify `FIREBASE_SERVICE_ACCOUNT_JSON` is set in API environment
3. Check API logs for FCM errors
4. Verify `google-services.json` / `GoogleService-Info.plist` are present
5. On Android 13+, ensure POST_NOTIFICATIONS permission is granted

### Build Errors (Android)

- Ensure `google-services.json` exists at `apps/mobile/android/app/google-services.json`
- Run `cd android && ./gradlew clean`
- Rebuild

### Build Errors (iOS)

- Ensure `GoogleService-Info.plist` is in Xcode project
- Run `cd ios && pod install`
- Clean build folder in Xcode
- Rebuild
