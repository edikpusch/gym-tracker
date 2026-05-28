This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Android Offline Test

1. Install dependencies if needed with `npm install`.
2. Build once with `npm run build`.
3. Start production with `npm run start -- --hostname 0.0.0.0`.
4. Open `http://DEINE-IP:3000` on your Android phone while both devices are in the same WLAN.
5. In Chrome on Android choose `Zum Startbildschirm hinzufuegen`.
6. Open the installed app once while online so the app shell is cached.
7. Disable WLAN/mobile data and test the workout flow offline in the gym.

Firestore persistence is enabled. Offline-created sets stay on the device first and sync automatically when the phone is online again.

## Android App (Capacitor)

The project is prepared for a native Android wrapper via Capacitor.

Useful commands:

1. `npm run build:capacitor`
2. `npm run cap:sync`
3. `npm run cap:open:android`

Notes:

- The static app export is written to `out/`
- The Android project lives in `android/`
- After web changes for the APK, run `npm run build:capacitor` and then `npm run cap:sync`

## iOS App (Capacitor)

The project is prepared so the same static export can also be synced into an iOS Capacitor shell.

Useful commands:

1. `npm run build:capacitor`
2. `npm run cap:add:ios`
3. `npm run cap:sync`
4. `npm run cap:open:ios`

Notes:

- `@capacitor/ios` and `@capacitor/preferences` are already part of the project dependencies
- The iOS project will live in `ios/` after running `npx cap add ios` on a Mac
- Building, signing, simulator testing and deployment for iPhone still require `macOS` with `Xcode`
- Safe-area handling for notch and home-indicator is enabled in the app layout
- Rest timer notifications now avoid Android-only channel settings when running on iOS
- App data is prepared for native storage mirroring via Capacitor Preferences

### Mac handoff steps

When you have temporary access to a Mac:

1. Clone or open this project on the Mac
2. Run `npm install`
3. Run `npm run build:capacitor`
4. Run `npm run cap:add:ios` once
5. Run `npm run cap:sync`
6. Open Xcode with `npm run cap:open:ios`
7. Configure signing, test on a real iPhone, then create a TestFlight/App Store build

Detailed first-run checklist:

- `docs/IOS_FIRST_RUN_CHECKLIST.md`

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
