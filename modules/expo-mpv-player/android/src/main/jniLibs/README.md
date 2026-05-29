# libmpv JNI Libraries

This directory must contain the prebuilt libmpv `.so` binaries for each ABI.

## Required Structure

```
jniLibs/
  arm64-v8a/
    libmpv.so
  armeabi-v7a/
    libmpv.so
  x86_64/
    libmpv.so
  x86/
    libmpv.so
```

## How to Obtain

The recommended source is the [mpv-android](https://github.com/mpv-android/mpv-android) project.

### Option A: Download from mpv-android releases

1. Go to https://github.com/mpv-android/mpv-android/releases
2. Download the universal debug APK
3. Extract the `.so` files from `lib/{abi}/` inside the APK (it's a zip)
4. Place them in the above structure
5. Remove `libc++_shared.so` from each ABI (React Native already provides it)

### Option B: Build from source

1. Clone https://github.com/mpv-android/mpv-android
2. Follow their buildscripts README to compile libmpv for Android
3. Copy the resulting `.so` files here

## Pinned Version

- **mpv-android version:** 2026-03-22 release
- **Source:** https://github.com/mpv-android/mpv-android/releases/tag/2026-03-22
- **Date obtained:** 2025-07-03
