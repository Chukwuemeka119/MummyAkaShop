/**
 * ==========================================================================
 * APP.JS — application shell, router, and view orchestration
 * --------------------------------------------------------------------------
 * Mummy Aka Shop is built as a lightweight hash-routed single-page app so
 * every "page" in the brief (home, shop, product detail, cart, checkout,
 * auth, profile, orders, wishlist, admin) lives behind a URL fragment
 * without needing a bundler or framework. Each route renders into
 * <main id="view-root"> and wires up its own event listeners.
 * ==========================================================================
 */

import { PRODUCTS, CATEGORIES, getProduct, formatNaira, stockLabel, productCardHTML, categoryStripHTML, queryProducts, syncCatalogFromStockySaver, watchCatalogFromStockySaver, isLiveCatalog } from "./products.js";
import { Cart, Wishlist, getCartSummary, cartViewHTML } from "./cart.js";
import { AuthAPI, AdminAuth, OrdersStore, authViewHTML, profileViewHTML } from "./auth.js";
import { StockySaverAPI, withGracefulSync } from "./stockysaver-api.js";
import { STORE_INFO } from "./store-config.js";
import { isConfigured as firebaseConfigured, fetchSalesList } from "./firebase.js";

const root = document.getElementById("view-root");
const crumbsEl = document.getElementById("crumbs");

// ---------------------------------------------------------------------------
// Toasts
// ---------------------------------------------------------------------------
const toastStack = document.getElementById("toast-stack");
export function toast(message, type = "") {
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.setAttribute("role", "status");
  el.textContent = message;
  toastStack.appendChild(el);
  setTimeout(() => {
    el.style.opacity = "0";
    el.style.transform = "translateY(8px)";
    setTimeout(() => el.remove(), 260);
  }, 2800);
}

// ---------------------------------------------------------------------------
// Theme (dark mode) — persisted, respects system preference on first visit
// ---------------------------------------------------------------------------
function initTheme() {
  const saved = localStorage.getItem("mas_theme");
  const theme = saved || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  document.documentElement.setAttribute("data-theme", theme);
  updateThemeToggleUI(theme);
}
function toggleTheme() {
  const current = document.documentElement.getAttribute("data-theme");
  const next = current === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", next);
  localStorage.setItem("mas_theme", next);
  updateThemeToggleUI(next);
}
function updateThemeToggleUI(theme) {
  document.querySelectorAll("[data-action='toggle-theme']").forEach((btn) => {
    btn.setAttribute("aria-pressed", theme === "dark");
    const knob = btn.querySelector(".knob");
    if (knob) knob.textContent = theme === "dark" ? "🌙" : "☀️";
  });
}

// ---------------------------------------------------------------------------
// Store info (contact/location/hours) — pulled from store-config.js and
// applied to the static header/footer markup that lives outside the router.
// ---------------------------------------------------------------------------
function isPlaceholder(value) {
  return !value || /^PASTE_/.test(value);
}
function applyStoreInfo() {
  const phoneLink = document.getElementById("footer-phone");
  const emailLink = document.getElementById("footer-email");
  const addressEl = document.getElementById("footer-address");
  const announceEl = document.getElementById("announce-bar");

  if (phoneLink && !isPlaceholder(STORE_INFO.phone)) {
    phoneLink.textContent = `Call: ${STORE_INFO.phone}`;
    phoneLink.href = `tel:${STORE_INFO.phone.replace(/[^\d+]/g, "")}`;
  }
  if (emailLink && !isPlaceholder(STORE_INFO.email)) {
    emailLink.textContent = STORE_INFO.email;
    emailLink.href = `mailto:${STORE_INFO.email}`;
  }
  if (addressEl && !isPlaceholder(STORE_INFO.addressLine)) {
    addressEl.textContent = `${STORE_INFO.addressLine}, ${STORE_INFO.city}`;
  }
  if (announceEl) {
    const threshold = formatNaira(STORE_INFO.freeDeliveryThreshold);
    announceEl.textContent = `Free delivery in ${STORE_INFO.city} on orders over ${threshold} · Live inventory synced with StockySaver`;
  }
}


function refreshBadges() {
  const cartCount = Cart.count();
  document.querySelectorAll("[data-badge='cart']").forEach((b) => {
    b.textContent = cartCount;
    b.style.display = cartCount > 0 ? "flex" : "none";
  });
  const wishCount = Wishlist.items().length;
  document.querySelectorAll("[data-badge='wishlist']").forEach((b) => {
    b.textContent = wishCount;
    b.style.display = wishCount > 0 ? "flex" : "none";
  });
  const user = AuthAPI.currentUser();
  document.querySelectorAll("[data-account-label]").forEach((el) => {
    el.textContent = user ? user.name.split(" ")[0] : "Account";
  });
}
window.addEventListener("cart:change", refreshBadges);
window.addEventListener("wishlist:change", refreshBadges);
window.addEventListener("auth:change", refreshBadges);

// ---------------------------------------------------------------------------
// Scroll-reveal animation observer
// ---------------------------------------------------------------------------
let observer;
function initReveal() {
  if (observer) observer.disconnect();
  observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add("in-view");
          observer.unobserve(e.target);
        }
      });
    },
    { threshold: 0.1 }
  );
  document.querySelectorAll(".reveal:not(.in-view)").forEach((el) => observer.observe(el));
}

// ---------------------------------------------------------------------------
// Breadcrumbs
// ---------------------------------------------------------------------------
function setCrumbs(items) {
  crumbsEl.innerHTML = items
    .map((it, i) => (i === items.length - 1 ? `<span>${it.label}</span>` : `<a href="${it.href}">${it.label}</a> / `))
    .join("");
  crumbsEl.style.display = items.length ? "block" : "none";
}

