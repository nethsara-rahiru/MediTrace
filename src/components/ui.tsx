import React from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";
import { ArrowLeft, ArrowRight, CircleHelp, Plus } from "lucide-react-native";
import { router } from "expo-router";
import { colors, shadow } from "../theme";
export function Page({ children }: React.PropsWithChildren) {
  return (
    <ScrollView
      style={s.page}
      contentContainerStyle={s.content}
      keyboardShouldPersistTaps="handled"
    >
      <View style={s.container}>{children}</View>
    </ScrollView>
  );
}
export function Heading({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <View style={s.heading}>
      <View style={{ flex: 1 }}>
        <Text style={s.title} accessibilityRole="header">
          {title}
        </Text>
        {subtitle && <Text style={s.subtitle}>{subtitle}</Text>}
      </View>
      {action}
    </View>
  );
}
export function Back({ label = "Back" }: { label?: string }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}
      style={s.back}
    >
      <ArrowLeft size={18} color={colors.muted} />
      <Text style={s.backText}>{label}</Text>
    </Pressable>
  );
}
export function Card({
  children,
  style,
}: React.PropsWithChildren<{ style?: any }>) {
  return <View style={[s.card, style]}>{children}</View>;
}
export function Button({
  title,
  onPress,
  variant = "primary",
  icon,
  disabled,
  busy,
}: {
  title: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "danger";
  icon?: React.ReactNode;
  disabled?: boolean;
  busy?: boolean;
}) {
  const dark = variant !== "secondary";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || busy }}
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => [
        s.button,
        variant === "secondary"
          ? s.secondary
          : variant === "danger"
            ? { backgroundColor: colors.red }
            : s.primary,
        (disabled || busy) && { opacity: 0.5 },
        pressed && { opacity: 0.8 },
      ]}
    >
      {busy ? (
        <ActivityIndicator color={dark ? colors.white : colors.teal} />
      ) : (
        icon
      )}
      <Text
        style={[s.buttonText, { color: dark ? colors.white : colors.teal }]}
      >
        {title}
      </Text>
    </Pressable>
  );
}
export function Badge({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: "neutral" | "green" | "amber" | "red" | "blue";
}) {
  const palette = {
    neutral: [colors.background, colors.muted],
    green: [colors.mint, colors.teal],
    amber: [colors.amberBg, colors.amber],
    red: [colors.redBg, colors.red],
    blue: [colors.blueBg, colors.blue],
  }[tone];
  return (
    <View style={[s.badge, { backgroundColor: palette[0] }]}>
      <View style={[s.dot, { backgroundColor: palette[1] }]} />
      <Text style={[s.badgeText, { color: palette[1] }]}>{label}</Text>
    </View>
  );
}
export function Field({
  label,
  hint,
  ...props
}: TextInputProps & { label: string; hint?: string }) {
  return (
    <View style={s.field}>
      <Text style={s.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor="#899CA5"
        {...props}
        style={[
          s.input,
          props.multiline && { minHeight: 100, textAlignVertical: "top" },
          props.style,
        ]}
      />
      {hint && <Text style={s.hint}>{hint}</Text>}
    </View>
  );
}
export function Notice({
  children,
  tone = "neutral",
}: React.PropsWithChildren<{ tone?: "neutral" | "amber" | "red" }>) {
  return (
    <View
      style={[
        s.notice,
        {
          backgroundColor:
            tone === "amber"
              ? colors.amberBg
              : tone === "red"
                ? colors.redBg
                : colors.blueBg,
        },
      ]}
    >
      <CircleHelp
        size={18}
        color={tone === "red" ? colors.red : colors.muted}
      />
      <Text style={s.noticeText}>{children}</Text>
    </View>
  );
}
export function Empty({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <Card style={s.empty}>
      <View style={s.emptyIcon}>
        <Plus color={colors.teal} size={24} />
      </View>
      <Text style={s.emptyTitle}>{title}</Text>
      <Text style={s.emptyText}>{description}</Text>
      {action}
    </Card>
  );
}
export function Section({
  title,
  action,
  onPress,
}: {
  title: string;
  action?: string;
  onPress?: () => void;
}) {
  return (
    <View style={s.section}>
      <Text style={s.sectionTitle}>{title}</Text>
      {action && (
        <Pressable accessibilityRole="button" style={s.link} onPress={onPress}>
          <Text style={s.linkText}>{action}</Text>
          <ArrowRight size={15} color={colors.teal} />
        </Pressable>
      )}
    </View>
  );
}
export function Chips({
  items,
  value,
  onChange,
}: {
  items: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={s.chips}
    >
      {items.map((item) => (
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: value === item }}
          key={item}
          onPress={() => onChange(item)}
          style={[s.chip, value === item && s.chipActive]}
        >
          <Text style={[s.chipText, value === item && { color: colors.white }]}>
            {item}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}
export const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  content: { padding: 24, paddingBottom: 40 },
  container: { width: "100%", maxWidth: 1120, alignSelf: "center", gap: 20 },
  heading: {
    flexDirection: "row",
    gap: 16,
    alignItems: "center",
    marginBottom: 4,
  },
  title: {
    color: colors.navy,
    fontSize: 30,
    fontWeight: "700",
    letterSpacing: -0.8,
  },
  subtitle: { color: colors.muted, fontSize: 14, lineHeight: 22, marginTop: 7 },
  card: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    padding: 22,
    gap: 14,
    ...shadow,
  },
  button: {
    minHeight: 48,
    paddingVertical: 13,
    paddingHorizontal: 20,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
  },
  primary: { backgroundColor: colors.teal },
  secondary: { backgroundColor: colors.mint },
  buttonText: { fontSize: 14, fontWeight: "700" },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 30,
    gap: 6,
  },
  dot: { width: 5, height: 5, borderRadius: 3 },
  badgeText: { fontSize: 11, fontWeight: "600" },
  field: { gap: 8, flex: 1, minWidth: 180 },
  label: { fontSize: 13, fontWeight: "600", color: colors.text },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 11,
    padding: 14,
    color: colors.text,
    backgroundColor: colors.white,
    fontSize: 14,
  },
  hint: { fontSize: 12, lineHeight: 18, color: colors.muted },
  notice: {
    padding: 15,
    borderRadius: 12,
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
  },
  noticeText: { flex: 1, fontSize: 12, color: colors.text, lineHeight: 20 },
  empty: { alignItems: "center", paddingVertical: 38 },
  emptyIcon: { padding: 16, backgroundColor: colors.mint, borderRadius: 18 },
  emptyTitle: {
    fontSize: 18,
    color: colors.navy,
    fontWeight: "600",
    textAlign: "center",
  },
  emptyText: {
    color: colors.muted,
    textAlign: "center",
    maxWidth: 380,
    fontSize: 14,
    lineHeight: 22,
  },
  section: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "center",
  },
  sectionTitle: { fontSize: 18, fontWeight: "700", color: colors.navy },
  link: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 44 },
  linkText: { fontSize: 12, color: colors.teal, fontWeight: "600" },
  back: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    minHeight: 44,
    alignSelf: "flex-start",
  },
  backText: { color: colors.muted, fontSize: 13 },
  chips: { gap: 8 },
  chip: {
    paddingVertical: 10,
    paddingHorizontal: 17,
    borderRadius: 30,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.teal, borderColor: colors.teal },
  chipText: { color: colors.muted, fontSize: 12, fontWeight: "600" },
});
