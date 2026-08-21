# Anticlock

Instagram-style health, fitness, and diagnostics app built with **React Native 0.86** and the **New Architecture** (Fabric + TurboModules + Hermes).

Inspired by Practo-style booking flows, fitness class apps, and social reels UX. UI references: [Dribbble HealthMate](https://dribbble.com/shots/25141999-HealthMate-Your-One-Stop-Healthcare-Companion), [Gym booking](https://dribbble.com/shots/15755425-Gym-booking-concept-design), [Gymmy on Behance](https://www.behance.net/gallery/238624569/Gymmy-Fitness-Class-Booking-and-Ecommerce-Mobile-App). Architecture patterns adapted from the sibling `ReelsShop` project.

## Stack

- React Native `0.86` · React `19`
- React Navigation 7 (native stack + bottom tabs)
- TanStack Query · Zustand · MMKV
- Reanimated 4 · Gesture Handler · Screens · SVG · Video
- New Architecture enabled (`android/gradle.properties` → `newArchEnabled=true`)

## Tabs

| Tab | Module |
|-----|--------|
| Home | Services hub, specialists, banners, communities entry |
| Reels | Full-screen clips with Book / Cart / Like / Comment / Save |
| Create | Upload clip, quick book, create club |
| Health | Reports grid + live / fitness tracking |
| Shop | Products + cart badge |

## Booking flows

Discover → Doctor / Lab / Class detail → Schedule (date + time) → Booking confirmed → My Bookings.

Also: Diagnostics hub, Physiotherapy hub, Search, Knock (messages), Communities.

## Run

```bash
npm install
npm start
```

iOS (after pods):

```bash
cd ios && bundle install && bundle exec pod install && cd ..
npm run ios
```

Android:

```bash
npm run android
```

Requirements: Node `>= 22.11`, Xcode / Android Studio as usual for RN 0.86.

> Note: The native project target is still named `AnticlockTemp` (from the RN template). The on-device display name is **Anticlock**. Keep `app.json` `"name"` as `AnticlockTemp` so it matches `MainActivity` / `AppDelegate` module registration.

## Project layout

```
src/
  features/   # home, reels, booking, health, shop, community, messages, create
  shared/     # navigation, theme, components, mocks, stores
```

Mock data lives in `src/shared/data/mocks.ts` (no backend in v1).
