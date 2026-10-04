# Deep Links Documentation

Deep links allow users to navigate directly to specific screens in the Anticlock mobile app from external sources (web, notifications, QR codes, etc.).

## Supported Link Types

### 1. Custom Scheme
- Format: `anticlock://path`
- Works on both Android and iOS
- Always opens the app directly

### 2. Universal Links (iOS) / App Links (Android)
- Format: `https://anticlock.online/path` or `https://www.anticlock.online/path`
- Opens in app if installed, otherwise opens in browser
- Requires additional setup (see below)

## Supported Screens

| Screen | Custom Scheme | HTTPS Link | Notes |
|--------|---------------|------------|-------|
| **Content** |
| Flash feed | `anticlock://flash` | `https://anticlock.online/flash` | Main Flash/posts tab |
| Reel feed | `anticlock://reels` | `https://anticlock.online/reels` | Main Clips/reels tab |
| Specific reel | `anticlock://reels/:reelId` | `https://anticlock.online/reels/:reelId` | Opens specific reel by ID |
| Flash comments | `anticlock://flash/:postId/comments` | `https://anticlock.online/flash/:postId/comments` | |
| Story viewer | `anticlock://story/:authorId` | `https://anticlock.online/story/:authorId` | |
| Saved hub | `anticlock://saved` | `https://anticlock.online/saved` | |
| **Profile** |
| User profile | `anticlock://profile/:userId` | `https://anticlock.online/profile/:userId` | Optional userId (shows own profile if omitted) |
| Account settings | `anticlock://settings` | `https://anticlock.online/settings` | |
| Edit profile | `anticlock://edit-profile` | `https://anticlock.online/edit-profile` | |
| **Community** |
| Communities | `anticlock://communities` | `https://anticlock.online/communities` | |
| Community tab | `anticlock://community` | `https://anticlock.online/community` | Main tab |
| Team detail | `anticlock://team/:teamId` | `https://anticlock.online/team/:teamId` | |
| Challenge detail | `anticlock://challenge/:challengeId` | `https://anticlock.online/challenge/:challengeId` | |
| **Shop & Services** |
| Shop tab | `anticlock://shop` | `https://anticlock.online/shop` | Supports ?q=search&categoryId=id |
| Course detail | `anticlock://course/:courseId` | `https://anticlock.online/course/:courseId` | |
| Event detail | `anticlock://event/:eventId` | `https://anticlock.online/event/:eventId` | |
| Product detail | `anticlock://product/:productId` | `https://anticlock.online/product/:productId` | |
| Service tree | `anticlock://services/:treeId` | `https://anticlock.online/services/:treeId` | |
| Checkout | `anticlock://checkout` | `https://anticlock.online/checkout` | |
| My learning | `anticlock://learning` | `https://anticlock.online/learning` | |
| My trips | `anticlock://trips` | `https://anticlock.online/trips` | |
| My orders | `anticlock://orders` | `https://anticlock.online/orders` | |
| **Booking** |
| Bookings tab | `anticlock://knock` | `https://anticlock.online/knock` | Supports ?initialTab=bookings |
| My bookings | `anticlock://bookings` | `https://anticlock.online/bookings` | |
| Doctors | `anticlock://doctors` | `https://anticlock.online/doctors` | |
| Doctor profile | `anticlock://doctor/:doctorId` | `https://anticlock.online/doctor/:doctorId` | |
| **Messaging** |
| Inbox | `anticlock://inbox` | `https://anticlock.online/inbox` | |
| Thread | `anticlock://thread/:conversationId` | `https://anticlock.online/thread/:conversationId` | |
| Knock tab | `anticlock://knock` | `https://anticlock.online/knock` | Supports ?initialTab=notifications/bookings/chat |
| **Provider** |
| Provider dashboard | `anticlock://provider/dashboard` | `https://anticlock.online/provider/dashboard` | |

## Authentication Handling

When a user clicks a deep link while **not logged in**:
1. The link is stored locally
2. User is shown the login screen
3. After successful login, the user is automatically navigated to the originally requested screen

## Testing

### Android Testing

#### Using ADB (Android Debug Bridge)

```bash
# Test custom scheme
adb shell am start -a android.intent.action.VIEW -d "anticlock://reels/123"

# Test universal link (HTTPS)
adb shell am start -a android.intent.action.VIEW -d "https://anticlock.online/reels/123"

# Test profile link
adb shell am start -a android.intent.action.VIEW -d "anticlock://profile/user456"

# Test shop with query params
adb shell am start -a android.intent.action.VIEW -d "anticlock://shop?q=yoga&categoryId=wellness"
```

