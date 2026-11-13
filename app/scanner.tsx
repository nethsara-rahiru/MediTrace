import { useCallback, useRef, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import {
  CameraView,
  useCameraPermissions,
  type BarcodeType,
} from "expo-camera";
import { router, useFocusEffect } from "expo-router";
import {
  Camera,
  Flashlight,
  Keyboard,
  ScanLine,
  ShieldCheck,
} from "lucide-react-native";
import {
  Page,
  Back,
  Heading,
  Card,
  Button,
  Field,
  Chips,
  Notice,
} from "../src/components/ui";
import { colors } from "../src/theme";
const barcodeTypes: BarcodeType[] = [
  "ean13",
  "ean8",
  "upc_a",
  "upc_e",
  "code128",
  "qr",
  "datamatrix",
];
export default function Scanner() {
  const [permission, requestPermission] = useCameraPermissions(),
    [torch, setTorch] = useState(false),
    [active, setActive] = useState(false),
    [cameraError, setCameraError] = useState("");
  const [manual, setManual] = useState(false),
    [value, setValue] = useState(""),
    [format, setFormat] = useState("Auto");
  const locked = useRef(false);
  useFocusEffect(
    useCallback(() => {
      locked.current = false;
      setActive(true);
      return () => {
        setActive(false);
      };
    }, []),
  );
  function scan(raw: string, type: string) {
    if (locked.current || !raw.trim()) return;
    locked.current = true;
    router.push({ pathname: "/scan-result", params: { raw, format: type } });
  }
  return (
    <Page>
      <Back />
      <Heading
        title="Scan a medicine"
        subtitle="Point your camera at a code on the package. We’ll check your local library first."
      />
      <View style={s.cameraWrap}>
        {active && permission?.granted && !manual && !cameraError ? (
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            enableTorch={torch}
            barcodeScannerSettings={{ barcodeTypes }}
            onMountError={(e) => setCameraError(e.message)}
            onBarcodeScanned={(r) => scan(r.raw || r.data, r.type)}
          />
        ) : (
          <View style={s.cameraEmpty}>
            <Camera size={46} color="#91B9B8" />
            <Text style={s.cameraTitle}>
              {manual
                ? "Manual entry selected"
                : cameraError
                  ? "Camera unavailable"
                  : permission?.granted
                    ? "Camera paused"
                    : "Your camera, your control"}
            </Text>
            <Text style={s.cameraText}>
              {cameraError ||
                "Camera access is used to read packaging codes. Images are not uploaded or saved."}
            </Text>
            {!permission?.granted && !manual && (
              <Button
                title="Allow camera access"
                onPress={() =>
                  void requestPermission().catch((e) =>
                    setCameraError(e.message),
                  )
                }
              />
            )}
          </View>
        )}
        {permission?.granted && !manual && !cameraError && (
          <View pointerEvents="none" style={s.overlay}>
            <View style={s.scanFrame}>
              <ScanLine color="rgba(255,255,255,.3)" size={45} />
            </View>
            <Text style={s.scanTip}>
              Align the packaging code inside the frame
            </Text>
          </View>
        )}
        <View style={s.cameraBottom}>
          <View style={s.cameraTag}>
            <View style={s.dot} />
            <Text style={s.cameraTagText}>LOCAL IDENTIFICATION</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              torch ? "Turn flashlight off" : "Turn flashlight on"
            }
            onPress={() => setTorch((v) => !v)}
            style={[s.flash, torch && { backgroundColor: colors.teal }]}
          >
            <Flashlight color="white" size={20} />
          </Pressable>
        </View>
      </View>
      <View style={{ flexDirection: "row", gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Button
            title={manual ? "Use camera" : "Enter code manually"}
            variant="secondary"
            icon={<Keyboard color={colors.teal} size={17} />}
            onPress={() => setManual((v) => !v)}
          />
        </View>
      </View>
      {manual && (
        <Card>
          <Field
            label="Barcode or QR content"
            value={value}
            onChangeText={setValue}
            placeholder="Enter the exact identifier or structured content"
            autoCapitalize="none"
            multiline
          />
          <Text style={{ color: colors.muted, fontSize: 12 }}>Format</Text>
          <Chips
            items={[
              "Auto",
              "EAN-13",
              "EAN-8",
              "UPC-A",
              "UPC-E",
              "Code 128",
              "QR",
              "GS1",
            ]}
            value={format}
            onChange={setFormat}
          />
          <Button
            title="Identify product"
            disabled={!value.trim()}
            onPress={() =>
              scan(
                value,
                (
                  {
                    Auto: "manual",
                    "EAN-13": "ean13",
                    "EAN-8": "ean8",
                    "UPC-A": "upc_a",
                    "UPC-E": "upc_e",
                    "Code 128": "code128",
                    QR: "qr",
                    GS1: "gs1",
                  } as Record<string, string>
                )[format],
              )
            }
          />
        </Card>
      )}
      <Notice>
        Supports common retail barcodes, QR and DataMatrix where supported by
        the device. GS1 parsing depends on the scanner preserving separators.
        Unknown links are never opened automatically.
      </Notice>
      {Platform.OS === "web" && (
        <Notice>
          Browser camera scanning varies by browser. Manual entry is available
          for the preview; use an Android device to validate packaging scans.
        </Notice>
      )}
    </Page>
  );
}
const s = StyleSheet.create({
  cameraWrap: {
    height: 400,
    borderRadius: 24,
    backgroundColor: "#112D35",
    overflow: "hidden",
  },
  cameraEmpty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    padding: 30,
    paddingBottom: 65,
  },
  cameraTitle: {
    fontSize: 21,
    color: "white",
    fontWeight: "600",
    textAlign: "center",
  },
  cameraText: {
    fontSize: 13,
    color: "#B0C5C8",
    textAlign: "center",
    lineHeight: 21,
    maxWidth: 360,
  },
  overlay: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
    gap: 25,
  },
  scanFrame: {
    width: 230,
    height: 190,
    borderWidth: 2,
    borderColor: "#70D9C7",
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(8,127,120,.04)",
  },
  scanTip: {
    fontSize: 12,
    color: "white",
    backgroundColor: "rgba(0,0,0,.35)",
    padding: 10,
    borderRadius: 20,
  },
  cameraBottom: {
    position: "absolute",
    bottom: 20,
    left: 22,
    right: 22,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cameraTag: { flexDirection: "row", gap: 7, alignItems: "center" },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: "#74D9C5" },
  cameraTagText: {
    fontSize: 9,
    color: "#C2D8D6",
    letterSpacing: 1.5,
    fontWeight: "600",
  },
  flash: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,.12)",
    alignItems: "center",
    justifyContent: "center",
  },
});
