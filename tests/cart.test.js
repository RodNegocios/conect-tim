import test from "node:test";
import assert from "node:assert/strict";
import { normalize, resolveCart, keyOf } from "../public/assets/cart.js";
test("untrusted persisted cart discards prices and invalid quantities", () => {
  const value = normalize([
    {
      id: "p",
      quantity: 2,
      variations: { Cor: "Preto" },
      price: 1,
      name: "fake",
    },
    null,
    { id: "p", quantity: -1, variations: {} },
  ]);
  assert.deepEqual(value, [
    { id: "p", quantity: 2, variations: { Cor: "Preto" } },
  ]);
});
test("same variation combination merges irrespective of property order", () => {
  const a = {
    id: "p",
    quantity: 70,
    variations: { Cor: "Preto", Tamanho: "M" },
  };
  const b = {
    id: "p",
    quantity: 40,
    variations: { Tamanho: "M", Cor: "Preto" },
  };
  assert.equal(keyOf(a), keyOf(b));
  assert.equal(normalize([a, b])[0].quantity, 99);
});
test("current catalog resolves totals and flags changed or hidden variants", () => {
  const item = { id: "p", quantity: 2, variations: { Cor: "Preto" } };
  const product = {
    id: "p",
    active: true,
    available: true,
    price: 20000,
    salePrice: 15000,
    variations: [{ name: "Cor", options: ["Preto"] }],
  };
  assert.equal(resolveCart([item], [product])[0].subtotal, 30000);
  assert.equal(
    resolveCart([item], [{ ...product, active: false }])[0].valid,
    false,
  );
  assert.equal(
    resolveCart(
      [item],
      [{ ...product, variations: [{ name: "Cor", options: ["Branco"] }] }],
    )[0].valid,
    false,
  );
  assert.equal(resolveCart([item], [])[0].valid, false);
});