// ===========================================================================
// ROUTER
// ===========================================================================
function parseHash() {
  const hash = location.hash.replace(/^#\/?/, "");
  const [pathPart, queryPart] = hash.split("?");
  const segments = pathPart.split("/").filter(Boolean);
  const params = new URLSearchParams(queryPart || "");
  return { segments, params };
}

const routes = {
  "": renderHome,
  shop: renderShop,
  product: renderProductDetail,
  cart: renderCart,
  checkout: renderCheckout,
  login: () => renderAuth("login"),
  register: () => renderAuth("register"),
  profile: renderProfile,
  orders: renderOrders,
  wishlist: renderWishlist,
  admin: renderAdmin,
};

function router() {
  const { segments, params } = parseHash();
  const routeKey = segments[0] || "";
  const handler = routes[routeKey] || renderNotFound;
  window.scrollTo({ top: 0, behavior: "instant" in window ? "instant" : "auto" });
  handler(segments, params);
  document.querySelectorAll(".nav-links a").forEach((a) => {
    a.classList.toggle("active", a.getAttribute("href") === `#/${routeKey}`);
  });
  closeMobileDrawer();
  initReveal();
}
window.addEventListener("hashchange", router);

// ===========================================================================
// VIEW: HOME
// ===========================================================================
function renderHome() {
  document.title = "Mummy Aka Shop — Everyday essentials, delivered honestly";
  setCrumbs([]);
  const featured = queryProducts({ sort: "featured" }).slice(0, 10);

  root.innerHTML = `
  <section class="hero">
    <div class="wrap hero-grid">
      <div>
        <div class="hero-eyebrow">Trusted neighbourhood shop · ${STORE_INFO.city}</div>
        <h1>Everyday essentials, <em>kept honest.</em></h1>
        <p class="lead">${STORE_INFO.name} stocks what your home actually runs on — provisions, drinks, home goods and more — with real-time stock counts so you never order what we don't have.</p>
        <div class="hero-cta">
          <a class="btn btn-gold" href="#/shop">Shop now</a>
          <a class="btn btn-outline" style="color:var(--cream);border-color:#EFE6D255" href="#/shop?category=provisions">Browse provisions</a>
        </div>
        <div class="hero-stats">
          <div><strong>${PRODUCTS.length}+</strong><span>Products in stock</span></div>
          <div><strong>24hr</strong><span>Abuja delivery</span></div>
          <div><strong>4.7★</strong><span>Average rating</span></div>
        </div>
      </div>
      <div class="ticket">
        <span class="ticket-stamp">verified</span>
        <div class="ticket-head"><span>Order #MAS-20260718-4471</span><span>Today</span></div>
        <div class="ticket-row"><span>Semovita 5kg × 1</span><span>${formatNaira(6800)}</span></div>
        <div class="ticket-row"><span>Peak Milk 900g × 2</span><span>${formatNaira(10800)}</span></div>
        <div class="ticket-row"><span>Delivery</span><span>Free</span></div>
        <div class="ticket-total"><span>Total</span><span>${formatNaira(17600)}</span></div>
      </div>
    </div>
  </section>

  <section class="section wrap">
    <div class="section-head">
      <div>
        <span class="eyebrow">Browse by category</span>
        <h2 class="mt-0">Shop the shelves</h2>
      </div>
      <a class="btn btn-ghost" href="#/shop">View all products →</a>
    </div>
    <div class="cat-scroll">${categoryStripHTML()}</div>
  </section>

  <hr class="stitch-divider wrap">

  <section class="section wrap">
    <div class="section-head">
      <div>
        <span class="eyebrow">Handpicked today</span>
        <h2 class="mt-0">Featured products</h2>
      </div>
      <a class="btn btn-ghost" href="#/shop">See everything →</a>
    </div>
    <div class="grid-products">${featured.map((p) => productCardHTML(p, Wishlist.set())).join("")}</div>
  </section>

  <section class="section wrap">
    <div class="panel" style="display:flex;align-items:center;gap:1.5rem;flex-wrap:wrap;justify-content:space-between;">
      <div>
        <span class="eyebrow">How it works</span>
        <h2 class="mt-0" style="font-size:var(--step-2)">Pickup or delivery — your call</h2>
        <p class="muted mt-0" style="max-width:52ch">Add items to your basket, choose how you want to receive your order, and pay securely at checkout. We sync live with our StockySaver till, so what you see is what's really on the shelf.</p>
      </div>
      <a class="btn btn-primary" href="#/shop">Start an order</a>
    </div>
  </section>

  ${aboutSectionHTML()}`;
}

/** Renders the homepage "About / Visit us" showcase using STORE_INFO. */
function aboutSectionHTML() {
  const hasAddress = !isPlaceholderValue(STORE_INFO.addressLine);
  const hasPhone = !isPlaceholderValue(STORE_INFO.phone);
  const hasWhatsapp = !isPlaceholderValue(STORE_INFO.whatsapp);
  const hasMap = !isPlaceholderValue(STORE_INFO.mapUrl);
  const hasAbout = !isPlaceholderValue(STORE_INFO.about);
  const photo = STORE_INFO.aboutImage && !isPlaceholderValue(STORE_INFO.aboutImage) ? STORE_INFO.aboutImage : "https://picsum.photos/seed/mummyakashop-front/800/900";

  return `
  <section class="section wrap">
    <div class="section-head">
      <div><span class="eyebrow">About the shop</span><h2 class="mt-0">Visit ${STORE_INFO.name}</h2></div>
    </div>
    <div class="pdp" style="align-items:stretch;">
      <div class="reveal" style="border-radius:var(--radius-lg);overflow:hidden;border:var(--border);">
        <img src="${photo}" alt="${STORE_INFO.name} storefront" style="width:100%;height:100%;object-fit:cover;min-height:280px;" loading="lazy">
      </div>
      <div class="reveal">
        <p style="font-size:var(--step-1);color:var(--charcoal)">${hasAbout ? STORE_INFO.about : "Add a short story about your shop in <code>js/store-config.js</code> — who started it, how long you've served the neighbourhood, what customers can always count on."}</p>

        <ul class="meta-list mt-1">
          ${hasAddress ? `<li><b>Address</b><span>${STORE_INFO.addressLine}, ${STORE_INFO.city}${STORE_INFO.state ? ", " + STORE_INFO.state : ""}</span></li>` : `<li><b>Address</b><span class="muted">Add your address in store-config.js</span></li>`}
          ${hasPhone ? `<li><b>Phone</b><span>${STORE_INFO.phone}</span></li>` : ""}
          ${STORE_INFO.hours?.length ? STORE_INFO.hours.map((h) => `<li><b>${h.days}</b><span>${h.time}</span></li>`).join("") : ""}
        </ul>

        <div class="hero-cta mt-1" style="margin-top:1.2rem">
          ${hasPhone ? `<a class="btn btn-primary" href="tel:${STORE_INFO.phone.replace(/[^\d+]/g, "")}">Call the shop</a>` : ""}
          ${hasWhatsapp ? `<a class="btn btn-gold" href="https://wa.me/${STORE_INFO.whatsapp.replace(/[^\d]/g, "")}" target="_blank" rel="noopener">Chat on WhatsApp</a>` : ""}
          ${hasMap ? `<a class="btn btn-outline" href="${STORE_INFO.mapUrl}" target="_blank" rel="noopener">Get directions</a>` : ""}
        </div>
      </div>
    </div>
  </section>`;
}
function isPlaceholderValue(v) {
  return !v || /^PASTE_/.test(v);
}

// ===========================================================================
// VIEW: SHOP (browse / search / filter)
// ===========================================================================
function renderShop(segments, params) {
  document.title = "Shop — Mummy Aka Shop";
  setCrumbs([{ label: "Home", href: "#/" }, { label: "Shop", href: "#/shop" }]);

  const state = {
    query: params.get("q") || "",
    category: params.get("category") || "all",
    sort: params.get("sort") || "featured",
    inStockOnly: params.get("stock") === "1",
  };

  const renderGrid = () => {
    const results = queryProducts(state);
    const gridEl = root.querySelector("#shop-grid");
    if (!gridEl) return;
    gridEl.innerHTML = results.length
      ? results.map((p) => productCardHTML(p, Wishlist.set())).join("")
      : `<div class="empty-state" style="grid-column:1/-1;"><div class="emoji">🔎</div><h3>No products match your search</h3><p class="muted">Try a different keyword or clear your filters.</p></div>`;
    root.querySelector("#result-count").textContent = `${results.length} product${results.length === 1 ? "" : "s"}`;
    initReveal();
  };

  root.innerHTML = `
  <section class="section wrap">
    <div class="section-head">
      <div>
        <span class="eyebrow">Full catalog</span>
        <h1 class="mt-0">Shop all products</h1>
      </div>
      <span class="muted mono" id="result-count"></span>
    </div>

    <div class="toolbar" role="toolbar" aria-label="Filter products">
      <button class="chip ${state.category === "all" ? "active" : ""}" data-filter-category="all">All</button>
      ${CATEGORIES.map((c) => `<button class="chip ${state.category === c.id ? "active" : ""}" data-filter-category="${c.id}">${c.icon} ${c.label}</button>`).join("")}
      <label class="chip" style="cursor:pointer;">
        <input type="checkbox" id="stock-only" ${state.inStockOnly ? "checked" : ""} style="margin-right:.4em;">In stock only
      </label>
      <select class="select-sort" id="sort-select" aria-label="Sort products">
        <option value="featured" ${state.sort === "featured" ? "selected" : ""}>Featured</option>
        <option value="price-asc" ${state.sort === "price-asc" ? "selected" : ""}>Price: Low to High</option>
        <option value="price-desc" ${state.sort === "price-desc" ? "selected" : ""}>Price: High to Low</option>
        <option value="rating" ${state.sort === "rating" ? "selected" : ""}>Top Rated</option>
        <option value="newest" ${state.sort === "newest" ? "selected" : ""}>Newest</option>
      </select>
    </div>

    <div class="grid-products" id="shop-grid"></div>
  </section>`;

  const searchInput = document.getElementById("global-search");
  if (searchInput) searchInput.value = state.query;

  function syncUrl() {
    const p = new URLSearchParams();
    if (state.query) p.set("q", state.query);
    if (state.category !== "all") p.set("category", state.category);
    if (state.sort !== "featured") p.set("sort", state.sort);
    if (state.inStockOnly) p.set("stock", "1");
    history.replaceState(null, "", `#/shop${p.toString() ? "?" + p.toString() : ""}`);
  }

  root.querySelectorAll("[data-filter-category]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.category = btn.dataset.filterCategory;
      root.querySelectorAll("[data-filter-category]").forEach((b) => b.classList.toggle("active", b === btn));
      syncUrl();
      renderGrid();
    });
  });
  document.getElementById("sort-select").addEventListener("change", (e) => {
    state.sort = e.target.value;
    syncUrl();
    renderGrid();
  });
  document.getElementById("stock-only").addEventListener("change", (e) => {
    state.inStockOnly = e.target.checked;
    syncUrl();
    renderGrid();
  });

  renderGrid();
}

