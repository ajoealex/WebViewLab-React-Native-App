# WebViewLab — Hybrid Testing Harness for Appium

WebViewLab is a lightweight **React Native / Expo app** that helps **hybrid app developers** and **QA engineers** test, debug, and validate web apps inside a native shell.  

It removes the need to rebuild an APK for every UI change and provides an easy way to validate **accessibility IDs, DOM mappings, and tap coordinates** when working with Appium.

---

## 🎯 Purpose

WebViewLab is designed to:

- **Test Web Apps in a Native Shell**  
  Enter a URL and render it in a full-screen WebView. Appium can then switch to `WEBVIEW_*` context and inspect DOM elements directly.  

- **Simulate UI Flows with Screenshots**  
  Upload a static screenshot, display it full-screen, and tap on it to study coordinates and replicate touch interactions.  

- **Validate Appium Mappings**  
  Compare how Appium generates XML trees for hybrid apps and how different HTML elements translate between **native vs. web contexts**.  

---

## 🔑 Key Uses

- Quickly test how a web app looks and feels inside a hybrid container  
- Verify accessibility identifiers for Appium automation  
- Validate DOM-to-native mapping for hybrid app elements  
- Debug tap positions on static UI screenshots without live HTML  
- Speed up iteration cycles by avoiding repeated APK rebuilds  

---

## 📱 Screens / Views

### 1. Home Screen
- Input a URL or upload a screenshot from gallery  
- **Go** → open WebView or Screenshot mode  
- Error banner for permission/load issues  

### 2. WebView Mode
- Full-screen WebView with mobile UA  
- Floating controls: **Back, Reload, Toggle Overlay (L), Exit**  
- Overlay shows last tap coordinates  
- Appium can attach via `WEBVIEW_com.example.webviewlab`  

### 3. Screenshot Mode
- Display image full-screen, scaled to fit  
- Tapping shows a green dot at tap point  
- Coordinates shown for both display and original pixels  
- Exit returns to Home  

---

## ⚙️ Technical Notes

- **React Native + Expo**  
- `react-native-webview` for hybrid testing  
- `expo-image-picker` for screenshot uploads  
- `usesCleartextTraffic=true` in manifest (for `http://` test pages)  
- WebView debugging enabled (Appium + Chrome DevTools attachable)  

---

## 🖥️ Setup (Windows)

- Node.js LTS  
- JDK 11  
- Android SDK (Platform 35, Build Tools 35)  

Environment variables:
```
JAVA_HOME = <JDK11 path>
ANDROID_SDK_ROOT = <SDK root>
PATH += %JAVA_HOME%\bin;%ANDROID_SDK_ROOT%\platform-tools
```

Validation:
```powershell
node -v
java -version
adb version
```

Dependencies:
```bash
npm ci
# or
yarn install --frozen-lockfile
```

---

## 🏗️ Build Options

### Local Android Release Build (APK)

If `android/` folder doesn’t exist:
```bash
npx expo prebuild -p android
```

> **Critical:** Enable WebView debugging in release builds so Appium can attach.  
> Edit:
> ```
> WebViewLab-React-Native-App/android/app/src/main/java/com/example/webviewlab/MainApplication.kt
> ```
> Add:
> ```kotlin
> // Critical: expose WEBVIEW_* context even in release builds
> WebView.setWebContentsDebuggingEnabled(true)
> ```

Then build:
```powershell
cd android
.\gradlew.bat clean
.\gradlew.bat :app:assembleRelease --stacktrace --no-daemon
```

Artifacts:
- APK: `android/app/build/outputs/apk/release/app-release.apk`
- AAB: `android/app/build/outputs/bundle/release/app-release.aab`

Install to device:
```powershell
adb install -r android/app/build/outputs/apk/release/app-release.apk
```

---

## 📄 License

MIT License
