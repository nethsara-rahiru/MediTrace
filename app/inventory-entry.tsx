import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import {
  Page,
  Back,
  Heading,
  Card,
  Field,
  Button,
  Notice,
  Empty,
  Badge,
} from "../src/components/ui";
import { useData } from "../src/data/context";
import { saveInventory, removeInventory } from "../src/data/inventory";
import { reconcileReminders } from "../src/services/reminders";
import { colors } from "../src/theme";
export default function InventoryEntry() {
  const params = useLocalSearchParams<{
    id?: string;
    productId?: string;
    batch?: string;
    expiry?: string;
    expiryPrecision?: string;
  }>();
  const { db, products, inventory, mutate } = useData();
  const existing = inventory.find((i) => i.id === Number(params.id));
  const [productId, setProductId] = useState(
      existing?.product_id ?? Number(params.productId ?? 0),
    ),
    [query, setQuery] = useState("");
  const [quantity, setQuantity] = useState(String(existing?.quantity ?? 1)),
    [unit, setUnit] = useState(existing?.unit ?? "units"),
    [batch, setBatch] = useState(existing?.batch ?? params.batch ?? "");
  const initialExpiry = existing?.expiry ?? params.expiry ?? "";
  const month =
    existing?.expiry_precision === "month" ||
    params.expiryPrecision === "month";
  const [expiry, setExpiry] = useState(
      month ? initialExpiry.slice(0, 7) : initialExpiry,
    ),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [confirmDelete, setConfirmDelete] = useState(false);
  const product = products.find((p) => p.id === productId);
  async function save() {
    setError("");
    setBusy(true);
    try {
      if (!product) throw new Error("Select a product from your library.");
      if (!quantity.trim()) throw new Error("Enter the quantity.");
      await mutate(() =>
        saveInventory(
          db,
          {
            product_id: productId,
            quantity: Number(quantity),
            unit,
            batch,
            expiry,
            expiry_source: "User-confirmed packaging information",
          },
          existing?.id,
        ),
      );
      await reconcileReminders(db).catch(() => undefined);
      router.replace("/inventory");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    if (!existing) return;
    setBusy(true);
    try {
      await mutate(() => removeInventory(db, existing.id));
      await reconcileReminders(db).catch(() => undefined);
      router.replace("/inventory");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Page>
      <Back label="My medicines" />
      <Heading
        title={existing ? "Manage medicine" : "Add to my medicines"}
        subtitle="Record a particular pack. Batch and expiry may differ between packs."
      />
      {error && <Notice tone="red">{error}</Notice>}
      {!products.length ? (
        <Empty
          title="Register a product first"
          description="A library product gives each inventory entry a consistent identity."
          action={
            <Button
              title="Register product"
              onPress={() => router.push("/add-product")}
            />
          }
        />
      ) : (
        <>
          <Card>
            {product ? (
              <>
                <Text
                  style={{
                    fontSize: 19,
                    fontWeight: "700",
                    color: colors.navy,
                  }}
                >
                  {product.name}
                </Text>
                <Text style={{ color: colors.muted }}>
                  {[product.strength, product.dosage_form]
                    .filter(Boolean)
                    .join(" · ")}
                </Text>
                {!existing && (
                  <Button
                    title="Choose another product"
                    variant="secondary"
                    onPress={() => setProductId(0)}
                  />
                )}
              </>
            ) : (
              <>
                <Field
                  label="Find a library product"
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Search by product name"
                />
                {products
                  .filter((p) =>
                    (p.name + " " + p.generic_name)
                      .toLowerCase()
                      .includes(query.toLowerCase()),
                  )
                  .map((p) => (
                    <Pressable
                      accessibilityRole="button"
                      key={p.id}
                      onPress={() => setProductId(p.id)}
                      style={{
                        padding: 15,
                        borderWidth: 1,
                        borderColor: colors.border,
                        borderRadius: 12,
                        gap: 5,
                      }}
                    >
                      <Text style={{ color: colors.navy, fontWeight: "600" }}>
                        {p.name} {p.strength}
                      </Text>
                      <Text style={{ color: colors.muted, fontSize: 12 }}>
                        {p.pack_size ||
                          p.dosage_form ||
                          "Pack details not recorded"}
                      </Text>
                    </Pressable>
                  ))}
              </>
            )}
          </Card>
          {product && (
            <>
              <Card>
                <View
                  style={{ flexDirection: "row", flexWrap: "wrap", gap: 16 }}
                >
                  <Field
                    label="Quantity *"
                    value={quantity}
                    onChangeText={setQuantity}
                    keyboardType="decimal-pad"
                  />
                  <Field
                    label="Unit *"
                    value={unit}
                    onChangeText={setUnit}
                    placeholder="Tablets, bottles, packs…"
                  />
                </View>
                <Field
                  label="Batch / lot number"
                  value={batch}
                  onChangeText={setBatch}
                  placeholder="As printed on this pack"
                />
                <Field
                  label="Expiry date"
                  value={expiry}
                  onChangeText={setExpiry}
                  placeholder="YYYY-MM or YYYY-MM-DD"
                  autoCapitalize="none"
                  hint="Leave blank if unknown. A month-only label is tracked through the end of that month."
                />
              </Card>
              <Notice>
                Confirm batch and expiry against the physical package before
                saving. Changing the quantity does not record or recommend a
                dose.
              </Notice>
              <Button
                title={
                  existing ? "Save inventory changes" : "Add medicine locally"
                }
                onPress={save}
                busy={busy}
              />
              {existing &&
                (confirmDelete ? (
                  <Card>
                    <Text style={{ color: colors.text }}>
                      Remove this inventory entry? The library product and scan
                      history will remain.
                    </Text>
                    <Button
                      title="Confirm removal"
                      variant="danger"
                      onPress={remove}
                      busy={busy}
                    />
                    <Button
                      title="Keep entry"
                      variant="secondary"
                      onPress={() => setConfirmDelete(false)}
                    />
                  </Card>
                ) : (
                  <Button
                    title="Remove from my medicines"
                    variant="secondary"
                    onPress={() => setConfirmDelete(true)}
                  />
                ))}
            </>
          )}
        </>
      )}
    </Page>
  );
}
