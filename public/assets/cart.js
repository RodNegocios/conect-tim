export const money = (value) =>
  value == null
    ? "Sob consulta"
    : new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
      }).format(value / 100);
export const keyOf = (item) =>
  JSON.stringify([
    item.id,
    Object.entries(item.variations || {}).sort(([a], [b]) =>
      a.localeCompare(b),
    ),
  ]);
export function normalize(items) {
  if (!Array.isArray(items)) return [];
  const result = new Map();
  for (const item of items.slice(0, 50)) {
    if (
      !item ||
      typeof item.id !== "string" ||
      !Number.isInteger(item.quantity) ||
      item.quantity < 1 ||
      !item.variations ||
      typeof item.variations !== "object" ||
      Array.isArray(item.variations)
    )
      continue;
    if (
      !Object.entries(item.variations).every(
        ([k, v]) => k.length <= 50 && typeof v === "string" && v.length <= 60,
      )
    )
      continue;
    const clean = {
      id: item.id,
      variations: { ...item.variations },
      quantity: Math.min(99, item.quantity),
    };
    const key = keyOf(clean);
    const existing = result.get(key);
    if (existing)
      existing.quantity = Math.min(99, existing.quantity + clean.quantity);
    else result.set(key, clean);
  }
  return [...result.values()];
}
export function resolveCart(items, products) {
  return items.map((item) => {
    const product = products.find((p) => p.id === item.id);
    const valid =
      product &&
      product.active &&
      product.available &&
      Object.keys(item.variations).length === product.variations.length &&
      product.variations.every((v) =>
        v.options.includes(item.variations[v.name]),
      );
    const price = product ? (product.salePrice ?? product.price) : null;
    return {
      ...item,
      product,
      valid: Boolean(valid),
      subtotal: price == null ? null : price * item.quantity,
    };
  });
}
