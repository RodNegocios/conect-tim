import { presentationSettings } from "./presentation.js";
import { money, keyOf, normalize, resolveCart } from "./cart.js";
const $ = (s) => document.querySelector(s);
const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const arrow =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M4 12h16m-6-6 6 6-6 6"/></svg>';
let catalog,
  category = "Todos",
  cart = [],
  activeProduct;
try {
  cart = normalize(JSON.parse(localStorage.getItem("connect-cart") || "[]"));
} catch {}
function toast(message) {
  $("#toast").textContent = message;
  $("#toast").classList.add("visible");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => $("#toast").classList.remove("visible"), 3500);
}
function saveCart() {
  cart = normalize(cart);
  try {
    localStorage.setItem("connect-cart", JSON.stringify(cart));
  } catch {
    toast("O navegador não permitiu salvar sua seleção.");
  }
  renderCart();
}
async function api(action, data) {
  const r = await fetch("/api/index.php?action=" + action, {
    method: data ? "POST" : "GET",
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    cache: "no-store",
  });
  let j;
  try {
    j = await r.json();
  } catch {
    throw new Error(
      "A loja está temporariamente indisponível. Tente novamente.",
    );
  }
  if (!r.ok) throw new Error(j.error);
  return j;
}
function setText(selector, text) {
  $(selector).textContent = text;
}
function renderShowroom(settings) {
  const media = $("#showroom-media");
  if (settings.heroImage && settings.heroImage !== "/assets/loja.webp") {
    const banner = new Image();
    banner.src = settings.heroImage;
    banner.alt = settings.heroTitle;
    banner.className = "showroom-banner";
    media.replaceChildren(banner);
    media.hidden = false;
    return;
  }

  const selection = catalog.products
    .filter((product) => product.image)
    .sort((a, b) => Number(b.featured) - Number(a.featured))
    .slice(0, 3);
  media.hidden = selection.length === 0;
  media.innerHTML = selection.map((product) => `
    <button class="showroom-piece" data-product="${esc(product.id)}" aria-label="Ver detalhes de ${esc(product.name)}">
      <img src="${esc(product.image)}" alt="" width="400" height="400">
      <span>${esc(product.name)}</span>
      ${product.demo ? "<small>Demonstração</small>" : ""}
    </button>`).join("");
}
function applySettings() {
  const s = presentationSettings(catalog.settings);
  document.title = s.name + " — " + s.tagline;
  document
    .querySelectorAll("[data-store-name]")
    .forEach((el) => (el.textContent = s.name));
  document.querySelectorAll("[data-logo]").forEach((el) => {
    el.src = s.logo || "/assets/logo.webp";
    el.alt = s.name;
  });
  setText("#hero-title", s.heroTitle);
  setText("#hero-text", s.heroText);
  $("#hero-text").hidden = !s.heroText;
  setText("#about-text", s.about);
  setText("#address", s.address);
  setText("#hours", s.hours);
  setText("#phone", s.phone);
  $("#phone").href = "tel:" + s.phone.replace(/[^+\d]/g, "");
  renderShowroom(s);
  $("#about-image").src = s.aboutImage || "/assets/loja.webp";
  $("#map-link").href =
    "https://www.google.com/maps/search/?api=1&query=" +
    encodeURIComponent(s.address);
  for (const name of ["instagram", "facebook"]) {
    $("#" + name).hidden = !s[name];
    if (s[name]) $("#" + name).href = s[name];
  }
  $("#campaign").hidden = !s.campaign;
  setText("#campaign", s.campaign);
  document.querySelectorAll("[data-contact]").forEach((a) => {
    a.href = s.whatsapp
      ? "https://wa.me/" + s.whatsapp
      : "tel:" + s.phone.replace(/[^+\d]/g, "");
    a.target = "_blank";
    a.rel = "noopener noreferrer";
  });
}
function renderFilters() {
  $("#filters").innerHTML = ["Todos", ...catalog.categories]
    .map(
      (c) =>
        `<button class="filter ${c === category ? "active" : ""}" data-category="${esc(c)}" aria-pressed="${c === category}">${esc(c)}</button>`,
    )
    .join("");
}
function renderProducts() {
  const term = $("#search").value.trim().toLocaleLowerCase("pt-BR");
  let rows = catalog.products.filter(
    (p) =>
      (category === "Todos" || p.category === category) &&
      [p.name, p.description, p.category]
        .join(" ")
        .toLocaleLowerCase("pt-BR")
        .includes(term),
  );
  const sort = $("#sort").value;
  rows.sort((a, b) =>
    sort === "name"
      ? a.name.localeCompare(b.name, "pt-BR")
      : sort.startsWith("price")
        ? a.price == null
          ? 1
          : b.price == null
            ? -1
            : (sort === "price-asc" ? 1 : -1) *
              ((a.salePrice ?? a.price) - (b.salePrice ?? b.price))
        : Number(b.featured) - Number(a.featured) || a.order - b.order,
  );
  setText(
    "#results",
    `${rows.length} ${rows.length === 1 ? "produto" : "produtos"}`,
  );
  $("#demo-note").hidden = !rows.some((p) => p.demo);
  $("#products").innerHTML = rows.length
    ? rows
        .map(
          (p) =>
            `<article class="product-card"><button class="product-photo" data-product="${esc(p.id)}" aria-label="Ver ${esc(p.name)}"><span class="badge">${p.demo ? "Demonstração" : p.salePrice != null ? "Preço especial" : p.featured ? "Em destaque" : esc(p.category)}</span>${p.image ? `<img src="${esc(p.image)}" alt="${esc(p.name)}" loading="lazy" width="500" height="500">` : '<span class="no-image">Imagem em breve</span>'}<span class="photo-arrow">${arrow}</span></button><div class="product-info"><button class="product-name" data-product="${esc(p.id)}">${esc(p.name)}</button><div class="product-pricing"><div>${p.salePrice != null ? `<del>${money(p.price)}</del>` : ""}<strong>${money(p.salePrice ?? p.price)}</strong>${p.available ? "" : "<small>Indisponível</small>"}</div></div>${p.variations.map((v, i) => `<label class="quick-variation">${esc(v.name)}<select data-quick-variation="${i}" required aria-label="${esc(v.name)} de ${esc(p.name)}" ${!p.available ? "disabled" : ""}><option value="">Escolha ${esc(v.name.toLowerCase())}</option>${v.options.map((o) => `<option>${esc(o)}</option>`).join("")}</select></label>`).join("")}<button class="quick-add" data-add="${esc(p.id)}" aria-label="Adicionar ${esc(p.name)} ao carrinho" ${!p.available ? "disabled" : ""}>${p.available ? "+ Adicionar" : "Indisponível"}</button></div></article>`,
        )
        .join("")
    : '<div class="empty"><h3>Nenhum produto por aqui.</h3><p>Tente outra busca ou explore as outras categorias.</p><button id="reset-filters" class="button">Ver todo o catálogo</button></div>';
}
function openProduct(id) {
  const p = catalog.products.find((p) => p.id === id);
  if (!p) {
    toast("Este produto não está disponível.");
    return;
  }
  activeProduct = p;
  const images = [p.image, ...p.gallery].filter(Boolean);
  $("#product-detail").innerHTML =
    `<div class="detail-media">${images.length ? `<img id="detail-main" src="${esc(images[0])}" alt="${esc(p.name)}"><div class="thumbnails">${images.map((src, i) => `<button data-image="${esc(src)}" aria-label="Ver foto ${i + 1}"><img src="${esc(src)}" alt=""></button>`).join("")}</div>` : "<p>Imagem em breve</p>"}</div><div class="detail-copy"><p class="eyebrow">${esc(p.category)}</p><h2 id="product-title">${esc(p.name)}</h2>${p.demo ? '<p class="demo-tag">Produto demonstrativo</p>' : ""}<p class="description">${esc(p.description)}</p><div class="detail-price">${p.salePrice != null ? `<del>${money(p.price)}</del>` : ""}<strong>${money(p.salePrice ?? p.price)}</strong></div><form id="add-form">${p.variations.map((v, i) => `<label>${esc(v.name)}<select name="variation-${i}" required><option value="">Selecione uma opção</option>${v.options.map((o) => `<option>${esc(o)}</option>`).join("")}</select></label>`).join("")}<label>Quantidade<input name="quantity" type="number" min="1" max="99" value="1" required></label><button class="button" ${!p.available ? "disabled" : ""}>${p.available ? "Adicionar ao carrinho" : "Indisponível"} ${arrow}</button></form><p class="fineprint">Finalização pelo WhatsApp. Confirme os detalhes com a nossa equipe.</p><a class="text-link" href="?produto=${encodeURIComponent(p.id)}">Link deste produto ${arrow}</a></div>`;
  if (!$("#product-dialog").open) $("#product-dialog").showModal();
}
function addToCart(item) {
  const existing = cart.find((r) => keyOf(r) === keyOf(item));
  if (existing && existing.quantity + item.quantity > 99) {
    toast("Limite de 99 unidades por opção.");
    return false;
  }
  if (existing) existing.quantity += item.quantity;
  else if (cart.length >= 50) {
    toast("Limite de 50 itens diferentes.");
    return false;
  } else cart.push(item);
  saveCart();
  return true;
}

