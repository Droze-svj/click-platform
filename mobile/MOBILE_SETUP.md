# Mobile App Setup Guide

## Overview

The Click mobile app is built with React Native and provides native iOS and Android experiences.

## Prerequisites

### iOS Development (macOS only)
- Xcode 14+
- CocoaPods
- Node.js 16+

### Android Development
- Android Studio
- JDK 11+
- Android SDK
- Node.js 16+

## Installation

1. **Install dependencies:**
```bash
cd mobile
npm install
```

2. **iOS Setup (macOS only):**
```bash
cd ios
pod install
cd ..
```

3. **Configure API URL:**
Create a `.env` file in the `mobile` directory:
```
API_URL=https://api.click.com/api
```

## Running the App

### iOS
```bash
npm run ios
```

### Android
```bash
npm run android
```

## Project Structure

```
mobile/
├── src/
│   ├── screens/          # Screen components
│   ├── components/       # Reusable components
│   ├── navigation/       # Navigation setup
│   ├── services/         # API services
│   ├── hooks/           # Custom hooks
│   └── utils/           # Utility functions
├── android/             # Android native code
├── ios/                 # iOS native code
├── App.tsx              # Root component
└── index.js             # Entry point
```

## Features

- ✅ Authentication (Login/Register)
- ✅ Content Management
- ✅ Video Upload
- ✅ Social Media Integration
- ✅ Analytics Dashboard
- ✅ Offline Support
- ✅ Push Notifications (ready for setup)

## API Integration

The mobile app uses the same REST API as the web app:
- Base URL: Configured via environment variable
- Authentication: Bearer token stored in AsyncStorage
- All v1 API endpoints are supported

## Building for Production

### iOS
1. Open `ios/Click.xcworkspace` in Xcode
2. Select "Any iOS Device" as target
3. Product > Archive
4. Distribute to App Store

### Android
1. Generate signing key:
```bash
keytool -genkeypair -v -storetype PKCS12 -keystore click-release.keystore -alias click -keyalg RSA -keysize 2048 -validity 10000
```

2. Configure `android/app/build.gradle` with signing config

3. Build release APK:
```bash
cd android
./gradlew assembleRelease
```

## Environment Variables

Create `.env` file:
```
API_URL=https://api.click.com/api
SENTRY_DSN=your-sentry-dsn (optional)
```

## Testing

```bash
npm test
```

## Notes

- The mobile app shares the same backend API
- Authentication tokens are stored securely using AsyncStorage
- Offline mode caches content for viewing without internet
- Push notifications require additional setup (Firebase for Android, APNs for iOS)

## Next Steps

1. Set up push notifications
2. Configure deep linking
3. Add biometric authentication
4. Implement offline-first architecture
5. Add app store assets and metadata






