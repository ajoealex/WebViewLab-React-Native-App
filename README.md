# WebViewLab
### Hybrid Testing Harness for Appium and WebView-Based Apps

WebViewLab is a lightweight **React Native / Expo utility app** built for **hybrid app developers** and **QA engineers** who need to test and validate **web applications inside a native WebView container**.

It enables rapid visual and functional verification of web UIs on **real devices and emulators** without rebuilding APKs for every change, making it ideal during the early and mid phases of hybrid app development.

---

## 🎯 Why WebViewLab Exists

When building hybrid apps, web content often behaves differently inside a native WebView compared to desktop or mobile browsers.

Common issues include:
- Layout shifts and viewport inconsistencies
- Font rendering and scaling differences
- Keyboard and focus behavior
- Safe-area and scrolling problems
- Appium context and selector mismatches

WebViewLab provides a **reusable native shell** that allows teams to validate these issues early, fast, and repeatedly.

---

## 🧩 What WebViewLab Solves

### Test Web Apps Inside a Native Shell
- Load any URL into a full-screen WebView
- Use a mobile user agent
- Allow Appium to switch to `WEBVIEW_*` context and inspect DOM elements directly

### Validate Appium Automation Mapping
- Cross-check how HTML elements translate into Appium XML trees
- Compare native vs web contexts in hybrid flows
- Verify accessibility identifiers and DOM mappings before writing automation

### Simulate Touch and Coordinate-Based Flows
- Load static UI screenshots
- Tap anywhere to capture exact coordinates
- Replicate gestures and touch positions without live HTML

---

## 🔑 Key Use Cases

- Validate how a web app visually renders inside a real native WebView
- Test hybrid UI behavior on emulators and physical devices
- Verify accessibility IDs and selectors for Appium automation
- Debug DOM-to-native mapping issues in hybrid apps
- Analyze tap coordinates for gesture-based flows
- Reduce APK rebuild cycles during rapid web UI iteration

---

## 🧱 High-Level Architecture

```
┌──────────────────────────────┐
│        Web Application       │
│  (Under Development / QA)    │
│                              │
│  HTML · CSS · JS · APIs       │
└──────────────┬───────────────┘
               │
               │ URL Load
               ▼
┌──────────────────────────────┐
│        WebViewLab App        │
│  React Native + Expo         │
│                              │
│  ┌────────────────────────┐ │
│  │    React Native UI     │ │
│  │  (Home / Controls)    │ │
│  └───────────┬────────────┘ │
│              │               │
│  ┌───────────▼────────────┐ │
│  │     WebView Layer      │ │
│  │ react-native-webview  │ │
│  │ Mobile User Agent     │ │
│  └───────────┬────────────┘ │
│              │               │
│  ┌───────────▼────────────┐ │
│  │ Screenshot Mode        │ │
│  │ Tap + Coordinate Map  │ │
│  └────────────────────────┘ │
└──────────────┬───────────────┘
               │
               │ WebView Debugging Enabled
               ▼
┌──────────────────────────────┐
│           Appium             │
│                              │
│  Native Context              │
│  WEBVIEW_* Context           │
│  DOM / XML Inspection        │
└──────────────────────────────┘
```

---

## 📱 App Screens and Modes

### 1. Home Screen
- Input a URL to launch WebView mode
- Upload a screenshot to launch Screenshot mode
- Basic error handling for load and permission failures

### 2. WebView Mode
- Full-screen WebView with mobile configuration
- Floating controls: Back, Reload, Toggle Overlay, Exit
- Overlay displays last tap coordinates
- Appium attachable via `WEBVIEW_com.example.webviewlab`

### 3. Screenshot Mode
- Displays image full-screen and scaled to fit device
- Tapping shows visual marker and pixel coordinates
- Useful for gesture planning and automation replication

---

## ⚙️ Technical Overview

- React Native with Expo
- react-native-webview for hybrid rendering
- expo-image-picker for screenshot uploads
- WebView debugging enabled for Appium and Chrome DevTools
- usesCleartextTraffic enabled for http test URLs

---

## 🖥️ Development Setup (Windows)

### Prerequisites
- Node.js LTS
- JDK 11
- Android SDK (Platform 35, Build Tools 35)

### Environment Variables
```
JAVA_HOME=<JDK11 path>
ANDROID_SDK_ROOT=<SDK root>
```

### Install Dependencies
```bash
npm ci
```

---

## 🖥️ Build Options

### EAS Build
```bash
npm install -g eas-cli
eas login
eas build --platform android
```

### Local APK Build
```bash
npx expo prebuild -p android
cd android
./gradlew assembleRelease
```

Enable WebView debugging in `MainApplication.kt`:
```kotlin
WebView.setWebContentsDebuggingEnabled(true)
```

---

## 📄 License

MIT License