// ===========================================================================
// VIEW: PRODUCT DETAIL
// ===========================================================================
async function renderProductDetail(segments) {
  const id = segments[1];
  const product = getProduct(id);
  if (!product) return renderNotFound();

  document.title = `${product.name} — Mummy Aka Shop`;
  setCrumbs([{ label: "Home", href: "#/" }, { label: "Shop", href: "#/shop" }, { label: product.name, href: `#/product/${id}` }]);

  const stock = stockLabel(product.stock, product.lowStockThreshold);
  const related = PRODUCTS.filter((p) => p.category === product.category && p.id !== product.id).slice(0, 4);

  root.innerHTML = `
  <section class="section wrap">
    <div class="pdp">
      <div class="pdp-gallery reveal in-view">
        <div class="main-image"><img id="main-img" src="${product.images[0]}" alt="${product.name}" width="600" height="600"></div>
        <div class="thumb-row">
          ${product.images.map((src, i) => `<button class="${i === 0 ? "active" : ""}" data-thumb="${src}"><img src="${src}" alt="View ${i + 1}"></button>`).join("")}
        </div>
      </div>
      <div class="pdp-info reveal in-view">
        <span class="cat-label">${CATEGORIES.find((c) => c.id === product.category)?.label}</span>
        <h1>${product.name}</h1>
        ${product.reviewCount > 0 ? `<div class="stars" aria-label="Rated ${product.rating} out of 5">${"★".repeat(Math.round(product.rating))}${"☆".repeat(5 - Math.round(product.rating))} <span class="count">${product.rating} · ${product.reviewCount} reviews</span></div>` : ""}
        <div class="price-row">
          <span class="price-now">${formatNaira(product.price)}</span>
          ${product.compareAt ? `<span class="price-was">${formatNaira(product.compareAt)}</span>` : ""}
        </div>
        <span class="stock-note ${stock.cls}" id="stock-note">${stock.text} <span id="sync-indicator" class="mono" style="opacity:.6"></span></span>
        <p class="mt-1">${product.description}</p>

        <div class="pdp-actions">
          <div class="qty-stepper" data-id="${product.id}">
            <button data-action="dec" aria-label="Decrease quantity">−</button>
            <input type="number" id="pdp-qty" min="1" max="${Math.max(1, product.stock)}" value="1" aria-label="Quantity">
            <button data-action="inc" aria-label="Increase quantity">+</button>
          </div>
          <button class="btn btn-primary" id="pdp-add" ${product.stock <= 0 ? "disabled" : ""}>${product.stock <= 0 ? "Sold out" : "Add to cart"}</button>
          <button class="icon-btn" id="pdp-wish" aria-pressed="${Wishlist.has(product.id)}" aria-label="Toggle wishlist">
            <svg viewBox="0 0 24 24" style="fill:${Wishlist.has(product.id) ? "var(--coral)" : "none"};stroke:var(--coral);stroke-width:2"><path d="M12 21s-7.5-4.6-10-9.3C.5 8.2 2.4 5 5.9 5c2 0 3.4 1 6.1 3.6C14.7 6 16.1 5 18.1 5c3.5 0 5.4 3.2 3.9 6.7C19.5 16.4 12 21 12 21z"/></svg>
          </button>
        </div>

        <ul class="meta-list">
          <li><b>SKU</b><span class="mono">${product.sku}</span></li>
          <li><b>Category</b><span>${CATEGORIES.find((c) => c.id === product.category)?.label}</span></li>
          <li><b>Fulfilment</b><span>Pickup in Abuja or home delivery</span></li>
        </ul>

        <div class="tabs" role="tablist">
          <button class="active" data-tab="details" role="tab">Details</button>
          ${product.reviewCount > 0 ? `<button data-tab="reviews" role="tab">Reviews (${product.reviewCount})</button>` : ""}
          <button data-tab="delivery" role="tab">Delivery & returns</button>
        </div>
        <div class="tab-panel active" data-panel="details">
          <p>${product.description} Sourced and stocked in-store; inventory numbers you see here come straight from our StockySaver till system.</p>
        </div>
        ${product.reviewCount > 0 ? `<div class="tab-panel" data-panel="reviews">
          ${sampleReviews(product).map((r) => `<div class="review"><div class="who">${r.name} <span class="muted">${"★".repeat(r.stars)}</span></div><p class="mt-0">${r.text}</p></div>`).join("")}
        </div>` : ""}
        <div class="tab-panel" data-panel="delivery">
          <p>Same-day delivery within Abuja for orders placed before 3pm. Store pickup is available immediately once your order is confirmed. Unopened items may be returned within 48 hours with your receipt.</p>
        </div>
      </div>
    </div>

    ${related.length ? `
    <div class="section-head mt-2">
      <div><span class="eyebrow">You may also like</span><h2 class="mt-0">More from ${CATEGORIES.find((c) => c.id === product.category)?.label}</h2></div>
    </div>
    <div class="grid-products">${related.map((p) => productCardHTML(p, Wishlist.set())).join("")}</div>` : ""}
  </section>`;

  // Thumbnail swap
  root.querySelectorAll("[data-thumb]").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.getElementById("main-img").src = btn.dataset.thumb;
      root.querySelectorAll("[data-thumb]").forEach((b) => b.classList.toggle("active", b === btn));
    });
  });
  // Tabs
  root.querySelectorAll("[data-tab]").forEach((btn) => {
    btn.addEventListener("click", () => {
      root.querySelectorAll("[data-tab]").forEach((b) => b.classList.toggle("active", b === btn));
      root.querySelectorAll("[data-panel]").forEach((p) => p.classList.toggle("active", p.dataset.panel === btn.dataset.tab));
    });
  });
  // Qty stepper
  const qtyInput = document.getElementById("pdp-qty");
  root.querySelector('.pdp-actions [data-action="dec"]').addEventListener("click", () => {
    qtyInput.value = Math.max(1, Number(qtyInput.value) - 1);
  });
  root.querySelector('.pdp-actions [data-action="inc"]').addEventListener("click", () => {
    qtyInput.value = Math.min(Number(qtyInput.max), Number(qtyInput.value) + 1);
  });
  // Add to cart
  document.getElementById("pdp-add").addEventListener("click", () => {
    const ok = Cart.add(product.id, Number(qtyInput.value));
    toast(ok ? `Added ${product.name} to basket` : "Sorry, not enough stock available.", ok ? "success" : "error");
  });
  // Wishlist
  document.getElementById("pdp-wish").addEventListener("click", (e) => {
    const active = Wishlist.toggle(product.id);
    const svg = e.currentTarget.querySelector("svg");
    svg.style.fill = active ? "var(--coral)" : "none";
    e.currentTarget.setAttribute("aria-pressed", active);
    toast(active ? "Added to wishlist" : "Removed from wishlist");
  });

  // Live StockySaver sync check — confirms stock is fresh, shows a subtle indicator
  const indicator = document.getElementById("sync-indicator");
  indicator.textContent = "syncing…";
  const live = await withGracefulSync(() => StockySaverAPI.fetchProductStock(product.id), {
    onError: () => toast("Couldn't refresh live stock — showing last known count.", "error"),
  });
  if (live) {
    const freshLabel = stockLabel(live.stock, product.lowStockThreshold);
    const noteEl = document.getElementById("stock-note");
    if (noteEl) noteEl.innerHTML = `${freshLabel.text} <span class="mono" style="opacity:.55">· synced</span>`;
    indicator.textContent = "";
  } else {
    indicator.textContent = "(offline)";
  }
}

