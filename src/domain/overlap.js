export function ingredientOverlaps(items) {
  const map = new Map();
  for (const item of items.filter((i) => i.quantity > 0))
    for (const ingredient of item.ingredients) {
      const key = ingredient.name.trim().toLowerCase();
      if (!key) continue;
      if (!map.has(key)) map.set(key, new Map());
      map.get(key).set(item.product_id, item.name);
    }
  return [...map.entries()]
    .filter(([, products]) => products.size > 1)
    .map(([ingredient, products]) => ({
      ingredient,
      medicines: [...products].map(([productId, name]) => ({
        productId,
        name,
      })),
    }));
}
