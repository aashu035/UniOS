# Build APK Plan

The goal is to generate a debug APK for the UniOS project locally. Since this is an Expo project, we will first generate the native Android project structure and then use Gradle to build the APK.

## User Review Required

> [!IMPORTANT]
> The build process will generate a native `android` directory in the project root. This directory contains the native code and build configurations required for the Android APK.
>
> The build might take several minutes depending on the system resources and network (for downloading dependencies).

## Proposed Changes

### Build Process

#### Step 1: Prebuild
Run `npx expo prebuild --platform android` to generate the `android` directory. This command will configure the native project based on `app.json`.

#### Step 2: Assemble APK
Navigate to the `android` directory and run `./gradlew assembleDebug`. This will compile the code and package it into a debug APK.

#### Step 3: Locate Artifact
The generated APK will be located at `android/app/build/outputs/apk/debug/app-debug.apk`.

## Verification Plan

### Manual Verification
- Check if the `android` directory was successfully created.
- Verify that `gradlew assembleDebug` completes without errors.
- Confirm the existence of `app-debug.apk` at the expected location.