function sampleReviews(product) {
  const pool = [
    { name: "Ngozi A.", stars: 5, text: "Exactly as described, delivered same day. Will order again." },
    { name: "Ibrahim T.", stars: 4, text: "Good quality, price is fair. Delivery took a little longer than expected." },
    { name: "Chiamaka O.", stars: 5, text: "Mummy Aka Shop never disappoints. My go-to for household items." },
  ];
  return pool.slice(0, Math.min(3, Math.max(1, Math.round(product.rating) - 2)) + 1);
}

// ===========================================================================
// VIEW: CART
// ===========================================================================
function renderCart() {
  document.title = "Your basket — Mummy Aka Shop";
  setCrumbs([{ label: "Home", href: "#/" }, { label: "Basket", href: "#/cart" }]);
  root.innerHTML = `<section class="section wrap">${cartViewHTML()}</section>`;
  wireCartEvents();
}

function wireCartEvents() {
  root.querySelectorAll(".qty-stepper[data-id]").forEach((stepper) => {
    const id = stepper.dataset.id;
    const input = stepper.querySelector("input");
    stepper.querySelector('[data-action="dec"]').addEventListener("click", () => {
      Cart.setQty(id, Number(input.value) - 1);
      renderCart();
    });
    stepper.querySelector('[data-action="inc"]').addEventListener("click", () => {
      Cart.setQty(id, Number(input.value) + 1);
      renderCart();
    });
    input.addEventListener("change", () => {
      Cart.setQty(id, Number(input.value));
      renderCart();
    });
  });
  root.querySelectorAll('[data-action="remove-line"]').forEach((btn) => {
    btn.addEventListener("click", () => {
      Cart.remove(btn.dataset.id);
      toast("Item removed from basket");
      renderCart();
    });
  });
  const clearBtn = root.querySelector('[data-action="clear-cart"]');
  if (clearBtn) clearBtn.addEventListener("click", () => {
    Cart.clear();
    toast("Basket cleared");
    renderCart();
  });
}

// ===========================================================================
// VIEW: CHECKOUT
// ===========================================================================
function renderCheckout() {
  document.title = "Checkout — Mummy Aka Shop";
  setCrumbs([{ label: "Home", href: "#/" }, { label: "Basket", href: "#/cart" }, { label: "Checkout", href: "#/checkout" }]);

  const { lines, subtotal, delivery, total } = getCartSummary();
  if (lines.length === 0) {
    root.innerHTML = `<section class="section wrap"><div class="empty-state panel"><div class="emoji">🧺</div><h2>Nothing to check out yet</h2><p class="muted">Add items to your basket first.</p><a class="btn btn-primary" href="#/shop">Go to shop</a></div></section>`;
    return;
  }

  const user = AuthAPI.fullProfile();

  root.innerHTML = `
  <section class="section wrap">
    <h1 class="mt-0">Checkout</h1>
    <div class="checkout-steps">
      <span class="step active" id="step-details">1 · Delivery details</span>
      <span class="step" id="step-review">2 · Review order</span>
      <span class="step" id="step-confirm">3 · Confirmation</span>
    </div>

    <div class="cart-layout">
      <div>
        <div class="panel" id="checkout-form-panel">
          <h2 class="mt-0">Delivery details</h2>
          <form id="checkout-form" novalidate>
            <div class="field-row">
              <div class="field"><label for="co-name">Full name</label><input id="co-name" name="name" required value="${user?.name || ""}"></div>
              <div class="field"><label for="co-phone">Phone number</label><input id="co-phone" name="phone" type="tel" required value="${user?.phone || ""}" placeholder="080X XXX XXXX"></div>
            </div>
            <div class="field"><label for="co-email">Email address</label><input id="co-email" name="email" type="email" required value="${user?.email || ""}"></div>

            <div class="field">
              <label>Fulfilment method</label>
              <div class="flex gap-1" style="flex-wrap:wrap">
                <label class="radio-card" style="flex:1;min-width:200px" data-fulfil="delivery">
                  <input type="radio" name="fulfilment" value="delivery" checked> <span><strong>Home delivery</strong><br><span class="muted" style="font-size:12.5px">Same-day within Abuja</span></span>
                </label>
                <label class="radio-card" style="flex:1;min-width:200px" data-fulfil="pickup">
                  <input type="radio" name="fulfilment" value="pickup"> <span><strong>Store pickup</strong><br><span class="muted" style="font-size:12.5px">Ready within the hour</span></span>
                </label>
              </div>
            </div>

            <div id="address-field">
              <div class="field"><label for="co-address">Delivery address</label><textarea id="co-address" name="address" rows="3" required placeholder="House no., street, area, Abuja">${user?.address || ""}</textarea></div>
            </div>

            <div class="field"><label for="co-notes">Order notes (optional)</label><textarea id="co-notes" name="notes" rows="2" placeholder="E.g. call on arrival, leave with gatekeeper…"></textarea></div>

            <div class="field">
              <label>Payment method</label>
              <div class="radio-card active"><input type="radio" name="payment" value="card" checked> <span><strong>Pay with card</strong><br><span class="muted" style="font-size:12.5px">Secure checkout — card details are never stored on this device</span></span></div>
            </div>

            <button class="btn btn-gold btn-block" type="submit">Review order</button>
          </form>
        </div>
      </div>
      <aside class="panel">
        <h2 class="mt-0">Order summary</h2>
        ${lines.map((l) => `<div class="summary-row"><span>${l.product.name} × ${l.qty}</span><span class="mono">${formatNaira(l.lineTotal)}</span></div>`).join("")}
        <div class="summary-row"><span>Subtotal</span><span class="mono">${formatNaira(subtotal)}</span></div>
        <div class="summary-row"><span>Delivery</span><span class="mono">${delivery === 0 ? "Free" : formatNaira(delivery)}</span></div>
        <div class="summary-row total"><span>Total</span><span>${formatNaira(total)}</span></div>
      </aside>
    </div>
  </section>`;

  root.querySelectorAll("[data-fulfil]").forEach((label) => {
    label.addEventListener("click", () => {
      root.querySelectorAll("[data-fulfil]").forEach((l) => l.classList.remove("active"));
      label.classList.add("active");
      document.getElementById("address-field").style.display = label.dataset.fulfil === "pickup" ? "none" : "block";
      document.getElementById("co-address").required = label.dataset.fulfil !== "pickup";
    });
  });

  document.getElementById("checkout-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.target;
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }
    const data = Object.fromEntries(new FormData(form).entries());
    await submitOrder(data, { lines, subtotal, delivery, total });
  });
}

