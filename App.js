import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Image,
  Platform,
  SafeAreaView,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { WebView } from "react-native-webview";

const UA_MOBILE =
  "Mozilla/5.0 (Linux; Android 12; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36";

// Compact button
const ToolbarButton = ({ title, onPress, disabled }) => (
  <TouchableOpacity
    onPress={onPress}
    disabled={disabled}
    style={{
      paddingHorizontal: 12,
      paddingVertical: 10,
      backgroundColor: disabled ? "#e5e7eb" : "#111827",
      borderRadius: 8,
      marginRight: 8
    }}
  >
    <Text style={{ color: disabled ? "#9ca3af" : "#ffffff", fontWeight: "600" }}>{title}</Text>
  </TouchableOpacity>
);

// Floating right-edge button
const FloatingBtn = ({ label, onPress, disabled, marginTop = 0 }) => (
  <TouchableOpacity
    onPress={onPress}
    disabled={disabled}
    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
    style={{
      marginTop,
      alignItems: "center",
      justifyContent: "center",
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: disabled ? "rgba(17,24,39,0.35)" : "rgba(17,24,39,0.85)",
      elevation: 8
    }}
  >
    <Text style={{ color: "#fff", fontSize: 12, fontWeight: "700" }}>{label}</Text>
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
      <SafeAreaView style={{ flex: 1, backgroundColor: "#ffffff" }}>
        <ScrollView contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
          {/* URL */}
          <Text style={{ fontSize: 12, color: "#6b7280", marginBottom: 6 }}>URL:</Text>
          <TextInput
            value={inputUrl}
            onChangeText={setInputUrl}
            placeholder="https://target-site.example"
            keyboardType="url"
            autoCapitalize="none"
            autoCorrect={false}
            style={{
              borderWidth: 1,
              borderColor: "#d1d5db",
              borderRadius: 10,
              paddingHorizontal: 12,
              height: 48,
              marginBottom: 16
            }}
            onSubmitEditing={onGo}
          />

          {/* horizontal rule */}
          <View style={{ height: 1, backgroundColor: "#e5e7eb", marginVertical: 12 }} />

          {/* screenshot row */}
          <Text style={{ fontSize: 12, color: "#6b7280", marginBottom: 6 }}>or choose a screenshot:</Text>
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
            <ToolbarButton title="Upload Screenshot" onPress={onPickScreenshot} />
            <ToolbarButton title="Clear Screenshot" onPress={() => setPicked(null)} disabled={!picked} />
          </View>

          {/* selected file info */}
          {picked?.uri ? (
            <>
              <Text style={{ color: "#374151", marginTop: 4 }} numberOfLines={1}>
                Selected: {picked.uri}
              </Text>
              {!!picked.width && !!picked.height ? (
                <Text style={{ color: "#6b7280", marginTop: 2 }}>
                  {picked.width}×{picked.height}px
                </Text>
              ) : null}
            </>
          ) : null}

          {/* Go button */}
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
            <ToolbarButton title="Go" onPress={onGo} />
          </View>

          {!!lastError && (
            <View
              style={{
                marginTop: 12,
                padding: 10,
                backgroundColor: "#fef2f2",
                borderColor: "#fecaca",
                borderWidth: 1,
                borderRadius: 8
              }}
            >
              <Text style={{ color: "#991b1b" }}>{lastError}</Text>
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
      <SafeAreaView style={{ flex: 1, backgroundColor: "#000" }}>
        <View
          style={{ flex: 1, backgroundColor: "#000" }}
          onLayout={(e) => {
            const { width, height } = e.nativeEvent.layout;
            setContainerLayout({ w: width, h: height });
          }}
          onStartShouldSetResponder={() => true}
          onResponderRelease={onImagePress}
        >
          <Image source={{ uri: picked.uri }} resizeMode="contain" style={{ width: "100%", height: "100%" }} />
          {tapPoint && (
            <View
              pointerEvents="none"
              style={{
                position: "absolute",
                left: displayDims.offsetX + tapPoint.dx - 6,
                top: displayDims.offsetY + tapPoint.dy - 6,
                width: 12,
                height: 12,
                borderRadius: 6,
                backgroundColor: "#10b981",
                borderWidth: 2,
                borderColor: "#047857"
              }}
            />
          )}
        </View>

        {/* Exit only */}
        <View
          pointerEvents="box-none"
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            right: 12,
            width: 60,
            alignItems: "center",
            justifyContent: "center",
            zIndex: 20,
            elevation: 20
          }}
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
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              right: 12,
              bottom: 12,
              backgroundColor: "#000",
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderRadius: 6
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "700" }}>{`x:${tapPoint.dx}, y:${tapPoint.dy} | orig:${tapPoint.ox}px, ${tapPoint.oy}px`}</Text>
          </View>
        )}
      </SafeAreaView>
    );
  }

  // =========================
  // WEBVIEW
  // =========================
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
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
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            right: 12,
            width: 60,
            alignItems: "center",
            justifyContent: "center",
            zIndex: 20,
            elevation: 20
          }}
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
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              top: 12,
              left: 12,
              backgroundColor: "#000",
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderRadius: 6,
              zIndex: 25
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "700" }}>{`x:${tapPoint.dx}, y:${tapPoint.dy}`}</Text>
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
        <View
          style={{
            position: "absolute",
            bottom: 12,
            left: 12,
            right: 12,
            padding: 10,
            backgroundColor: "#fef2f2",
            borderWidth: 1,
            borderColor: "#fecaca",
            borderRadius: 10,
            zIndex: 15
          }}
        >
          <Text style={{ color: "#991b1b" }} numberOfLines={2}>
            {lastError}
          </Text>
        </View>
      )}
    </SafeAreaView>
  );
}
