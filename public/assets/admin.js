import { presentationSettings } from "./presentation.js";
import { money } from "./cart.js";
const $ = (s) => document.querySelector(s),
  esc = (s) =>
    String(s ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
let csrf = "",
  store,
  gallery = [],
  editingRevision;
async function api(action, data) {
  const upload = data instanceof FormData;
  const r = await fetch("/api/index.php?action=" + action, {
    method: data ? "POST" : "GET",
    headers: data
      ? {
          "X-CSRF-Token": csrf,
          ...(upload ? {} : { "Content-Type": "application/json" }),
        }
      : {},
    body: data ? (upload ? data : JSON.stringify(data)) : undefined,
    cache: "no-store",
  });
  let j;
  try {
    j = await r.json();
  } catch {
    throw Error("Não foi possível acessar o servidor. Tente novamente.");
  }
  if (!r.ok) {
    if (r.status === 401 && store) location.reload();
    throw Error(j.error);
  }
  return j;
}
function toast(s) {
  $("#toast").textContent = s;
  $("#toast").classList.add("visible");
  setTimeout(() => $("#toast").classList.remove("visible"), 3500);
}
function showError(e) {
  if ($("#admin-error")) {
    $("#admin-error").textContent = e.message;
    $("#admin-error").scrollIntoView({ block: "center" });
  } else $("#auth-error").textContent = e.message;
}
function preview(id) {
  const image = $("#preview-" + id);
  if (image) {
    image.hidden = !$("#" + id).value;
    if (!image.hidden) image.src = $("#" + id).value;
  }
}
function render() {
  const term = $("#admin-search").value.toLocaleLowerCase("pt-BR");
  const rows = store.products
    .filter((p) => p.name.toLocaleLowerCase("pt-BR").includes(term))
    .sort((a, b) => a.order - b.order);
  $("#product-count").textContent =
    store.products.length + " produtos no catálogo";
  $("#clear-demo").hidden = !store.products.some((p) => p.demo);
  $("#admin-products").innerHTML = rows.length
    ? rows
        .map(
          (p) =>
            `<article class="admin-product">${p.image ? `<img src="${esc(p.image)}" alt="">` : ""}<div class="product-summary"><h3>${esc(p.name)}</h3><p>${esc(p.category)} · ${money(p.salePrice ?? p.price)} <span class="status-pill">${p.active ? "Visível" : "Oculto"}${p.demo ? " · Demo" : ""}</span></p></div><div class="row-actions"><button data-edit="${esc(p.id)}">Editar</button><button data-toggle="${esc(p.id)}">${p.active ? "Ocultar" : "Reativar"}</button><button class="danger" data-delete="${esc(p.id)}">Excluir</button></div></article>`,
        )
        .join("")
    : '<div class="empty"><h3>Nenhum produto encontrado.</h3><p>Cadastre seu primeiro produto ou altere a busca.</p></div>';
  $("#categories-input").value = store.categories.join("\n");
  for (const [k, v] of Object.entries(presentationSettings(store.settings))) {
    const el = $("#settings-form").elements.namedItem(k);
    if (el) el.value = v;
  }
  for (const key of ["logo", "heroImage", "aboutImage"])
    preview("settings-" + key);
}
function renderGallery() {
  $("#gallery-preview").innerHTML = gallery
    .map(
      (src, i) =>
        `<div class="gallery-item"><img src="${esc(src)}" alt="Foto ${i + 1}"><button type="button" data-remove-gallery="${i}">Remover foto ${i + 1}</button></div>`,
    )
    .join("");
}
function edit(id) {
  const p = store.products.find((p) => p.id === id) || {
    id: "",
    name: "",
    description: "",
    category: store.categories[0] || "",
    order: store.products.length,
    price: null,
    salePrice: null,
    image: "",
    gallery: [],
    variations: [],
    active: true,
    available: true,
    featured: false,
    demo: false,
  };
  const form = $("#product-form");
  form.reset();
  form.elements.category.innerHTML = store.categories
    .map((c) => `<option>${esc(c)}</option>`)
    .join("");
  for (const [k, v] of Object.entries(p)) {
    const el = form.elements.namedItem(k);
    if (!el) continue;
    if (el.type === "checkbox") el.checked = v;
    else if (k === "price" || k === "salePrice")
      el.value = v == null ? "" : (v / 100).toFixed(2);
    else if (k === "variations")
      el.value = v.map((v) => v.name + ": " + v.options.join(" | ")).join("\n");
    else el.value = v;
  }
  gallery = [...p.gallery];
  editingRevision = store.revision;
  preview("product-image");
  renderGallery();
  $("#editor-error").textContent = "";
  $("#editor-title").textContent = p.id ? "Editar produto" : "Novo produto";
  $("#editor").showModal();
}
async function mutate(action, data) {
  const next = await api(action, { revision: store.revision, ...data });
  store = next;
  render();
  $("#admin-error").textContent = "";
  toast("Alterações salvas.");
}
async function uploading(input) {
  const file = input.files[0];
  if (!file) return;
  const target = input.dataset.upload;
  if (target === "gallery" && gallery.length >= 8) {
    toast("Use até 8 fotos na galeria.");
    return;
  }
  if (file.size > 5 * 1024 * 1024) {
    toast("A imagem deve ter até 5 MB.");
    input.value = "";
    return;
  }
  input.disabled = true;
  const fd = new FormData();
  fd.append("image", file);
  try {
    const result = await api("upload", fd);
    if (target === "gallery") {
      gallery.push(result.path);
      renderGallery();
    } else {
      $("#" + target).value = result.path;
      preview(target);
    }
    toast("Imagem enviada. Salve o formulário para publicar.");
  } catch (e) {
    if ($("#editor")?.open) $("#editor-error").textContent = e.message;
    else showError(e);
  } finally {
    input.disabled = false;
    input.value = "";
  }
}
async function init() {
  const session = await api("session");
  csrf = session.csrf;
  if ($("#auth-form")) {
    if (session.authenticated) {
      location.reload();
      return;
    }
    const setup = !session.installed;
    $("#auth-title").textContent = setup
      ? "Vamos preparar sua loja."
      : "Sua loja, nas suas mãos.";
    $("#auth-description").textContent = setup
      ? session.configured
        ? "Informe sua chave privada e crie uma senha com pelo menos 12 caracteres."
        : "Crie config.local.php a partir do exemplo, fora da pasta pública, e defina uma chave privada de pelo menos 32 caracteres. Depois atualize esta página."
      : "Entre para gerenciar produtos e conteúdos.";
    $("#auth-form").hidden = setup && !session.configured;
    $("#key-label").hidden = !setup;
    $("#confirm-label").hidden = !setup;
    const f = $("#auth-form");
    f.elements.key.required = setup;
    f.elements.confirm.required = setup;
    f.elements.password.minLength = setup ? 12 : 1;
    f.elements.password.autocomplete = setup
      ? "new-password"
      : "current-password";
    $("#auth-submit").textContent = setup ? "Criar administrador" : "Entrar";
    f.onsubmit = async (e) => {
      e.preventDefault();
      const d = Object.fromEntries(new FormData(f));
      if (setup && d.password !== d.confirm) {
        $("#auth-error").textContent = "As senhas não conferem.";
        return;
      }
      $("#auth-submit").disabled = true;
      try {
        await api(setup ? "setup" : "login", d);
        location.reload();
      } catch (err) {
        showError(err);
      } finally {
        $("#auth-submit").disabled = false;
      }
    };
    return;
  }
  store = await api("store");
  render();
  $("#new-product").onclick = () => edit("");
  $("#admin-search").oninput = render;
  $("#logout").onclick = async () => {
    try {
      await api("logout", {});
      location.reload();
    } catch (e) {
      showError(e);
    }
  };
  document.querySelectorAll("[data-tab]").forEach(
    (b) =>
      (b.onclick = () => {
        document
          .querySelectorAll('[id^="tab-"]')
          .forEach((s) => (s.hidden = s.id !== "tab-" + b.dataset.tab));
        document
          .querySelectorAll("[data-tab]")
          .forEach((a) => a.classList.toggle("active", a === b));
      }),
  );
  document.addEventListener("click", async (e) => {
    const close = e.target.closest("[data-close]");
    if (close) {
      if (confirm("Fechar o editor? Alterações não salvas serão descartadas."))
        $("#editor").close();
      return;
    }
    const editButton = e.target.closest("[data-edit]");
    if (editButton) edit(editButton.dataset.edit);
    const toggle = e.target.closest("[data-toggle]");
    const del = e.target.closest("[data-delete]");
    try {
      if (toggle) {
        const p = store.products.find((p) => p.id === toggle.dataset.toggle);
        await mutate("product-save", { product: { ...p, active: !p.active } });
      }
      if (del && confirm("Excluir este produto do catálogo?"))
        await mutate("product-delete", { id: del.dataset.delete });
    } catch (err) {
      showError(err);
    }
    const remove = e.target.closest("[data-remove-gallery]");
    if (remove) {
      gallery.splice(Number(remove.dataset.removeGallery), 1);
      renderGallery();
    }
    const clear = e.target.closest("[data-clear]");
    if (clear) {
      $("#" + clear.dataset.clear).value = "";
      preview(clear.dataset.clear);
    }
  });
  document
    .querySelectorAll("[data-upload]")
    .forEach((i) => (i.onchange = () => uploading(i)));
  $("#clear-demo").onclick = async () => {
    if (confirm("Remover somente os produtos marcados como demonstrativos?"))
      try {
        await mutate("demo-clear", {});
      } catch (e) {
        showError(e);
      }
  };
  $("#product-form").onsubmit = async (e) => {
    e.preventDefault();
    const form = e.target,
      fd = new FormData(form),
      p = Object.fromEntries(fd);
    p.price = p.price === "" ? null : Math.round(Number(p.price) * 100);
    p.salePrice =
      p.salePrice === "" ? null : Math.round(Number(p.salePrice) * 100);
    p.order = Number(p.order);
    p.gallery = gallery;
    for (const k of ["active", "available", "featured", "demo"])
      p[k] = form.elements[k].checked;
    try {
      p.variations = p.variations.trim()
        ? p.variations
            .split("\n")
            .filter((v) => v.trim())
            .map((v) => {
              const colon = v.indexOf(":");
              if (colon < 1) throw Error("Variação: use Nome: opção | opção.");
              return {
                name: v.slice(0, colon).trim(),
                options: v
                  .slice(colon + 1)
                  .split("|")
                  .map((s) => s.trim())
                  .filter(Boolean),
              };
            })
        : [];
      const button = form.querySelector("button[type=submit],button.button");
      button.disabled = true;
      try {
        store = await api("product-save", {
          revision: editingRevision,
          product: p,
        });
        render();
        $("#editor").close();
        toast("Produto salvo.");
      } finally {
        button.disabled = false;
      }
    } catch (err) {
      $("#editor-error").textContent = err.message;
    }
  };
  $("#settings-form").onsubmit = async (e) => {
    e.preventDefault();
    try {
      await mutate("settings-save", {
        settings: Object.fromEntries(new FormData(e.target)),
      });
    } catch (err) {
      showError(err);
    }
  };
  $("#categories-form").onsubmit = async (e) => {
    e.preventDefault();
    try {
      await mutate("categories-save", {
        categories: $("#categories-input")
          .value.split("\n")
          .map((s) => s.trim())
          .filter(Boolean),
      });
    } catch (err) {
      showError(err);
    }
  };
  $("#password-form").onsubmit = async (e) => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(e.target));
    if (d.password !== d.confirm) {
      showError(Error("As senhas não conferem."));
      return;
    }
    try {
      await api("password", d);
      e.target.reset();
      toast("Senha atualizada.");
    } catch (err) {
      showError(err);
    }
  };
}
init().catch(showError);