### iOS Testing

#### Using Simulator

```bash
# Test custom scheme
xcrun simctl openurl booted "anticlock://reels/123"

# Test universal link (HTTPS)
xcrun simctl openurl booted "https://anticlock.online/reels/123"

# Test profile link
xcrun simctl openurl booted "anticlock://profile/user456"

# Test shop with query params
xcrun simctl openurl booted "anticlock://shop?q=yoga&categoryId=wellness"
```

#### Using Safari on Device/Simulator
1. Create a test HTML file with links or type URLs in Safari
2. Tap the link - it should open the app

## Production Setup Required

### Android App Links (HTTPS verification)

1. **Get SHA-256 Certificate Fingerprint:**

   **For Debug Build:**
   ```bash
   keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android
   ```

   **For Release Build:**
   ```bash
   keytool -list -v -keystore path/to/your/release.keystore -alias your-key-alias
   ```

   **For Play Store:**
   - Go to Play Console > Your App > Release > Setup > App Integrity
   - Copy the SHA-256 certificate fingerprint

2. **Configure API Environment:**
   Add to your API environment (`.env.production` or deployment config):
   ```bash
   ANDROID_SHA256_CERT_FINGERPRINTS="AA:BB:CC:...,DD:EE:FF:..."
   ```
   (Comma-separated for multiple keys, e.g., debug + release)

3. **Verify Configuration:**
   ```bash
   curl https://api.anticlock.online/.well-known/assetlinks.json
   ```

   Should return JSON with your fingerprints.

### iOS Universal Links

1. **Get Apple Team ID:**
   - Go to https://developer.apple.com/account
   - Click on "Membership" in the sidebar
   - Your Team ID is shown (10 characters, e.g., "A1B2C3D4E5")

2. **Configure API Environment:**
   ```bash
   APPLE_TEAM_ID="A1B2C3D4E5"
   IOS_BUNDLE_ID="org.reactjs.native.example.AnticlockTemp"
   ```

3. **Enable Associated Domains in Xcode:**
   - Open `apps/mobile/ios/AnticlockTemp.xcodeproj` in Xcode
   - Select the project target
   - Go to "Signing & Capabilities"
   - Add "Associated Domains" capability if not present
   - Add the entitlements file `AnticlockTemp.entitlements` to the target (it's already created)
   - Verify the domains are listed:
     - `applinks:anticlock.online`
     - `applinks:www.anticlock.online`

4. **Verify Configuration:**
   ```bash
   curl https://api.anticlock.online/.well-known/apple-app-site-association
   ```

   Should return JSON with your Team ID and Bundle ID.

5. **Apple CDN Cache:**
   - Apple caches the AASA file on their CDN
   - Changes may take a few hours to propagate
   - For immediate testing, delete and reinstall the app

## Troubleshooting

### Android

1. **Links open in browser instead of app:**
   - Verify `android:autoVerify="true"` is set in AndroidManifest.xml
   - Check assetlinks.json is accessible and contains correct fingerprints
   - Clear app data: Settings > Apps > Anticlock > Storage > Clear Data
   - On Android 12+, check: Settings > Apps > Default Apps > Opening Links > Anticlock > ensure "Open supported links" is enabled

2. **Custom scheme not working:**
   - Ensure the app is installed
   - Try clearing app data

### iOS

1. **Universal links open in Safari instead of app:**
   - Verify apple-app-site-association is accessible
   - Check Team ID and Bundle ID match
   - Delete and reinstall the app (clears Apple's CDN cache)
   - Test with custom scheme first to verify app linking code works

2. **Long press issue:**
   - If you long-press a link in Safari, it may not trigger universal link behavior
   - Tap normally or use `xcrun simctl openurl` for testing

## Implementation Details

- **Configuration file:** `apps/mobile/src/shared/navigation/linking.ts`
- **Pending link storage:** `apps/mobile/src/shared/navigation/usePendingDeepLink.ts`
- **Android manifest:** `apps/mobile/android/app/src/main/AndroidManifest.xml`
- **iOS config:** `apps/mobile/ios/AnticlockTemp/Info.plist`
- **iOS entitlements:** `apps/mobile/ios/AnticlockTemp/AnticlockTemp.entitlements`
- **API endpoints:** `apps/api/src/routes/deepLinks.ts`