async function submitOrder(formData, { lines, subtotal, delivery, total }) {
  const submitBtn = root.querySelector('#checkout-form button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.textContent = "Validating stock…";
  document.getElementById("step-details").classList.replace("active", "done");
  document.getElementById("step-review").classList.add("active");

  const orderLines = lines.map((l) => ({ productId: l.product.id, name: l.product.name, quantity: l.qty, unitPrice: l.product.price }));

  // Step 1: validate against StockySaver before we let the customer "pay"
  const validation = await withGracefulSync(() => StockySaverAPI.validateOrder(orderLines.map((l) => ({ productId: l.productId, quantity: l.quantity }))), {
    onError: () => toast("Could not reach StockySaver — proceeding with cached stock data.", "error"),
    fallback: { valid: true, issues: [] },
  });

  if (!validation.valid) {
    toast("Some items are no longer available in the quantity requested.", "error");
    submitBtn.disabled = false;
    submitBtn.textContent = "Review order";
    document.getElementById("step-review").classList.remove("active");
    document.getElementById("step-details").classList.replace("done", "active");
    validation.issues.forEach((issue) => {
      const p = getProduct(issue.productId);
      if (p) Cart.setQty(p.id, issue.available ?? 0);
    });
    return;
  }

  submitBtn.textContent = "Placing order…";

  const order = {
    customer: { name: formData.name, phone: formData.phone, email: formData.email },
    fulfillment: { method: formData.fulfilment, address: formData.address || null, notes: formData.notes || null },
    payment: { method: formData.payment },
    lines: orderLines,
    totals: { subtotal, delivery, total },
  };

  try {
    const confirmed = await StockySaverAPI.submitOrder(order);
    OrdersStore.saveOrder(confirmed);
    Cart.clear();
    document.getElementById("step-review").classList.replace("active", "done");
    document.getElementById("step-confirm").classList.add("active");
    renderOrderConfirmation(confirmed);
  } catch (err) {
    toast(err.message || "Order could not be placed. Please try again.", "error");
    submitBtn.disabled = false;
    submitBtn.textContent = "Review order";
  }
}

function renderOrderConfirmation(order) {
  root.innerHTML = `
  <section class="section wrap">
    <div class="panel reveal in-view" style="max-width:560px;margin:0 auto;text-align:center;">
      <div style="font-size:3rem">✅</div>
      <h1>Order confirmed!</h1>
      <p class="muted">Thank you${order.customer?.name ? ", " + order.customer.name.split(" ")[0] : ""} — your order has been placed and synced to StockySaver.</p>
      <div class="ticket" style="transform:none;margin:1.5rem auto;text-align:left;max-width:340px;">
        <span class="ticket-stamp">confirmed</span>
        <div class="ticket-head"><span>Order</span><span>${order.orderNumber}</span></div>
        ${order.lines.map((l) => `<div class="ticket-row"><span>${l.name} × ${l.quantity}</span><span>${formatNaira(l.unitPrice * l.quantity)}</span></div>`).join("")}
        <div class="ticket-total"><span>Total</span><span>${formatNaira(order.totals.total)}</span></div>
      </div>
      <p class="muted" style="font-size:13px">${order.fulfillment.method === "pickup" ? "Ready for pickup within the hour." : "Out for delivery — arriving within 24 hours."}</p>
      <div class="flex gap-1 center mt-1" style="justify-content:center">
        <a class="btn btn-primary" href="#/orders">View order history</a>
        <a class="btn btn-outline" href="#/shop">Continue shopping</a>
      </div>
    </div>
  </section>`;
}

// ===========================================================================
// VIEW: AUTH
// ===========================================================================
function renderAuth(mode) {
  document.title = `${mode === "login" ? "Sign in" : "Create account"} — Mummy Aka Shop`;
  setCrumbs([{ label: "Home", href: "#/" }, { label: mode === "login" ? "Sign in" : "Create account", href: `#/${mode}` }]);

  if (AuthAPI.isLoggedIn()) {
    location.hash = "#/profile";
    return;
  }

  root.innerHTML = `<section class="section wrap">${authViewHTML(mode)}</section>`;

  root.querySelectorAll("[data-auth-tab]").forEach((tab) => {
    tab.addEventListener("click", () => {
      location.hash = `#/${tab.dataset.authTab}`;
    });
  });

  document.getElementById("login-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target).entries());
    try {
      const user = AuthAPI.login(data);
      toast(`Welcome back, ${user.name.split(" ")[0]}!`, "success");
      location.hash = "#/profile";
    } catch (err) {
      const errEl = document.getElementById("login-error");
      errEl.textContent = err.message;
      errEl.style.display = "block";
    }
  });

  document.getElementById("register-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target).entries());
    try {
      const user = AuthAPI.register(data);
      toast(`Welcome, ${user.name.split(" ")[0]}! Account created.`, "success");
      location.hash = "#/profile";
    } catch (err) {
      const errEl = document.getElementById("register-error");
      errEl.textContent = err.message;
      errEl.style.display = "block";
    }
  });
}