function renderCart() {
  setText(
    "#cart-count",
    cart.reduce((s, i) => s + i.quantity, 0),
  );
  if (!catalog) return;
  const rows = resolveCart(cart, catalog.products);
  $("#cart-bottom").hidden = !rows.length;
  $("#cart-items").innerHTML = rows.length
    ? rows
        .map(
          (r, i) =>
            `<article class="cart-row">${r.product?.image ? `<img src="${esc(r.product.image)}" alt="">` : ""}<div><h3>${esc(r.product?.name || "Produto removido")}</h3><small>${esc(
              Object.entries(r.variations)
                .map(([k, v]) => k + ": " + v)
                .join(" · "),
            )}</small>${!r.valid ? '<p class="error">Indisponível ou variação alterada. Remova este item.</p>' : `<strong>${money(r.subtotal)}</strong>`}<div class="quantity"><button data-qty="${i}" data-delta="-1" aria-label="Diminuir quantidade" ${r.quantity <= 1 ? "disabled" : ""}>−</button><span>${r.quantity}</span><button data-qty="${i}" data-delta="1" aria-label="Aumentar quantidade" ${r.quantity >= 99 ? "disabled" : ""}>+</button><button class="remove" data-remove="${i}">Remover</button></div></div></article>`,
        )
        .join("")
    : `<div class="empty"><h3>Sua seleção começa aqui.</h3><p>Explore o catálogo e adicione seus favoritos.</p><button class="button" data-close>Explorar produtos ${arrow}</button></div>`;
  const total = rows.reduce((s, r) => s + (r.valid ? (r.subtotal ?? 0) : 0), 0),
    unknown = rows.some((r) => r.valid && r.subtotal == null);
  setText(
    "#cart-total",
    unknown
      ? total
        ? money(total) + " + consulta"
        : "A confirmar"
      : money(total),
  );
  $("#checkout").disabled =
    !rows.length || rows.some((r) => !r.valid) || !catalog.settings.whatsapp;
  setText(
    "#checkout-error",
    !catalog.settings.whatsapp
      ? "O WhatsApp ainda não foi configurado. Entre em contato com a loja."
      : rows.some((r) => !r.valid)
        ? "Remova os itens indisponíveis para continuar."
        : "",
  );
}
async function load() {
  catalog = await api("catalog");
  applySettings();
  renderFilters();
  renderProducts();
  renderCart();
}
$("#filters").addEventListener("click", (e) => {
  const b = e.target.closest("[data-category]");
  if (b) {
    category = b.dataset.category;
    renderFilters();
    renderProducts();
  }
});
$("#search").addEventListener("input", renderProducts);
$("#sort").addEventListener("change", renderProducts);
document.addEventListener("click", (e) => {
  const add = e.target.closest("[data-add]");
  if (add) {
    const product = catalog.products.find((p) => p.id === add.dataset.add);
    if (!product?.available) return;
    const card = add.closest(".product-card");
    const variations = {};
    for (const [index, variation] of product.variations.entries()) {
      const select = card.querySelector(`[data-quick-variation="${index}"]`);
      if (!select.reportValidity()) return;
      variations[variation.name] = select.value;
    }
    if (addToCart({ id: product.id, variations, quantity: 1 })) {
      toast("Adicionado ao carrinho");
    }
  }
  const p = e.target.closest("[data-product]");
  if (p) openProduct(p.dataset.product);
  if (e.target.closest("[data-close]")) e.target.closest("dialog").close();
  const thumb = e.target.closest("[data-image]");
  if (thumb) $("#detail-main").src = thumb.dataset.image;
  if (e.target.closest("#reset-filters")) {
    category = "Todos";
    $("#search").value = "";
    renderFilters();
    renderProducts();
  }
  const q = e.target.closest("[data-qty]");
  if (q) {
    cart[Number(q.dataset.qty)].quantity += Number(q.dataset.delta);
    saveCart();
  }
  const r = e.target.closest("[data-remove]");
  if (r) {
    cart.splice(Number(r.dataset.remove), 1);
    saveCart();
  }
});
$("#product-detail").addEventListener("submit", (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  const item = {
    id: activeProduct.id,
    variations: Object.fromEntries(
      activeProduct.variations.map((v, i) => [
        v.name,
        fd.get("variation-" + i),
      ]),
    ),
    quantity: Number(fd.get("quantity")),
  };
  if (!addToCart(item)) return;
  $("#product-dialog").close();
  toast("Adicionado à sua seleção");
  $("#cart-dialog").showModal();
});
$("#open-cart").addEventListener("click", async () => {
  if (!catalog) return;
  renderCart();
  $("#cart-dialog").showModal();
  try {
    await load();
  } catch (e) {
    setText("#checkout-error", e.message);
    $("#checkout").disabled = true;
  }
});
for (const dialog of document.querySelectorAll("dialog"))
  dialog.addEventListener("click", (e) => {
    if (e.target === dialog) {
      const r = dialog.getBoundingClientRect();
      if (
        e.clientX < r.left ||
        e.clientX > r.right ||
        e.clientY < r.top ||
        e.clientY > r.bottom
      )
        dialog.close();
    }
  });
$("#checkout").addEventListener("click", async () => {
  const button = $("#checkout");
  button.disabled = true;
  setText("#checkout-error", "");
  try {
    const result = await api("quote", {
      items: cart,
      name: $("#customer-name").value,
      notes: $("#customer-notes").value,
    });
    window.location.assign(result.url);
  } catch (e) {
    setText("#checkout-error", e.message);
    button.disabled = false;
  }
});
window.addEventListener("storage", (e) => {
  if (e.key === "connect-cart") {
    try {
      cart = normalize(JSON.parse(e.newValue || "[]"));
      renderCart();
    } catch {}
  }
});
load()
  .then(() => {
    const id = new URLSearchParams(location.search).get("produto");
    if (id) openProduct(id);
  })
  .catch((e) => {
    $("#products").innerHTML =
      `<div class="empty"><h3>Não conseguimos carregar a loja.</h3><p>${esc(e.message)}</p><button class="button" id="retry">Tentar novamente</button></div>`;
    setText("#results", "Catálogo indisponível");
    $("#retry").onclick = () => location.reload();
  });
