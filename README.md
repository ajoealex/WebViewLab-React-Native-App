# WebViewLab --- Hybrid testing harness for Appium

## 🎯 Purpose

The app is a hybrid testing harness for Appium. It lets you:

-   Enter a URL and render it full-screen in a WebView so Appium can
    switch to `WEBVIEW_*` and inspect DOM elements.\
-   Or upload a static screenshot, display it full-screen, and simulate
    taps to study tap coordinates and test UI flows without live HTML.

This is useful for validating how Appium generates XML trees for hybrid
apps and how different HTML tags map to native vs web contexts.

## 📱 Screens / Views

### 1) Home Screen

-   URL input field to enter any target URL.\
-   Screenshot section to upload an image from gallery or clear
    selection.\
-   Go button: if a screenshot is selected it opens Screenshot mode.
    Otherwise it opens WebView mode.\
-   Error banner displays permission or page load failures.

### 2) WebView Mode

-   Loads the entered URL in a full-screen WebView with a mobile user
    agent.\
-   Floating controls on the right (vertical stack): Back, Reload, L
    (toggle tap overlay), Exit.\
-   Tap overlay shows last tap coordinates in the top-left corner.
    Toggle with the L button.\
-   Appium can switch to `WEBVIEW_com.example.webviewlab` and inspect
    HTML elements.

### 3) Screenshot Mode

-   Displays the selected image full-screen scaled to fit.\
-   Tapping shows a green dot at the tap point.\
-   Coordinates appear bottom-right for both scaled display and original
    image pixels.\
-   Exit button returns to Home.

## ⚙️ Technical Notes

-   Built with Expo and React Native.\
-   Uses `react-native-webview` for hybrid testing.\
-   Uses `expo-image-picker` to upload screenshots.\
-   Android manifest config includes `usesCleartextTraffic=true` to
    allow `http://` test pages.\
-   WebView debugging is enabled in Android native code so Appium and
    Chrome DevTools can attach in release.

------------------------------------------------------------------------

## 🖥️ Prerequisites on Windows

-   Node.js LTS\
-   JDK 11\
-   Android SDK with Platform 35 and Build Tools 35\
-   Environment variables
    -   `JAVA_HOME` → JDK 11 path\
    -   `ANDROID_SDK_ROOT` → Android SDK root\
    -   Add `%JAVA_HOME%\bin` and `%ANDROID_SDK_ROOT%\platform-tools` to
        `PATH`

Quick validation:

``` powershell
node -v
java -version
adb version
```

Install JS deps:

``` bash
npm ci
# or
yarn install --frozen-lockfile
```

------------------------------------------------------------------------

## 🏗️ Build Options

### A) Local Android Release Build (APK)

If the `android/` folder does not exist:

``` bash
npx expo prebuild -p android
```

Then build:

``` powershell
cd android
.\gradlew.bat clean
.\gradlew.bat :app:assembleRelease --stacktrace --no-daemon
```

Artifacts: - APK:
`android\app\build\outputs\apk\release\app-release.apk` - AAB:
`android\app\build\outputs\bundle\release\app-release.aab`

Install to device:

``` powershell
adb install -r android\app\build\outputs\apk\release\app-release.apk
```
