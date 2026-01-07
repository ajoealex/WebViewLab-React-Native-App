import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { WebView } from "react-native-webview";

const UA_MOBILE =
  "Mozilla/5.0 (Linux; Android 12; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36";

const THEME = {
  canvas: "#f7f1eb",
  ink: "#0f172a",
  inkSoft: "#1f2937",
  muted: "#6b7280",
  line: "#e2e8f0",
  surface: "#ffffff",
  surfaceAlt: "#f8fafc",
  accent: "#f97316",
  accentDark: "#c2410c",
  accentSoft: "#ffedd5",
  success: "#10b981",
  danger: "#ef4444",
  shadow: "rgba(15, 23, 42, 0.16)"
};

const TITLE_FONT = Platform.select({
  ios: "AvenirNext-DemiBold",
  android: "sans-serif-condensed",
  default: "sans-serif"
});

const BODY_FONT = Platform.select({
  ios: "AvenirNext-Regular",
  android: "sans-serif",
  default: "sans-serif"
});

// Compact button
const ToolbarButton = ({ title, onPress, disabled, variant = "primary" }) => (
  <TouchableOpacity
    onPress={onPress}
    disabled={disabled}
    style={[
      styles.buttonBase,
      variant === "primary" ? styles.buttonPrimary : styles.buttonSecondary,
      disabled && styles.buttonDisabled
    ]}
  >
    <Text
      style={[
        styles.buttonText,
        variant === "primary" && styles.buttonTextOnPrimary,
        disabled && styles.buttonTextDisabled
      ]}
    >
      {title}
    </Text>
  </TouchableOpacity>
);

// Floating right-edge button
const FloatingBtn = ({ label, onPress, disabled, marginTop = 0 }) => (
  <TouchableOpacity
    onPress={onPress}
    disabled={disabled}
    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
    style={[styles.floatingButton, marginTop ? { marginTop } : null, disabled && styles.floatingButtonDisabled]}
  >
    <Text style={styles.floatingButtonText}>{label}</Text>
  </TouchableOpacity>
);

