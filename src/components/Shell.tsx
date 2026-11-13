import React from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { router, usePathname } from "expo-router";
import {
  Activity,
  ArrowUpRight,
  BookOpen,
  Clock3,
  House,
  ScanLine,
  ShieldCheck,
  Pill,
  CalendarClock,
  Plus,
  WifiOff,
} from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "../theme";
import { useData } from "../data/context";
const links = [
  { label: "Overview", path: "/", icon: House },
  { label: "Medicine library", path: "/library", icon: BookOpen },
  { label: "My medicines", path: "/inventory", icon: Pill },
  { label: "Expiry tracker", path: "/expiry", icon: CalendarClock },
  { label: "Scan history", path: "/history", icon: Clock3 },
] as const;
export function Brand() {
  return (
    <View style={s.brand}>
      <View style={s.brandIcon}>
        <Activity color="white" size={23} strokeWidth={2.5} />
      </View>
      <Text style={s.brandText}>
        Med<Text style={{ color: colors.teal }}>Trace</Text>
      </Text>
    </View>
  );
}
export function Shell({ children }: React.PropsWithChildren) {
  const { width } = useWindowDimensions(),
    wide = width >= 900,
    path = usePathname(),
    insets = useSafeAreaInsets();
  const { error, loading, refresh } = useData();
  const selected = (p: string) =>
    path === p ||
    (p === "/library" &&
      (path.startsWith("/product/") || path === "/add-product")) ||
    (p === "/inventory" && path === "/inventory-entry");
  return (
    <View style={[s.shell, { paddingTop: insets.top }]}>
      {wide && (
        <View style={s.sidebar}>
          <Brand />
          <Text style={s.menuLabel}>WORKSPACE</Text>
          <View style={{ gap: 6 }}>
            {links.map(({ label, path: p, icon: Icon }) => (
              <Pressable
                key={p}
                accessibilityRole="button"
                accessibilityState={{ selected: selected(p) }}
                onPress={() => router.navigate(p)}
                style={[s.navItem, selected(p) && s.active]}
              >
                <Icon
                  size={19}
                  color={selected(p) ? colors.teal : colors.muted}
                />
                <Text
                  style={[
                    s.navText,
                    selected(p) && { color: colors.teal, fontWeight: "700" },
                  ]}
                >
                  {label}
                </Text>
              </Pressable>
            ))}
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push("/add-product")}
            style={s.add}
          >
            <Plus size={18} color={colors.teal} />
            <Text style={s.addText}>Add a product</Text>
          </Pressable>
          <View style={{ flex: 1 }} />
          <View style={s.sideNote}>
            <ShieldCheck color={colors.teal} size={23} />
            <Text style={s.noteTitle}>Private by design</Text>
            <Text style={s.noteText}>
              Your medicine records stay on this device.
            </Text>
            <View style={s.local}>
              <View style={s.greenDot} />
              <Text style={s.localText}>LOCAL STORAGE</Text>
            </View>
          </View>
          <Text style={s.version}>MedTrace · v1.0</Text>
        </View>
      )}
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={[s.topbar, !wide && { paddingHorizontal: 20 }]}>
          {wide ? (
            <Text style={s.topLabel}>YOUR MEDICINE COMPANION</Text>
          ) : (
            <Brand />
          )}
          <View style={s.offline}>
            <WifiOff size={13} color={colors.teal} />
            <Text style={s.offlineText}>Offline ready</Text>
          </View>
        </View>
        {error ? (
          <Pressable
            onPress={() => void refresh().catch(() => undefined)}
            style={s.error}
          >
            <Text style={{ color: colors.red }}>
              Could not load local data. Tap to retry.
            </Text>
          </Pressable>
        ) : null}
        {loading ? (
          <View style={s.loading}>
            <Activity color={colors.teal} size={30} />
            <Text style={s.noteText}>Opening your local medicine cabinet…</Text>
          </View>
        ) : (
          children
        )}
        {!wide && (
          <View
            style={[s.bottom, { paddingBottom: Math.max(insets.bottom, 10) }]}
          >
            {[
              links[0],
              links[1],
              { label: "Scan", path: "/scanner", icon: ScanLine },
              links[2],
              links[4],
            ].map(({ label, path: p, icon: Icon }) => (
              <Pressable
                key={p}
                accessibilityRole="button"
                accessibilityLabel={label}
                accessibilityState={{ selected: selected(p) }}
                onPress={() => router.navigate(p as any)}
                style={s.bottomItem}
              >
                <View style={p === "/scanner" ? s.scanTab : undefined}>
                  <Icon
                    size={21}
                    color={
                      p === "/scanner"
                        ? colors.white
                        : selected(p)
                          ? colors.teal
                          : colors.muted
                    }
                  />
                </View>
                <Text
                  style={[s.bottomLabel, selected(p) && { color: colors.teal }]}
                >
                  {label === "Medicine library"
                    ? "Library"
                    : label === "My medicines"
                      ? "Medicines"
                      : label === "Scan history"
                        ? "History"
                        : label === "Overview"
                          ? "Home"
                          : label}
                </Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}
const s = StyleSheet.create({
  shell: { flex: 1, flexDirection: "row", backgroundColor: colors.white },
  sidebar: {
    width: 238,
    borderRightWidth: 1,
    borderColor: colors.border,
    padding: 24,
    paddingTop: 31,
    gap: 24,
  },
  brand: { flexDirection: "row", alignItems: "center", gap: 9 },
  brandIcon: {
    backgroundColor: colors.teal,
    width: 34,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  brandText: {
    fontSize: 23,
    fontWeight: "800",
    color: colors.navy,
    letterSpacing: -0.8,
  },
  menuLabel: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.7,
    color: "#879AA3",
    marginTop: 24,
  },
  navItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 13,
    borderRadius: 10,
  },
  navText: { fontSize: 12, color: colors.muted, fontWeight: "500" },
  active: { backgroundColor: colors.mint },
  add: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 13,
    alignItems: "center",
    minHeight: 44,
  },
  addText: { fontSize: 12, color: colors.teal, fontWeight: "600" },
  sideNote: {
    backgroundColor: colors.background,
    padding: 17,
    borderRadius: 15,
    gap: 10,
  },
  noteTitle: { color: colors.navy, fontSize: 13, fontWeight: "700" },
  noteText: { color: colors.muted, fontSize: 12, lineHeight: 20 },
  local: { flexDirection: "row", gap: 6, alignItems: "center", marginTop: 8 },
  greenDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.teal,
  },
  localText: {
    fontSize: 9,
    fontWeight: "700",
    color: colors.teal,
    letterSpacing: 1,
  },
  version: { fontSize: 10, color: colors.muted, textAlign: "center" },
  topbar: {
    height: 78,
    borderBottomWidth: 1,
    borderColor: colors.border,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 34,
  },
  topLabel: {
    fontSize: 10,
    color: colors.muted,
    letterSpacing: 1.8,
    fontWeight: "600",
  },
  offline: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.mint,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 30,
  },
  offlineText: { fontSize: 10, color: colors.teal, fontWeight: "600" },
  bottom: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderColor: colors.border,
    paddingTop: 10,
    backgroundColor: colors.white,
  },
  bottomItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    minHeight: 48,
  },
  bottomLabel: { fontSize: 9, color: colors.muted, fontWeight: "600" },
  scanTab: {
    backgroundColor: colors.teal,
    padding: 9,
    borderRadius: 13,
    marginTop: -21,
  },
  loading: { flex: 1, alignItems: "center", justifyContent: "center", gap: 18 },
  error: { padding: 15, backgroundColor: colors.redBg },
});
