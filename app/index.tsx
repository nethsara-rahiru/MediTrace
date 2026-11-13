import {
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { router } from "expo-router";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  CalendarClock,
  Clock3,
  Package,
  ScanLine,
  ShieldCheck,
  Plus,
  CheckCircle2,
  Circle,
} from "lucide-react-native";
import {
  Page,
  Heading,
  Card,
  Button,
  Section,
  Badge,
  Notice,
} from "../src/components/ui";
import { InventoryCard } from "../src/components/InventoryCard";
import { MedicineIllustration } from "../src/components/MedicineIllustration";
import { useData } from "../src/data/context";
import { expiryState } from "../src/domain/expiry";
import { colors } from "../src/theme";
export default function Home() {
  const { inventory, products, history } = useData(),
    { width } = useWindowDimensions();
  const large = width >= 1100;
  const active = inventory.filter((i) => i.quantity > 0),
    upcoming = active
      .filter((i) =>
        ["Expiring soon", "Expired"].includes(expiryState(i.expiry)),
      )
      .slice(0, 3);
  const date = new Date().toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const stats = [
    {
      label: "Medicines in your cabinet",
      value: active.length,
      icon: Package,
      tone: colors.teal,
      bg: colors.mint,
      path: "/inventory",
    },
    {
      label: "Expiring in 30 days",
      value: active.filter((i) => expiryState(i.expiry) === "Expiring soon")
        .length,
      icon: CalendarClock,
      tone: colors.amber,
      bg: colors.amberBg,
      path: "/expiry",
    },
    {
      label: "Products in your library",
      value: products.length,
      icon: BookOpen,
      tone: colors.blue,
      bg: colors.blueBg,
      path: "/library",
    },
    {
      label: "Scans recorded",
      value: history.length,
      icon: ScanLine,
      tone: colors.teal,
      bg: colors.mint,
      path: "/history",
    },
  ];
  return (
    <Page>
      <View style={s.intro}>
        <View>
          <Text style={s.eyebrow}>YOUR EVERYDAY PEACE OF MIND</Text>
          <Text style={s.title}>A healthier habit starts here.</Text>
          <Text style={s.subtitle}>
            Know what you have. Keep track of what matters.
          </Text>
        </View>
        <Text style={s.date}>{date}</Text>
      </View>
      <View style={s.hero}>
        <View style={{ flex: 1, gap: 17, paddingVertical: 8 }}>
          <View style={s.heroTag}>
            <ShieldCheck size={13} color={colors.teal} />
            <Text style={s.heroTagText}>SMALL SCAN. MORE CLARITY.</Text>
          </View>
          <Text style={s.heroTitle}>Your medicine,{"\n"}understood.</Text>
          <Text style={s.heroText}>
            Scan a package to find its product information,{large ? "\n" : " "}
            then keep its expiry date close at hand.
          </Text>
          <View style={{ alignSelf: "flex-start", marginTop: 4 }}>
            <Button
              title="Scan a medicine"
              icon={<ScanLine size={18} color="white" />}
              onPress={() => router.push("/scanner")}
            />
          </View>
          <Text style={s.heroFoot}>On your device. Available offline.</Text>
        </View>
        {large && <MedicineIllustration />}
      </View>
      <View style={s.stats}>
        {stats.map(({ label, value, icon: Icon, tone, bg, path }) => (
          <Pressable
            accessibilityRole="button"
            key={label}
            onPress={() => router.push(path as any)}
            style={s.stat}
          >
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <View
                style={{ padding: 10, borderRadius: 11, backgroundColor: bg }}
              >
                <Icon size={18} color={tone} />
              </View>
              <ArrowUpRight size={15} color="#9BAAB1" />
            </View>
            <Text style={s.statValue}>{value}</Text>
            <Text style={s.statLabel}>{label}</Text>
          </Pressable>
        ))}
      </View>
      <View style={{ flexDirection: large ? "row" : "column", gap: 22 }}>
        <View style={{ flex: 1.3, gap: 17 }}>
          <Section
            title="A look inside your cabinet"
            action="View all"
            onPress={() => router.push("/inventory")}
          />
          {upcoming.length ? (
            upcoming.map((i) => <InventoryCard item={i} key={i.id} />)
          ) : (
            <Card
              style={{
                minHeight: 230,
                justifyContent: "center",
                alignItems: "center",
                paddingVertical: 30,
              }}
            >
              <View style={s.emptyIcon}>
                <CalendarClock size={25} color={colors.teal} />
              </View>
              <Text style={s.emptyTitle}>
                {active.length
                  ? "Nothing approaching expiry"
                  : "A fresh start for your cabinet"}
              </Text>
              <Text style={s.emptyText}>
                {active.length
                  ? "No recorded medicines expire within the next 30 days. Check entries with unknown dates separately."
                  : "Add your medicines to see upcoming expiry dates and keep everything in one place."}
              </Text>
              <Button
                title={
                  active.length
                    ? "Open expiry tracker"
                    : "Add your first medicine"
                }
                variant="secondary"
                icon={<Plus size={15} color={colors.teal} />}
                onPress={() =>
                  router.push(active.length ? "/expiry" : "/inventory-entry")
                }
              />
            </Card>
          )}
        </View>
        <View style={{ flex: 1, gap: 17 }}>
          <Section
            title={
              products.length && inventory.length
                ? "Your local workspace"
                : "Make yourself at home"
            }
          />
          <Card style={{ gap: 22, minHeight: 230 }}>
            {[
              {
                title: "Register a product",
                text: "Copy the details from its packaging.",
                done: products.length > 0,
                path: "/add-product",
              },
              {
                title: "Add a pack you own",
                text: "Record its quantity, batch and expiry.",
                done: inventory.length > 0,
                path: "/inventory-entry",
              },
              {
                title: "Try your first scan",
                text: "Find a registered product offline.",
                done: history.length > 0,
                path: "/scanner",
              },
            ].map((step, i) => (
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push(step.path as any)}
                key={step.title}
                style={{ flexDirection: "row", gap: 12, alignItems: "center" }}
              >
                {step.done ? (
                  <CheckCircle2 size={23} color={colors.teal} />
                ) : (
                  <View style={s.stepNumber}>
                    <Text
                      style={{
                        color: colors.muted,
                        fontSize: 11,
                        fontWeight: "700",
                      }}
                    >
                      {i + 1}
                    </Text>
                  </View>
                )}
                <View style={{ flex: 1, gap: 5 }}>
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: "700",
                      color: colors.navy,
                    }}
                  >
                    {step.title}
                  </Text>
                  <Text
                    style={{
                      fontSize: 11,
                      lineHeight: 17,
                      color: colors.muted,
                    }}
                  >
                    {step.text}
                  </Text>
                </View>
                <ArrowRight size={15} color={colors.muted} />
              </Pressable>
            ))}
          </Card>
        </View>
      </View>
      <Section
        title="Recent scans"
        action="Scan history"
        onPress={() => router.push("/history")}
      />
      <Card>
        {history.length ? (
          history.slice(0, 3).map((h) => (
            <Pressable
              accessibilityRole="button"
              key={h.id}
              onPress={() => router.push(`/history/${h.id}`)}
              style={s.historyRow}
            >
              <View style={s.historyIcon}>
                <ScanLine size={18} color={colors.teal} />
              </View>
              <View style={{ flex: 1, gap: 5 }}>
                <Text
                  style={{
                    fontSize: 13,
                    color: colors.navy,
                    fontWeight: "600",
                  }}
                >
                  {h.name ?? h.identifier ?? "Unidentified code"}
                </Text>
                <Text style={{ fontSize: 11, color: colors.muted }}>
                  {new Date(h.scanned_at).toLocaleString("en-GB")} ·{" "}
                  {h.format.toUpperCase()}
                </Text>
              </View>
              <Badge label={h.status} tone={h.product_id ? "green" : "amber"} />
            </Pressable>
          ))
        ) : (
          <View style={{ flexDirection: "row", gap: 14, alignItems: "center" }}>
            <View style={s.historyIcon}>
              <ScanLine size={20} color={colors.muted} />
            </View>
            <View style={{ flex: 1, gap: 5 }}>
              <Text
                style={{ color: colors.navy, fontSize: 13, fontWeight: "600" }}
              >
                Your scans will appear here
              </Text>
              <Text
                style={{ color: colors.muted, fontSize: 12, lineHeight: 19 }}
              >
                Start with a code on a medicine package.
              </Text>
            </View>
            <Button
              title="Scan"
              variant="secondary"
              onPress={() => router.push("/scanner")}
            />
          </View>
        )}
      </Card>
      <View style={s.footer}>
        <ShieldCheck size={15} color={colors.muted} />
        <Text style={s.footerText}>
          An information companion. For medical advice, speak with a qualified
          pharmacist.
        </Text>
      </View>
    </Page>
  );
}
const s = StyleSheet.create({
  intro: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 14,
    flexWrap: "wrap",
    marginTop: 8,
  },
  eyebrow: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1.6,
    color: colors.teal,
    marginBottom: 9,
  },
  title: {
    fontSize: 27,
    fontWeight: "700",
    letterSpacing: -0.8,
    color: colors.navy,
  },
  subtitle: { fontSize: 13, color: colors.muted, marginTop: 8, lineHeight: 21 },
  date: { fontSize: 11, color: colors.muted, marginTop: 22 },
  hero: {
    backgroundColor: "#E8F3EE",
    borderWidth: 1,
    borderColor: "#D8E9E1",
    borderRadius: 22,
    padding: 28,
    flexDirection: "row",
    alignItems: "center",
    overflow: "hidden",
    gap: 10,
  },
  heroTag: { flexDirection: "row", gap: 6, alignItems: "center" },
  heroTagText: {
    fontSize: 8,
    fontWeight: "700",
    letterSpacing: 1.4,
    color: colors.teal,
  },
  heroTitle: {
    fontSize: 38,
    lineHeight: 44,
    fontWeight: "700",
    letterSpacing: -1.3,
    color: colors.navy,
  },
  heroText: { fontSize: 13, color: "#56776E", lineHeight: 22 },
  heroFoot: { fontSize: 10, color: "#6B8B80" },
  stats: { flexDirection: "row", flexWrap: "wrap", gap: 14 },
  stat: {
    flex: 1,
    minWidth: 140,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 17,
    padding: 18,
    gap: 11,
  },
  statValue: {
    fontSize: 30,
    fontWeight: "700",
    letterSpacing: -1,
    color: colors.navy,
  },
  statLabel: { fontSize: 11, color: colors.muted, lineHeight: 17 },
  emptyIcon: { padding: 14, borderRadius: 16, backgroundColor: colors.mint },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.navy,
    textAlign: "center",
  },
  emptyText: {
    fontSize: 12,
    color: colors.muted,
    lineHeight: 21,
    textAlign: "center",
    maxWidth: 340,
  },
  stepNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  historyRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    paddingVertical: 9,
  },
  historyIcon: {
    padding: 12,
    backgroundColor: colors.background,
    borderRadius: 12,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    padding: 7,
  },
  footerText: {
    fontSize: 10,
    color: colors.muted,
    lineHeight: 17,
    flexShrink: 1,
  },
});