export default function App() {
  const webRef = useRef(null);
  const { height: winH, width: winW } = useWindowDimensions();

  // Explicit view router: "home" | "web" | "shot"
  const [view, setView] = useState("home");

  // URL mode
  const [inputUrl, setInputUrl] = useState("https://www.amazon.in/");
  const [currentUrl, setCurrentUrl] = useState("");
  const [canGoBack, setCanGoBack] = useState(false);
  const [loading, setLoading] = useState(false);
  const [lastError, setLastError] = useState("");

  // WebView overlay toggle
  const [showCoords, setShowCoords] = useState(true);

  // Screenshot mode
  const [picked, setPicked] = useState(null); // { uri, width, height }
  const [containerLayout, setContainerLayout] = useState({ w: 0, h: 0 });
  const [tapPoint, setTapPoint] = useState(null); // { dx, dy, ox, oy } for image; { dx, dy } for web
  const [displayDims, setDisplayDims] = useState({
    w: 0,
    h: 0,
    offsetX: 0,
    offsetY: 0,
    scale: 1
  });

  const normalizeUrl = (val) => {
    if (!val) return "";
    const trimmed = val.trim();
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    return `https://${trimmed}`;
  };

  // Go: screenshot takes precedence
  const onGo = useCallback(() => {
    setLastError("");
    setTapPoint(null);

    if (picked?.uri) {
      setCurrentUrl("");
      setCanGoBack(false);
      setView("shot");
      return;
    }

    const u = normalizeUrl(inputUrl);
    setCurrentUrl(u);
    setCanGoBack(false);
    setView("web");
  }, [inputUrl, picked]);

  // Android hardware Back
  useEffect(() => {
    if (Platform.OS !== "android") return;
    const handler = () => {
      if (view === "web" && webRef.current && canGoBack) {
        webRef.current.goBack();
        return true;
      }
      if (view === "shot") {
        setView("home");
        return true;
      }
      return false;
    };
    const sub = BackHandler.addEventListener("hardwareBackPress", handler);
    return () => sub.remove();
  }, [view, canGoBack]);

  // Backward-compatible Image Picker
  const onPickScreenshot = useCallback(async () => {
    try {
      setTapPoint(null);

      // Permissions
      let { status } = await ImagePicker.getMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        const req = await ImagePicker.requestMediaLibraryPermissionsAsync();
        status = req.status;
      }
      if (status !== "granted") {
        setLastError("Media permission denied. Enable Photos/Media in Settings.");
        return;
      }

      // Feature detection for SDK differences
      const hasMediaTypeEnum = !!ImagePicker.MediaType;
      const hasOptionsEnum = !!ImagePicker.MediaTypeOptions;
      const hasPickerMethod = !!ImagePicker.PickerMethod;

      const launchOpts = {
        allowsEditing: false,
        quality: 1,
        selectionLimit: 1
      };

      if (hasMediaTypeEnum) {
        launchOpts.mediaTypes = [ImagePicker.MediaType.Images];
      } else if (hasOptionsEnum) {
        launchOpts.mediaTypes = ImagePicker.MediaTypeOptions.Images;
      }

      if (Platform.OS === "android" && hasPickerMethod) {
        launchOpts.pickerMethod = ImagePicker.PickerMethod.MediaLibrary;
      }

      const res = await ImagePicker.launchImageLibraryAsync(launchOpts);

      if (!res || res.canceled) return;

      const asset = Array.isArray(res.assets) ? res.assets[0] : null;
      if (!asset?.uri) {
        setLastError("No image URI returned from picker.");
        return;
      }

      let iw = asset.width || 0;
      let ih = asset.height || 0;
      if (!iw || !ih) {
        await new Promise((resolve) =>
          Image.getSize(
            asset.uri,
            (w, h) => {
              iw = w;
              ih = h;
              resolve();
            },
            () => resolve()
          )
        );
      }

      setPicked({ uri: asset.uri, width: iw || 0, height: ih || 0 });
    } catch (e) {
      setLastError(`Image pick failed: ${String(e?.message || e)}`);
    }
  }, []);

  // Fit image to container ("contain")
  useEffect(() => {
    if (view !== "shot" || !picked || !containerLayout.w || !containerLayout.h) return;
    const { width: iw, height: ih } = picked;
    if (!iw || !ih) {
      setDisplayDims({ w: containerLayout.w, h: containerLayout.h, offsetX: 0, offsetY: 0, scale: 1 });
      return;
    }
    const scale = Math.min(containerLayout.w / iw, containerLayout.h / ih);
    const w = iw * scale;
    const h = ih * scale;
    const offsetX = (containerLayout.w - w) / 2;
    const offsetY = (containerLayout.h - h) / 2;
    setDisplayDims({ w, h, offsetX, offsetY, scale });
  }, [view, picked, containerLayout]);

  // Tap on image -> marker + coords
  const onImagePress = useCallback(
    (evt) => {
      const { locationX, locationY } = evt.nativeEvent;
      const { offsetX, offsetY, w, h, scale } = displayDims;
      const xInImage = locationX - offsetX;
      const yInImage = locationY - offsetY;
      if (xInImage < 0 || yInImage < 0 || xInImage > w || yInImage > h) return;

      const dx = Math.round(xInImage);
      const dy = Math.round(yInImage);
      const s = scale || 1;
      const ox = Math.round(dx / s);
      const oy = Math.round(dy / s);
      setTapPoint({ dx, dy, ox, oy });
    },
    [displayDims]
  );

  const coordText = useMemo(() => {
    if (!tapPoint) return "";
    return `x:${tapPoint.dx}, y:${tapPoint.dy} | orig:${tapPoint.ox ?? "-"}px, ${tapPoint.oy ?? "-"}px`;
  }, [tapPoint]);

  // =========================
  // HOME
  // =========================
  if (view === "home") {
    return (
      <SafeAreaView style={styles.screen}>
        <View pointerEvents="none" style={styles.background}>
          <View style={styles.blobOne} />
          <View style={styles.blobTwo} />
          <View style={styles.blobThree} />
        </View>
        <ScrollView contentContainerStyle={styles.homeContent} keyboardShouldPersistTaps="handled">
          <Text style={styles.eyebrow}>Web View Visualizer</Text>
          <Text style={styles.title}>See your site inside a native shell.</Text>
          <Text style={styles.subtitle}>
            Preview how your live web app feels inside a mobile hybrid container, or upload a screenshot to capture
            tap coordinates.
          </Text>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Load a URL</Text>
            <Text style={styles.cardLabel}>Website address</Text>
            <TextInput
              value={inputUrl}
              onChangeText={setInputUrl}
              placeholder="https://target-site.example"
              keyboardType="url"
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.input}
              onSubmitEditing={onGo}
              placeholderTextColor={THEME.muted}
            />
            <View style={styles.buttonRow}>
              <ToolbarButton title="Open WebView" onPress={onGo} />
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Analyze a Screenshot</Text>
            <Text style={styles.cardLabel}>Choose an image from your device</Text>
            <View style={styles.buttonRow}>
              <ToolbarButton title="Upload Screenshot" onPress={onPickScreenshot} variant="secondary" />
              <ToolbarButton
                title="Clear"
                onPress={() => setPicked(null)}
                disabled={!picked}
                variant="secondary"
              />
            </View>
            <View style={styles.buttonRow}>
              <ToolbarButton title="Open Screenshot" onPress={onGo} disabled={!picked} />
            </View>
            {picked?.uri ? (
              <View style={styles.selectedWrap}>
                <Text style={styles.selectedText} numberOfLines={1}>
                  Selected: {picked.uri}
                </Text>
                {!!picked.width && !!picked.height ? (
                  <Text style={styles.selectedMeta}>
                    {picked.width} x {picked.height}px
                  </Text>
                ) : null}
              </View>
            ) : (
              <Text style={styles.emptyHint}>No screenshot selected.</Text>
            )}
          </View>

          {!!lastError && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{lastError}</Text>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  // =========================
  // SCREENSHOT
  // =========================
  if (view === "shot" && picked?.uri) {
    return (
      <SafeAreaView style={styles.darkScreen}>
        <View
          style={styles.darkScreen}
          onLayout={(e) => {
            const { width, height } = e.nativeEvent.layout;
            setContainerLayout({ w: width, h: height });
          }}
          onStartShouldSetResponder={() => true}
          onResponderRelease={onImagePress}
        >
          <Image source={{ uri: picked.uri }} resizeMode="contain" style={styles.full} />
          {tapPoint && (
            <View
              pointerEvents="none"
              style={[
                styles.tapDot,
                { left: displayDims.offsetX + tapPoint.dx - 6, top: displayDims.offsetY + tapPoint.dy - 6 }
              ]}
            />
          )}
        </View>

        {/* Exit only */}
        <View
          pointerEvents="box-none"
          style={styles.floatingRail}
        >
          <FloatingBtn
            label={"Exit"}
            onPress={() => {
              setView("home");
              setTapPoint(null);
            }}
          />
        </View>

        {/* Bottom-right coordinates */}
        {tapPoint && (
          <View pointerEvents="none" style={styles.coordBadge}>
            <Text style={styles.coordText}>{`x:${tapPoint.dx}, y:${tapPoint.dy} | orig:${tapPoint.ox}px, ${tapPoint.oy}px`}</Text>
          </View>
        )}
      </SafeAreaView>
    );
  }

  // =========================
  // WEBVIEW
  // =========================
  return (
    <SafeAreaView style={styles.webScreen}>
      <View style={{ flex: 1 }}>
        <WebView
          ref={webRef}
          key={`${currentUrl}`}
          source={{ uri: currentUrl }}
          userAgent={UA_MOBILE}
          javaScriptEnabled
          domStorageEnabled={false}
          thirdPartyCookiesEnabled={false}
          sharedCookiesEnabled={false}
          incognito
          cacheEnabled={false}
          setSupportMultipleWindows={false}
          allowsInlineMediaPlayback
          mixedContentMode="always"
          injectedJavaScriptBeforeContentLoaded={`
            (function() {
              function postTap(x, y, kind){
                try {
                  window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'tap', x: Math.round(x), y: Math.round(y), kind }));
                } catch (e) {}
              }
              document.addEventListener('click', function(ev){
                postTap(ev.clientX, ev.clientY, 'click');
              }, true);
              document.addEventListener('touchend', function(ev){
                try {
                  var t = ev.changedTouches && ev.changedTouches[0];
                  if (t) postTap(t.clientX, t.clientY, 'touchend');
                } catch(e) {}
              }, {passive:true, capture:true});
            })();
            true;
          `}
          onMessage={(e) => {
            try {
              const msg = JSON.parse(e.nativeEvent.data);
              if (msg?.type === "tap") {
                setTapPoint({ dx: msg.x, dy: msg.y });
              }
            } catch {}
          }}
          onLoadStart={() => {
            setLoading(true);
            setLastError("");
          }}
          onLoadEnd={() => setLoading(false)}
          onNavigationStateChange={(s) => setCanGoBack(s.canGoBack)}
          onHttpError={(e) => setLastError(`HTTP ${e.nativeEvent.statusCode} at ${e.nativeEvent.url}`)}
          onError={(e) => setLastError(String(e?.nativeEvent?.description || "Load error"))}
          pullToRefreshEnabled={Platform.OS === "android"}
          style={{ flex: 1 }}
        />

        {/* Right-side floating buttons */}
        <View
          pointerEvents="box-none"
          style={styles.floatingRail}
        >
          <FloatingBtn label={"Back"} onPress={() => webRef.current?.goBack()} disabled={!canGoBack} />
          <FloatingBtn label={"Reload"} onPress={() => webRef.current?.reload()} marginTop={16} />
          <FloatingBtn label={"L"} onPress={() => setShowCoords((v) => !v)} marginTop={16} />
          <FloatingBtn
            label={"Exit"}
            onPress={() => {
              setView("home");
              setCurrentUrl("");
              setCanGoBack(false);
              setTapPoint(null);
            }}
            marginTop={16}
          />
        </View>

        {/* Coordinates top-left (toggleable) */}
        {showCoords && tapPoint && (
          <View pointerEvents="none" style={styles.coordBadgeTop}>
            <Text style={styles.coordText}>{`x:${tapPoint.dx}, y:${tapPoint.dy}`}</Text>
          </View>
        )}
      </View>

      {loading ? (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: 8,
            left: 0,
            right: 0,
            alignItems: "center",
            zIndex: 15
          }}
        >
          <ActivityIndicator />
        </View>
      ) : null}

      {!!lastError && (
        <View style={styles.errorToast}>
          <Text style={{ color: "#991b1b" }} numberOfLines={2}>
            {lastError}
          </Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: THEME.canvas
  },
  webScreen: {
    flex: 1,
    backgroundColor: THEME.surface
  },
  darkScreen: {
    flex: 1,
    backgroundColor: "#0b0b0b"
  },
  background: {
    ...StyleSheet.absoluteFillObject
  },
  blobOne: {
    position: "absolute",
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: "#ffe4d5",
    top: -120,
    left: -60,
    opacity: 0.95
  },
  blobTwo: {
    position: "absolute",
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: "#e0f2fe",
    top: 140,
    right: -80,
    opacity: 0.8
  },
  blobThree: {
    position: "absolute",
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: "#fde68a",
    bottom: -140,
    left: 60,
    opacity: 0.7
  },
  homeContent: {
    padding: 20,
    paddingBottom: 36
  },
  eyebrow: {
    fontSize: 12,
    letterSpacing: 2,
    textTransform: "uppercase",
    color: THEME.muted,
    marginBottom: 6,
    fontFamily: BODY_FONT
  },
  title: {
    fontSize: 30,
    lineHeight: 36,
    color: THEME.ink,
    marginBottom: 8,
    fontFamily: TITLE_FONT
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: THEME.inkSoft,
    marginBottom: 20,
    fontFamily: BODY_FONT
  },
  card: {
    backgroundColor: THEME.surface,
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: THEME.line,
    shadowColor: THEME.shadow,
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 5
  },
  cardTitle: {
    fontSize: 16,
    color: THEME.ink,
    marginBottom: 6,
    fontFamily: TITLE_FONT
  },
  cardLabel: {
    fontSize: 12,
    color: THEME.muted,
    marginBottom: 8,
    fontFamily: BODY_FONT
  },
  input: {
    borderWidth: 1,
    borderColor: THEME.line,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 48,
    backgroundColor: THEME.surfaceAlt,
    fontFamily: BODY_FONT,
    color: THEME.ink
  },
  buttonRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
    flexWrap: "wrap"
  },
  buttonBase: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    marginRight: 10,
    marginBottom: 6,
    shadowColor: THEME.shadow,
    shadowOpacity: 0.16,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3
  },
  buttonPrimary: {
    backgroundColor: THEME.accent
  },
  buttonSecondary: {
    backgroundColor: THEME.surfaceAlt,
    borderWidth: 1,
    borderColor: THEME.line
  },
  buttonDisabled: {
    backgroundColor: "#e5e7eb",
    shadowOpacity: 0
  },
  buttonText: {
    color: THEME.ink,
    fontWeight: "700",
    fontFamily: BODY_FONT
  },
  buttonTextOnPrimary: {
    color: "#ffffff"
  },
  buttonTextDisabled: {
    color: "#9ca3af"
  },
  selectedWrap: {
    marginTop: 8
  },
  selectedText: {
    color: THEME.inkSoft,
    fontFamily: BODY_FONT
  },
  selectedMeta: {
    marginTop: 4,
    color: THEME.muted,
    fontFamily: BODY_FONT
  },
  emptyHint: {
    marginTop: 8,
    color: THEME.muted,
    fontFamily: BODY_FONT
  },
  errorBox: {
    marginTop: 10,
    padding: 12,
    backgroundColor: "#fef2f2",
    borderColor: "#fecaca",
    borderWidth: 1,
    borderRadius: 12
  },
  errorText: {
    color: "#991b1b",
    fontFamily: BODY_FONT
  },
  full: {
    width: "100%",
    height: "100%"
  },
  tapDot: {
    position: "absolute",
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: THEME.success,
    borderWidth: 2,
    borderColor: "#047857"
  },
  floatingRail: {
    position: "absolute",
    top: 0,
    bottom: 0,
    right: 12,
    width: 60,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 20,
    elevation: 20
  },
  floatingButton: {
    alignItems: "center",
    justifyContent: "center",
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(15, 23, 42, 0.92)",
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8
  },
  floatingButtonDisabled: {
    backgroundColor: "rgba(15, 23, 42, 0.35)"
  },
  floatingButtonText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
    fontFamily: BODY_FONT
  },
  coordBadge: {
    position: "absolute",
    right: 12,
    bottom: 12,
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10
  },
  coordBadgeTop: {
    position: "absolute",
    top: 12,
    left: 12,
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    zIndex: 25
  },
  coordText: {
    color: "#fff",
    fontWeight: "700",
    fontFamily: BODY_FONT
  },
  errorToast: {
    position: "absolute",
    bottom: 12,
    left: 12,
    right: 12,
    padding: 10,
    backgroundColor: "#fef2f2",
    borderWidth: 1,
    borderColor: "#fecaca",
    borderRadius: 12,
    zIndex: 15
  }
});


