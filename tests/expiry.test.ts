import { test } from "node:test";
import assert from "node:assert/strict";
import { parseExpiry, expiryState, gs1Expiry } from "../src/domain/expiry";
import { ingredientOverlaps } from "../src/domain/overlap";
import type { InventoryItem } from "../src/domain/types";
test("expiry validates leap years and preserves month precision", () => {
  assert.deepEqual(parseExpiry("2028-02"), {
    expiry: "2028-02-29",
    precision: "month",
  });
  assert.deepEqual(parseExpiry(""), { expiry: null, precision: "unknown" });
  assert.throws(() => parseExpiry("2027-02-29"));
  assert.throws(() => parseExpiry("2027-13"));
  assert.equal(gs1Expiry("271100", new Date(2026, 0, 1)), "2027-11-30");
});
test("expiry boundaries include the printed date and 30-day horizon", () => {
  const now = new Date(2026, 10, 13, 23, 59);
  assert.equal(expiryState("2026-11-12", now), "Expired");
  assert.equal(expiryState("2026-11-13", now), "Expiring soon");
  assert.equal(expiryState("2026-12-13", now), "Expiring soon");
  assert.equal(expiryState("2026-12-14", now), "Valid");
  assert.equal(expiryState(null, now), "Expiry unknown");
});
test("ingredient overlap deduplicates batches and excludes depleted stock", () => {
  const item = (id: number, name: string, quantity = 1) =>
    ({
      product_id: id,
      name,
      quantity,
      ingredients: [{ name: "Example ingredient", strength: "1 mg" }],
    }) as InventoryItem;
  assert.equal(ingredientOverlaps([item(1, "A"), item(1, "A")]).length, 0);
  assert.equal(ingredientOverlaps([item(1, "A"), item(2, "B", 0)]).length, 0);
  assert.deepEqual(
    ingredientOverlaps([item(1, "A"), item(2, "B")])[0].medicines.map(
      (x) => x.name,
    ),
    ["A", "B"],
  );
});