// ===========================================================================
// VIEW: PROFILE
// ===========================================================================
function renderProfile() {
  document.title = "My profile — Mummy Aka Shop";
  setCrumbs([{ label: "Home", href: "#/" }, { label: "Profile", href: "#/profile" }]);

  if (!AuthAPI.isLoggedIn()) {
    root.innerHTML = `<section class="section wrap"><div class="panel center" style="max-width:480px;margin:0 auto;"><h2 class="mt-0">Please sign in</h2><p class="muted">Sign in to view and edit your profile.</p><a class="btn btn-primary" href="#/login">Sign in</a></div></section>`;
    return;
  }

  root.innerHTML = `<section class="section wrap">${profileViewHTML()}</section>`;

  document.getElementById("profile-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target).entries());
    AuthAPI.updateProfile(data);
    toast("Profile updated", "success");
  });
  document.querySelector('[data-action="logout"]').addEventListener("click", () => {
    AuthAPI.logout();
    toast("Signed out");
    location.hash = "#/";
  });
}

// ===========================================================================
// VIEW: ORDERS
// ===========================================================================
function renderOrders() {
  document.title = "Order history — Mummy Aka Shop";
  setCrumbs([{ label: "Home", href: "#/" }, { label: "Orders", href: "#/orders" }]);

  if (!AuthAPI.isLoggedIn()) {
    root.innerHTML = `<section class="section wrap"><div class="panel center" style="max-width:480px;margin:0 auto;"><h2 class="mt-0">Please sign in</h2><p class="muted">Sign in to view your order history.</p><a class="btn btn-primary" href="#/login">Sign in</a></div></section>`;
    return;
  }

  const orders = OrdersStore.forCurrentUser();
  root.innerHTML = `
  <section class="section wrap">
    <h1 class="mt-0">Order history</h1>
    ${orders.length === 0 ? `<div class="empty-state panel"><div class="emoji">📦</div><h3>No orders yet</h3><p class="muted">Your placed orders will show up here.</p><a class="btn btn-primary" href="#/shop">Start shopping</a></div>` : `
    <div class="panel table-scroll">
      <table class="data-table">
        <thead><tr><th>Order #</th><th>Date</th><th>Items</th><th>Total</th><th>Fulfilment</th><th>Status</th></tr></thead>
        <tbody>
          ${orders.map((o) => `
            <tr>
              <td class="mono">${o.orderNumber}</td>
              <td>${new Date(o.createdAt).toLocaleDateString("en-NG", { day: "2-digit", month: "short", year: "numeric" })}</td>
              <td>${o.lines.reduce((s, l) => s + l.quantity, 0)} item(s)</td>
              <td class="mono">${formatNaira(o.totals.total)}</td>
              <td style="text-transform:capitalize">${o.fulfillment.method}</td>
              <td><span class="status-pill ${o.status}">${o.status}</span></td>
            </tr>`).join("")}
        </tbody>
      </table>
    </div>`}
  </section>`;
}

// ===========================================================================
// VIEW: WISHLIST
// ===========================================================================
function renderWishlist() {
  document.title = "Wishlist — Mummy Aka Shop";
  setCrumbs([{ label: "Home", href: "#/" }, { label: "Wishlist", href: "#/wishlist" }]);

  const items = Wishlist.items();
  root.innerHTML = `
  <section class="section wrap">
    <h1 class="mt-0">Your wishlist</h1>
    ${items.length === 0
      ? `<div class="empty-state panel"><div class="emoji">🤍</div><h3>Your wishlist is empty</h3><p class="muted">Tap the heart on any product to save it here.</p><a class="btn btn-primary" href="#/shop">Browse products</a></div>`
      : `<div class="grid-products">${items.map((p) => productCardHTML(p, Wishlist.set())).join("")}</div>`}
  </section>`;
}

// ===========================================================================
// VIEW: 404
// ===========================================================================
function renderNotFound() {
  document.title = "Page not found — Mummy Aka Shop";
  setCrumbs([]);
  root.innerHTML = `<section class="section wrap center"><h1>404</h1><p class="muted">We couldn't find that page.</p><a class="btn btn-primary" href="#/">Back home</a></section>`;
}

// ===========================================================================
// ADMIN
// ===========================================================================
function renderAdmin(segments) {
  document.title = "Admin — Mummy Aka Shop";
  setCrumbs([]);

  if (!AdminAuth.isLoggedIn()) {
    root.innerHTML = `
    <section class="section wrap">
      <div class="auth-wrap panel reveal in-view">
        <h1 class="mt-0" style="font-size:var(--step-2)">Admin sign in</h1>
        <p class="muted">${firebaseConfigured() ? "Use the same admin password as your StockySaver till." : "Store management access only."}</p>
        <form id="admin-login-form" novalidate>
          <div class="field"><label for="admin-pass">Admin password</label><input id="admin-pass" name="password" type="password" required autocomplete="current-password"></div>
          <p class="error-msg mono" id="admin-error" style="display:none;color:var(--coral);font-size:12.5px;"></p>
          <button class="btn btn-primary btn-block" type="submit">Sign in</button>
          ${!firebaseConfigured() ? `<p class="muted center mt-1" style="font-size:12px">Demo password: <span class="mono">mummyaka2026</span></p>` : ""}
        </form>
      </div>
    </section>`;
    document.getElementById("admin-login-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const submitBtn = e.target.querySelector('button[type="submit"]');
      submitBtn.disabled = true;
      submitBtn.textContent = "Checking…";
      const data = Object.fromEntries(new FormData(e.target).entries());
      try {
        await AdminAuth.login(data);
        toast("Welcome back, admin", "success");
        renderAdmin(["admin", "dashboard"]);
      } catch (err) {
        const errEl = document.getElementById("admin-error");
        errEl.textContent = err.message;
        errEl.style.display = "block";
        submitBtn.disabled = false;
        submitBtn.textContent = "Sign in";
      }
    });
    return;
  }

  const section = segments[1] || "dashboard";
  const nav = [
    { id: "dashboard", label: "📊 Dashboard" },
    { id: "products", label: "🛍️ Products" },
    { id: "categories", label: "🗂️ Categories" },
    { id: "orders", label: "🧾 Orders" },
    { id: "customers", label: "👥 Customers" },
    { id: "inventory", label: "📦 Inventory" },
  ];

  root.innerHTML = `
  <div class="admin-shell">
    <nav class="admin-side" aria-label="Admin navigation">
      ${nav.map((n) => `<a href="#/admin/${n.id}" class="${section === n.id ? "active" : ""}">${n.label}</a>`).join("")}
      <hr class="stitch-divider" style="margin:.8rem 0">
      <button class="drawer-link" id="admin-logout">🚪 Sign out</button>
    </nav>
    <div class="admin-main" id="admin-content"></div>
  </div>`;

  document.getElementById("admin-logout").addEventListener("click", () => {
    AdminAuth.logout();
    toast("Signed out of admin");
    location.hash = "#/admin";
  });

  const content = document.getElementById("admin-content");
  const renderers = {
    dashboard: adminDashboard,
    products: adminProducts,
    categories: adminCategories,
    orders: adminOrders,
    customers: adminCustomers,
    inventory: adminInventory,
  };
  (renderers[section] || adminDashboard)(content);
}

