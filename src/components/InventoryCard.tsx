import { Pressable, Text, View } from "react-native";
import { CalendarClock, ChevronRight, Pill } from "lucide-react-native";
import { router } from "expo-router";
import { colors } from "../theme";
import { Badge, Card } from "./ui";
import type { InventoryItem } from "../domain/types";
import { expiryState, formatExpiry, type ExpiryState } from "../domain/expiry";
export const expiryTone: Record<
  ExpiryState,
  "green" | "amber" | "red" | "neutral"
> = {
  Valid: "green",
  "Expiring soon": "amber",
  Expired: "red",
  "Expiry unknown": "neutral",
};
export function InventoryCard({ item }: { item: InventoryItem }) {
  const state = expiryState(item.expiry);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Manage ${item.name}, ${state}`}
      onPress={() =>
        router.push({
          pathname: "/inventory-entry",
          params: { id: item.id, productId: item.product_id },
        })
      }
    >
      <Card>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
          <View
            style={{
              backgroundColor: colors.mint,
              padding: 12,
              borderRadius: 13,
            }}
          >
            <Pill size={23} color={colors.teal} />
          </View>
          <View style={{ flex: 1, gap: 5 }}>
            <Text
              style={{ fontSize: 16, fontWeight: "700", color: colors.navy }}
            >
              {item.name}
            </Text>
            <Text style={{ fontSize: 12, color: colors.muted }}>
              {[item.strength, item.dosage_form].filter(Boolean).join(" · ") ||
                "Product details not recorded"}
            </Text>
          </View>
          <ChevronRight size={17} color={colors.muted} />
        </View>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <Text style={{ fontSize: 13, color: colors.text }}>
            {item.quantity} {item.unit}{" "}
            <Text style={{ color: colors.muted }}>
              {item.batch ? `· Lot ${item.batch}` : ""}
            </Text>
          </Text>
          <Badge label={state} tone={expiryTone[state]} />
        </View>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 7,
            borderTopWidth: 1,
            borderColor: colors.border,
            paddingTop: 12,
          }}
        >
          <CalendarClock size={14} color={colors.muted} />
          <Text style={{ fontSize: 12, color: colors.muted }}>
            Expiry: {formatExpiry(item.expiry, item.expiry_precision)}
          </Text>
        </View>
      </Card>
    </Pressable>
  );
}
