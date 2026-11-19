const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
fs.mkdirSync(
  process.env.TEST_SCREENSHOTS || path.join(__dirname, "../test-results"),
  { recursive: true },
);
const base = process.env.TEST_BASE || "http://127.0.0.1:8081";
(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    headless: true,
    args: ["--no-sandbox"],
  });
  let checks = 0;
  const uploads = [];
  const errors = [];
  function check(value, label) {
    assert.ok(value, label);
    console.log("PASS browser:", label);
    checks++;
  }
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("dialog", (d) => d.accept());
  try {
    await page.goto(base + "/admin/");
    await page.locator("[name=password]").fill(process.env.TEST_PASSWORD);
    await page.locator("#auth-submit").click();
    await page.waitForSelector("#new-product");
    check(
      (await page.locator("#admin-products .admin-product").count()) === 7,
      "Administrator login opens protected panel",
    );
    await page.locator("#new-product").click();
    const form = page.locator("#product-form");
    await form
      .locator("[name=name]")
      .fill("Produto de teste <img src=x onerror=alert(1)>");
    await form
      .locator("[name=description]")
      .fill("Descrição de teste com acentos & detalhes.");
    await form.locator("[name=price]").fill("150.50");
    await form.locator("[name=salePrice]").fill("120.25");
    await form
      .locator("[name=variations]")
      .fill("Cor: Preto | Branco\nTamanho: P | M");
    const uploadResponse = page.waitForResponse((r) =>
      r.url().includes("action=upload"),
    );
    await form
      .locator("[data-upload=product-image]")
      .setInputFiles(
        path.join(__dirname, "../public/assets/scooter-branca.webp"),
      );
    const up = await (await uploadResponse).json();
    uploads.push(up.path);
    await page.waitForFunction(() =>
      document.querySelector("#product-image").value.startsWith("/uploads/"),
    );
    check(
      await form.locator(".upload-preview").isVisible(),
      "Image upload preview visible",
    );
    const galleryResponse = page.waitForResponse((r) =>
      r.url().includes("action=upload"),
    );
    await form
      .locator("[data-upload=gallery]")
      .setInputFiles(
        path.join(__dirname, "../public/assets/scooter-cinza.webp"),
      );
    uploads.push((await (await galleryResponse).json()).path);
    await page.waitForSelector("#gallery-preview img");
    check(
      (await form.locator("#gallery-preview img").count()) === 1,
      "Gallery upload preview",
    );
    await form.locator("button.button").click();
    await page.waitForFunction(() => !document.querySelector("#editor").open);
    check(
      (await page.locator(".admin-product").count()) === 8,
      "Product saved from panel",
    );
    let row = page
      .locator(".admin-product")
      .filter({ hasText: "Produto de teste" });
    await row.locator("[data-edit]").click();
    await form
      .locator("[name=description]")
      .fill("Descrição atualizada pelo painel.");
    await form.locator("[name=price]").fill("160");
    await form.locator("[data-remove-gallery]").click();
    await form.locator("button.button").click();
    await page.waitForFunction(() => !document.querySelector("#editor").open);
    await row.locator("[data-toggle]").click();
    await page.waitForFunction(() =>
      [...document.querySelectorAll(".admin-product")].some(
        (e) =>
          e.textContent.includes("Produto de teste") &&
          e.textContent.includes("Oculto"),
      ),
    );
    let publicData = await (
      await page.request.get(base + "/api/index.php")
    ).json();
    check(
      !publicData.products.some((p) => p.name.startsWith("Produto de teste")),
      "Hide product reflected in public API",
    );
    await row.locator("[data-toggle]").click();
    await page.waitForFunction(
      () =>
        [...document.querySelectorAll(".admin-product")].some(
          (e) =>
            e.textContent.includes("Produto de teste") &&
            e.textContent.includes("Reativar"),
        ) === false,
    );
    publicData = await (await page.request.get(base + "/api/index.php")).json();
    const product = publicData.products.find((p) =>
      p.name.startsWith("Produto de teste"),
    );
    check(
      product.gallery.length === 0 &&
        product.description === "Descrição atualizada pelo painel." &&
        product.price === 16000,
      "Edited data persisted",
    );
    await page.locator("[data-tab=settings]").click();
    await page
      .locator("#settings-form [name=campaign]")
      .fill("Campanha de teste sem oferta comercial");
    await page.locator("#settings-form .button").click();
    await page.waitForFunction(
      () =>
        document.querySelector("#toast").textContent === "Alterações salvas.",
    );
    await page.locator("[data-tab=security]").click();
    const download = page.waitForEvent("download");
    await page.getByText("Baixar catálogo JSON").click();
    check(
      (await download).suggestedFilename().endsWith(".json"),
      "Catalog backup download",
    );
    await page.goto(base);
    await page.waitForSelector(".product-card");
    check(
      (await page.locator("#campaign").textContent()) ===
        "Campanha de teste sem oferta comercial",
      "Campaign updated without redeploy",
    );
    check(
      (await page.locator(".product-card").count()) === 8,
      "Dynamic storefront catalog",
    );
    const highlights = page.locator("#showroom-media .showroom-piece");
    check(
      (await highlights.locator(".showroom-name").allTextContents()).map((label) => label.trim()).join(",") === "iPhone 14,iPhone 15,iPhone 17",
      "Home features the three iPhone models in order",
    );
    check(
      (await highlights.locator(".offer-seal").count()) === 3 &&
        (await page.locator(".product-card > .offer-seal").count()) === 4,
      "Available featured iPhones and the discounted test product carry Black Friday seals",
    );
    const ribbon = page.locator(".showroom-ribbon");
    const ribbonOffset = () => ribbon.locator("textPath").getAttribute("startOffset");
    await page.waitForSelector("#showroom-wave[d]", { state: "attached" });
    const initialOffset = await ribbonOffset();
    await page.evaluate(() => window.scrollBy({ top: 180, behavior: "instant" }));
    await page.waitForFunction((before) =>
      document.querySelector(".showroom-ribbon textPath").getAttribute("startOffset") !== before, initialOffset);
    check(Number(await ribbonOffset()) < Number(initialOffset), "Ribbon lettering tracks downward scroll");
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await page.waitForFunction((before) =>
      document.querySelector(".showroom-ribbon textPath").getAttribute("startOffset") === before, initialOffset);
    check(await page.locator(".showroom-links .button, .offer-seal").evaluateAll((elements) =>
      elements.every((el) => getComputedStyle(el).backgroundImage === "none")), "Flat orange offer seals and hero button");
    for (const model of ["iPhone 14", "iPhone 15", "iPhone 17"]) {
      const highlight = highlights.filter({ hasText: model });
      await highlight.locator("img").evaluate((image) => image.decode());
      await highlight.click();
      check(
        await page.locator("#product-dialog[open] #product-title").textContent() === model,
        model + " image loads and opens matching product",
      );
      await page.getByRole("button", { name: "Fechar detalhes" }).click();
    }
    await page.locator("#search").fill("inexistente");
    check(
      (await page.locator("#products .empty").count()) === 1,
      "Search empty state",
    );
    await page.locator("#reset-filters").click();
    await page.getByRole("button", { name: "Acessórios", exact: true }).click();
    check(
      (await page.locator("#products .empty").count()) === 1,
      "Category filter empty state",
    );
    await page.locator("#reset-filters").click();
    await page.goto(base + "/?produto=" + product.id);
    await page.waitForSelector("#product-dialog[open]");
    check(
      (await page.locator("#product-title").textContent()) === product.name,
      "Individual product deep link and safe text rendering",
    );
    check(
      (await page.locator("#product-title img").count()) === 0,
      "Product HTML is escaped",
    );
    check(
      (await page.locator("#product-detail .offer-seal").textContent()) === "Black Friday" &&
        await page.locator("#product-detail .detail-price del").isVisible(),
      "Discounted product shows its seal alongside original and sale prices",
    );
    await page.locator("#add-form [name=variation-0]").selectOption("Preto");
    await page.locator("#add-form [name=variation-1]").selectOption("M");
    await page.locator("#add-form [name=quantity]").fill("2");
    await page.locator("#add-form .button").click();
    await page.waitForSelector("#cart-dialog[open]");
    check(
      (await page.locator("#cart-total").textContent()).includes("240,50"),
      "Selected variations and initial cart total",
    );
    await page.getByRole("button", { name: "Aumentar quantidade" }).click();
    check(
      (await page.locator("#cart-total").textContent()).includes("360,75"),
      "Quantity increase recalculates total",
    );
    await page.getByRole("button", { name: "Diminuir quantidade" }).click();
    const saved = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("connect-cart")),
    );
    check(
      Object.keys(saved[0]).sort().join(",") === "id,quantity,variations",
      "Only identifiers, quantities and variations in localStorage",
    );
    await page.goto(base);
    await page.waitForSelector(".product-card");
    await page.locator("#open-cart").click();
    await page.waitForSelector("#cart-dialog[open]");
    check(
      (await page.locator("#cart-total").textContent()).includes("240,50"),
      "Cart persists across navigation and reload",
    );
    await page.locator("#customer-name").fill("João & Ana");
    await page.locator("#customer-notes").fill("Consultar retirada às 16h.");
    let destination = "";
    await page.route("https://wa.me/**", async (route) => {
      destination = route.request().url();
      await route.fulfill({
        status: 200,
        contentType: "text/html",
        body: "<!doctype html><title>WhatsApp interceptado pelo teste</title>",
      });
    });
    let quote;
    await page.route("**/api/index.php?action=quote", async (route) => {
      const response = await route.fetch();
      quote = await response.json();
      await route.fulfill({ response });
    });
    await page.locator("#checkout").click();
    for (let i = 0; i < 50 && !destination; i++) await page.waitForTimeout(50);
    check(
      quote.message.includes("João & Ana") &&
        quote.message.includes("Quantidade: 2") &&
        quote.message.includes("Cor: Preto") &&
        quote.message.includes("Tamanho: M") &&
        quote.message.includes("240,50"),
      "WhatsApp message has actual cart, variations, quantities and current total",
    );
    check(
      destination.startsWith("https://wa.me/556596437427?text="),
      "Checkout opens configured WhatsApp link",
    );
    await page.waitForURL("https://wa.me/**");
    await page.waitForLoadState("load");
    await page.goto(base);
    await page.waitForSelector(".product-card");
    await page.locator("#open-cart").click();
    await page.getByRole("button", { name: "Remover", exact: true }).click();
    check(
      (await page.locator("#cart-items .empty").isVisible()) &&
        (await page.locator("#cart-bottom").isHidden()),
      "Remove last item disables checkout and shows empty state",
    );
    await page.getByRole("button", { name: "Fechar carrinho" }).click();
    for (const [name, width, height] of [
      ["desktop", 1440, 1000],
      ["tablet", 820, 1180],
      ["mobile", 390, 844],
    ]) {
      await page.setViewportSize({ width, height });
      check(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        "No horizontal overflow: " + name,
      );
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
      const storefront = page.locator(".showroom-storefront");
      await storefront.evaluate((image) => image.decode());
      const photo = await storefront.boundingBox();
      check(
        (await storefront.getAttribute("src")) === "/assets/loja.webp" &&
          photo && photo.width > 0 && photo.height > 0 && photo.y < height,
        "Storefront photo visible in hero: " + name,
      );
      await page.locator('header nav a[href="#catalogo"]').click();
      await page.waitForFunction(
        () =>
          document.querySelector("#catalogo").getBoundingClientRect().y <
          innerHeight,
      );
      check(
        (await page.locator("#catalogo").boundingBox()).y < height,
        "Catalog navigation: " + name,
      );
      const cartButton = page.locator("#open-cart");
      const cartBounds = await cartButton.boundingBox();
      const bottomGap = height - cartBounds.y - cartBounds.height;
      check(
        (await cartButton.evaluate((button) => getComputedStyle(button).position)) === "fixed" &&
          Math.abs(cartBounds.x + cartBounds.width / 2 - width / 2) <= 1 &&
          bottomGap >= 0 && bottomGap <= 32,
        "Cart fixed at bottom center after navigation: " + name,
      );
      await page.screenshot({
        path: path.join(
          process.env.TEST_SCREENSHOTS ||
            path.join(__dirname, "../test-results"),
          "tested-" + name + ".png",
        ),
        fullPage: true,
      });
    }
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.waitForFunction(() =>
      document.querySelector(".showroom-ribbon g").transform.baseVal.consolidate().matrix.e === 0);
    const stillOffset = await ribbonOffset();
    await ribbon.scrollIntoViewIfNeeded();
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    check(await ribbonOffset() === stillOffset, "Ribbon stays still while scrolling with reduced motion");
    check(
      (await page
        .locator(".product-card")
        .first()
        .evaluate((el) => getComputedStyle(el).animationName)) === "none",
      "Reduced motion respected",
    );
    await page.goto(base + "/admin/");
    await page.waitForSelector("#new-product");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({
      path: path.join(__dirname, "../test-results/admin-mobile.png"),
      fullPage: true,
    });
    check(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      "Admin mobile has no horizontal overflow",
    );
    row = page
      .locator(".admin-product")
      .filter({ hasText: "Produto de teste" });
    await row.locator("[data-delete]").click();
    await page.waitForFunction(
      () => document.querySelectorAll(".admin-product").length === 7,
    );
    check(true, "Product deletion through panel");
    await page.locator("[data-tab=settings]").click();
    await page.locator("#settings-form [name=campaign]").fill("");
    await page.locator("#settings-form .button").click();
    await page.waitForFunction(
      () =>
        document.querySelector("#toast").textContent === "Alterações salvas.",
    );
    await page.locator("#logout").click();
    await page.waitForSelector("#auth-form");
    check(
      (await page.locator("#new-product").count()) === 0,
      "Logout removes administrative pages",
    );
    check(errors.length === 0, "No JavaScript runtime errors");
    console.log(`PASS: ${checks} browser checks`);
  } finally {
    await browser.close();
    for (const file of uploads)
      if (file?.startsWith("/uploads/"))
        fs.rmSync(path.join(__dirname, "../public", file), { force: true });
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