/**
 * Pulls every sale from StockySaver's businesses/{bizId}/sales — both
 * in-till sales and orders placed on this storefront live in the same
 * list — and normalizes them into one shape the admin views can render.
 * Falls back to this browser's local order history when StockySaver isn't
 * connected, so the admin panel still shows something in demo mode.
 */
async function getCombinedOrders() {
  if (firebaseConfigured()) {
    const raw = await withGracefulSync(() => fetchSalesList(), {
      onError: () => toast("Could not load sales from StockySaver.", "error"),
      fallback: [],
    });
    return raw.map((sale) => ({
      id: sale.id,
      orderNumber: sale.orderNumber || `TILL-${String(sale.id).slice(-6).toUpperCase()}`,
      createdAt: sale.timestamp || new Date().toISOString(),
      customerName: sale.customer || "Walk-in",
      itemCount: (sale.items || []).reduce((s, i) => s + (Number(i.qty) || 0), 0),
      total: Number(sale.total) || 0,
      fulfilment: sale.fulfilment || "in-store",
      status: "confirmed",
      source: sale.orderNumber ? "web" : "till",
    }));
  }
  return OrdersStore.all().map((o) => ({
    id: o.orderNumber,
    orderNumber: o.orderNumber,
    createdAt: o.createdAt,
    customerName: o.customer?.name || "Guest",
    itemCount: (o.lines || []).reduce((s, l) => s + (l.quantity || 0), 0),
    total: o.totals?.total || 0,
    fulfilment: o.fulfillment?.method || "delivery",
    status: o.status || "confirmed",
    source: "web",
  }));
}

