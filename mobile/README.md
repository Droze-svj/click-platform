# Click Mobile App

React Native mobile application for Click.

## Prerequisites

- Node.js 16+
- React Native CLI
- Android Studio (for Android)
- Xcode (for iOS, macOS only)

## Installation

```bash
cd mobile
npm install
```

## iOS Setup

```bash
cd ios
pod install
cd ..
```

## Running

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
│   ├── screens/      # Screen components
│   ├── components/   # Reusable components
│   ├── navigation/   # Navigation setup
│   ├── services/     # API services
│   ├── hooks/        # Custom hooks
│   ├── utils/        # Utility functions
│   └── types/         # TypeScript types
├── android/          # Android native code
├── ios/              # iOS native code
└── package.json
```

## Features

- ✅ Authentication
- ✅ Content creation
- ✅ Video upload
- ✅ Content management
- ✅ Social media posting
- ✅ Analytics
- ✅ Offline support

## API Integration

The app connects to the same backend API:
- Base URL: `https://api.click.com` (or your API URL)
- Authentication: Bearer token
- All endpoints are compatible with the web app

## Development

1. Start Metro bundler: `npm start`
2. Run on device/emulator: `npm run ios` or `npm run android`

## Building

### iOS
```bash
cd ios
xcodebuild -workspace Click.xcworkspace -scheme Click -configuration Release
```

### Android
```bash
cd android
./gradlew assembleRelease
```

## Notes

- The mobile app uses the same API as the web app
- Authentication tokens are stored securely
- Offline mode is supported for viewing cached content
- Push notifications can be configured for iOS and Android






