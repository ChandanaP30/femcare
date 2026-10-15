# Building the FemCare APK

This project is configured with **Capacitor** to wrap the web app into a native Android APK.

## Prerequisites (install on YOUR computer)

1. **Android Studio** — download from https://developer.android.com/studio
2. **Java JDK 17** — bundled with Android Studio, or install separately
3. **Node.js 18+** — https://nodejs.org

## Steps to generate the APK

### Option A: Using Android Studio (easiest)

```bash
# 1. Install dependencies
npm install

# 2. Build the web app and sync to Android
npm run cap:sync

# 3. Open the project in Android Studio
npm run cap:open
```

Android Studio will open. Then:
1. Wait for Gradle sync to finish (bottom-right corner)
2. Go to **Build > Build Bundle(s) / APK(s) > Build APK(s)**
3. The APK will be at `android/app/build/outputs/apk/debug/app-debug.apk`

### Option B: Command line (no Android Studio UI needed)

```bash
# 1. Install dependencies
npm install

# 2. Build web app + sync + compile APK
npm run apk:debug
```

The APK will be at:
```
android/app/build/outputs/apk/debug/app-debug.apk
```

### Option C: Run directly on a connected device

```bash
# Enable USB debugging on your Android phone, plug it in
npm run cap:run
```

## App Details

- **App ID:** `com.femcare.app`
- **App Name:** FemCare
- **Min Android Version:** Android 5.0 (API 22+)

## Generating a Release (signed) APK

For distribution outside of development:

```bash
# 1. Generate a keystore (one-time)
keytool -genkey -v -keystore femcare.keystore -alias femcare -keyalg RSA -keysize 2048 -validity 10000

# 2. Build release APK
cd android
./gradlew assembleRelease
```

You'll need to configure signing in `android/app/build.gradle` with your keystore.

## Troubleshooting

- **"gradlew: command not found"** — run `cd android && chmod +x gradlew`
- **"SDK location not found"** — open `android/local.properties` and add `sdk.dir=/path/to/Android/Sdk`
- **Build fails** — ensure JDK 17 is installed and `JAVA_HOME` is set