async function adminDashboard(el) {
  el.innerHTML = `<p class="muted">Loading dashboard…</p>`;

  const orders = await getCombinedOrders();
  const revenue = orders.reduce((s, o) => s + o.total, 0);
  const lowStock = PRODUCTS.filter((p) => p.stock > 0 && p.stock <= (p.lowStockThreshold ?? 5));
  const outOfStock = PRODUCTS.filter((p) => p.stock <= 0);

  el.innerHTML = `
  <div class="flex-between mt-0"><h1 class="mt-0">Dashboard <span class="admin-tag">${firebaseConfigured() ? "Live" : "Demo"}</span></h1><span id="health-badge" class="mono muted" style="font-size:12px">Checking StockySaver…</span></div>
  <div class="stat-grid">
    <div class="stat-card"><div class="stat-label">Total revenue</div><div class="stat-value">${formatNaira(revenue)}</div></div>
    <div class="stat-card"><div class="stat-label">Sales recorded</div><div class="stat-value">${orders.length}</div></div>
    <div class="stat-card"><div class="stat-label">Products in catalog</div><div class="stat-value">${PRODUCTS.length}</div></div>
    <div class="stat-card"><div class="stat-label">Low-stock alerts</div><div class="stat-value" style="color:var(--amber)">${lowStock.length}</div></div>
  </div>

  <div class="section-head mt-2"><h2 class="mt-0">Notifications</h2></div>
  <div class="panel">
    ${outOfStock.map((p) => `<div class="summary-row"><span>🔴 <b>${p.name}</b> is out of stock</span><a class="btn btn-sm btn-outline" href="#/admin/inventory">Restock</a></div>`).join("")}
    ${lowStock.map((p) => `<div class="summary-row"><span>🟠 <b>${p.name}</b> is low on stock (${p.stock} left)</span><a class="btn btn-sm btn-outline" href="#/admin/inventory">Review</a></div>`).join("")}
    ${outOfStock.length + lowStock.length === 0 ? `<p class="muted">No stock alerts right now — everything's healthy.</p>` : ""}
  </div>

  <div class="section-head mt-2"><h2 class="mt-0">Recent sales ${firebaseConfigured() ? '<span class="muted" style="font-size:12px;font-weight:400">(till + web, from StockySaver)</span>' : ""}</h2></div>
  <div class="panel table-scroll">
    <table class="data-table">
      <thead><tr><th>Order #</th><th>Customer</th><th>Source</th><th>Total</th><th>Status</th></tr></thead>
      <tbody>
        ${orders.slice(0, 8).map((o) => `<tr><td class="mono">${o.orderNumber}</td><td>${o.customerName}</td><td>${o.source === "web" ? "🌐 Web" : "🏪 Till"}</td><td class="mono">${formatNaira(o.total)}</td><td><span class="status-pill ${o.status}">${o.status}</span></td></tr>`).join("") || `<tr><td colspan="5" class="muted center">No sales yet</td></tr>`}
      </tbody>
    </table>
  </div>`;

  StockySaverAPI.checkHealth().then((h) => {
    const badge = document.getElementById("health-badge");
    if (!badge) return;
    badge.innerHTML = h.status === "connected"
      ? `<span style="color:var(--sage)">● StockySaver connected</span> ${h.mock ? "(mock)" : `(${h.latencyMs}ms)`}`
      : `<span style="color:var(--coral)">● StockySaver offline</span>`;
  });
}

function adminProducts(el) {
  el.innerHTML = `
  <div class="flex-between mt-0"><h1 class="mt-0">Products ${isLiveCatalog() ? '<span class="admin-tag">Live from StockySaver</span>' : '<span class="admin-tag" style="background:var(--ink-100);color:var(--charcoal-60)">Demo data</span>'}</h1><button class="btn btn-primary btn-sm" disabled title="Add/edit items in StockySaver — the storefront mirrors it automatically">+ Add product</button></div>
  <p class="muted" style="font-size:13px">${isLiveCatalog() ? "This list is synced live from StockySaver's own inventory — add, edit, or restock items in StockySaver and they'll appear here automatically." : "Showing demo data. Connect StockySaver (set STORE_BIZ_ID in firebase-config.js) to sync your real catalog."}</p>
  <div class="panel table-scroll">
    <table class="data-table">
      <thead><tr><th>Product</th><th>SKU</th><th>Category</th><th>Price</th><th>Stock</th><th>Status</th></tr></thead>
      <tbody>
        ${PRODUCTS.map((p) => `
        <tr>
          <td><div class="flex gap-1" style="align-items:center"><img src="${p.images[0]}" width="34" height="34" style="border-radius:6px;object-fit:cover" alt=""> ${p.name}</div></td>
          <td class="mono">${p.sku}</td>
          <td>${CATEGORIES.find((c) => c.id === p.category)?.label}</td>
          <td class="mono">${formatNaira(p.price)}</td>
          <td class="mono">${p.stock}</td>
          <td>${p.stock <= 0 ? '<span class="status-pill cancelled">out</span>' : p.stock <= p.lowStockThreshold ? '<span class="status-pill pending">low</span>' : '<span class="status-pill confirmed">ok</span>'}</td>
        </tr>`).join("")}
      </tbody>
    </table>
  </div>`;
}

function adminCategories(el) {
  el.innerHTML = `
  <h1 class="mt-0">Categories</h1>
  <div class="grid-products">
    ${CATEGORIES.map((c) => `
    <div class="panel center">
      <div class="cat-icon" style="margin:0 auto .6rem;width:52px;height:52px;border-radius:50%;background:var(--gold-100);display:flex;align-items:center;justify-content:center;font-size:1.4rem">${c.icon}</div>
      <h3 class="mt-0">${c.label}</h3>
      <p class="muted mono" style="font-size:12.5px">${PRODUCTS.filter((p) => p.category === c.id).length} products</p>
    </div>`).join("")}
  </div>`;
}

async function adminOrders(el) {
  el.innerHTML = `<p class="muted">Loading orders…</p>`;
  const orders = await getCombinedOrders();
  el.innerHTML = `
  <div class="flex-between mt-0"><h1 class="mt-0">Orders</h1>${firebaseConfigured() ? '<span class="admin-tag">Live — till + web, from StockySaver</span>' : '<span class="admin-tag" style="background:var(--ink-100);color:var(--charcoal-60)">This device only (demo)</span>'}</div>
  <div class="panel table-scroll">
    <table class="data-table">
      <thead><tr><th>Order #</th><th>Date</th><th>Customer</th><th>Items</th><th>Total</th><th>Source</th><th>Status</th></tr></thead>
      <tbody>
        ${orders.map((o) => `
        <tr>
          <td class="mono">${o.orderNumber}</td>
          <td>${new Date(o.createdAt).toLocaleString("en-NG")}</td>
          <td>${o.customerName}</td>
          <td>${o.itemCount}</td>
          <td class="mono">${formatNaira(o.total)}</td>
          <td>${o.source === "web" ? "🌐 Web" : "🏪 Till"} <span class="muted" style="text-transform:capitalize">· ${o.fulfilment}</span></td>
          <td><span class="status-pill ${o.status}">${o.status}</span></td>
        </tr>`).join("") || `<tr><td colspan="7" class="muted center">No orders yet</td></tr>`}
      </tbody>
    </table>
  </div>`;
}

function adminCustomers(el) {
  const users = JSON.parse(localStorage.getItem("mas_users_v1") || "[]");
  el.innerHTML = `
  <h1 class="mt-0">Customers</h1>
  <div class="panel table-scroll">
    <table class="data-table">
      <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Joined</th></tr></thead>
      <tbody>
        ${users.map((u) => `<tr><td>${u.name}</td><td>${u.email}</td><td>${u.phone || "—"}</td><td>${new Date(u.createdAt).toLocaleDateString("en-NG")}</td></tr>`).join("") || `<tr><td colspan="4" class="muted center">No registered customers yet</td></tr>`}
      </tbody>
    </table>
  </div>`;
}

function adminInventory(el) {
  el.innerHTML = `
  <div class="flex-between mt-0"><h1 class="mt-0">Inventory overview ${isLiveCatalog() ? '<span class="admin-tag">Live from StockySaver</span>' : '<span class="admin-tag" style="background:var(--ink-100);color:var(--charcoal-60)">Demo data</span>'}</h1><button class="btn btn-outline btn-sm" id="refresh-inventory">↻ Re-sync with StockySaver</button></div>
  <div class="panel table-scroll" id="inventory-table">
    <table class="data-table">
      <thead><tr><th>Product</th><th>SKU</th><th>Stock</th><th>Threshold</th><th>Status</th></tr></thead>
      <tbody>
        ${PRODUCTS.map((p) => inventoryRow(p)).join("")}
      </tbody>
    </table>
  </div>`;

  document.getElementById("refresh-inventory").addEventListener("click", async (e) => {
    e.target.disabled = true;
    e.target.textContent = "Syncing…";
    const synced = await withGracefulSync(() => syncCatalogFromStockySaver(), {
      onError: () => toast("Could not sync with StockySaver right now.", "error"),
    });
    if (synced) {
      toast("Catalog synced with StockySaver", "success");
      adminInventory(el); // re-render with fresh data
    } else {
      toast("StockySaver not connected — set STORE_BIZ_ID in firebase-config.js", "error");
      e.target.disabled = false;
      e.target.textContent = "↻ Re-sync with StockySaver";
    }
  });
}
function inventoryRow(p) {
  const status = p.stock <= 0 ? '<span class="status-pill cancelled">out of stock</span>' : p.stock <= p.lowStockThreshold ? '<span class="status-pill pending">low stock</span>' : '<span class="status-pill confirmed">healthy</span>';
  return `<tr><td>${p.name}</td><td class="mono">${p.sku}</td><td class="mono">${p.stock}</td><td class="mono">${p.lowStockThreshold}</td><td>${status}</td></tr>`;
}

// ===========================================================================
// GLOBAL UI WIRING (header, drawer, search, delegated cart/wishlist clicks)
// ===========================================================================
function closeMobileDrawer() {
  document.getElementById("mobile-drawer")?.classList.remove("open");
}

function initGlobalUI() {
  initTheme();
  applyStoreInfo();
  document.querySelectorAll("[data-action='toggle-theme']").forEach((btn) => btn.addEventListener("click", toggleTheme));

  // Mobile drawer
  const drawer = document.getElementById("mobile-drawer");
  document.getElementById("nav-toggle-btn")?.addEventListener("click", () => drawer.classList.add("open"));
  drawer?.querySelector(".scrim")?.addEventListener("click", closeMobileDrawer);

  // Search (desktop + mobile)
  document.querySelectorAll("[data-role='search-form']").forEach((form) => {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const q = new FormData(form).get("q") || "";
      location.hash = `#/shop?q=${encodeURIComponent(q)}`;
    });
  });

  // Delegated clicks: add-to-cart / wishlist toggle from any rendered card
  document.body.addEventListener("click", (e) => {
    const addBtn = e.target.closest("[data-action='add-cart']");
    if (addBtn) {
      const ok = Cart.add(addBtn.dataset.id, 1);
      toast(ok ? "Added to basket" : "Sorry, that item is out of stock.", ok ? "success" : "error");
      return;
    }
    const wishBtn = e.target.closest("[data-action='toggle-wish']");
    if (wishBtn) {
      e.preventDefault();
      const active = Wishlist.toggle(wishBtn.dataset.id);
      wishBtn.classList.toggle("active", active);
      wishBtn.setAttribute("aria-pressed", active);
      toast(active ? "Added to wishlist" : "Removed from wishlist");
    }
  });

  refreshBadges();
}

// ===========================================================================
// BOOT
// ===========================================================================
async function boot() {
  initGlobalUI();

  // Pull the real catalog from StockySaver before the first render, if
  // configured (see firebase-config.js → STORE_BIZ_ID). Falls back to the
  // demo catalog silently if not configured, empty, or unreachable.
  await withGracefulSync(() => syncCatalogFromStockySaver(), {
    onError: () => toast("Could not load live catalog from StockySaver — showing demo products.", "error"),
  });

  router();
  setTimeout(() => document.getElementById("page-loader")?.classList.add("hidden"), 350);

  // Keep the catalog live from here on — a till sale, restock, or manual
  // edit in StockySaver updates the storefront without a page refresh.
  watchCatalogFromStockySaver(() => {
    const { segments } = parseHash();
    const routeKey = segments[0] || "";
    if (["", "shop", "product", "wishlist"].includes(routeKey)) router();
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}
