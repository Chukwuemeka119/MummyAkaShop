/**
 * ==========================================================================
 * PRODUCTS.JS
 * --------------------------------------------------------------------------
 * Sample product catalog + all product-grid rendering, search, filter and
 * sort logic. When StockySaver (Firebase) is connected — see
 * firebase-config.js — the catalog below is replaced in place with your
 * real live inventory via syncCatalogFromStockySaver() / watchCatalog().
 * ==========================================================================
 */

import { isConfigured as firebaseConfigured, fetchInventoryList, subscribeInventory } from "./firebase.js";
import { LOW_STOCK_THRESHOLD } from "./firebase-config.js";

export const CATEGORIES = [
  { id: "provisions", label: "Provisions", icon: "🛒" },
  { id: "beverages", label: "Beverages", icon: "🥤" },
  { id: "home", label: "Home & Kitchen", icon: "🍽️" },
  { id: "personal-care", label: "Personal Care", icon: "🧴" },
  { id: "baby", label: "Baby & Kids", icon: "🍼" },
  { id: "snacks", label: "Snacks", icon: "🍪" },
  { id: "frozen", label: "Frozen Foods", icon: "🧊" },
  // Fallback for items synced straight from StockySaver, which has no
  // category field of its own — every synced item lands here unless you
  // add a matching `category` value to that row in Firebase.
  { id: "general", label: "Store Items", icon: "🏪" },
];

// Placeholder imagery — swap for real product photography / StockySaver
// media URLs. Picsum keeps deterministic images per seed so cards look
// distinct without shipping binary assets in this deliverable.
const img = (seed) => `https://picsum.photos/seed/${seed}/600/600`;

/**
 * Demo/fallback catalog. Used as-is when StockySaver isn't connected, and
 * used as a starting point (then replaced) once STORE_BIZ_ID is set in
 * firebase-config.js — see syncCatalogFromStockySaver() below.
 */
const DEMO_PRODUCTS = [
  { id: "p001", name: "Golden Penny Semovita 5kg", category: "provisions", price: 6800, compareAt: 7500, rating: 4.7, reviewCount: 128, stock: 34, lowStockThreshold: 8, sku: "GP-SEM-5KG", isNew: false, images: [img("semovita1"), img("semovita2")], description: "Smooth, easy-to-swirl semolina meal milled for consistent texture — a kitchen staple for a proper Sunday afternoon.", tagsBadges: ["sale"] },
  { id: "p002", name: "Honeywell Wheat Meal 2kg", category: "provisions", price: 3200, compareAt: null, rating: 4.5, reviewCount: 64, stock: 3, lowStockThreshold: 5, sku: "HW-WHT-2KG", isNew: true, images: [img("wheat1"), img("wheat2")], description: "Fine-milled wheat meal for a soft, stretchy swallow every time.", tagsBadges: ["new"] },
  { id: "p003", name: "Peak Milk Powder 900g", category: "provisions", price: 5400, compareAt: 5900, rating: 4.8, reviewCount: 210, stock: 51, lowStockThreshold: 10, sku: "PK-MLK-900", isNew: false, images: [img("milk1"), img("milk2")], description: "Full-cream milk powder, rich and creamy — the tin every Nigerian pantry recognises.", tagsBadges: ["sale"] },
  { id: "p004", name: "Dangote Sugar 1kg", category: "provisions", price: 1450, compareAt: null, rating: 4.6, reviewCount: 92, stock: 0, lowStockThreshold: 10, sku: "DG-SGR-1KG", isNew: false, images: [img("sugar1"), img("sugar2")], description: "Refined white sugar for tea, baking, and everything sweet in between.", tagsBadges: [] },
  { id: "p005", name: "Kings Vegetable Oil 5L", category: "provisions", price: 12900, compareAt: 14000, rating: 4.4, reviewCount: 77, stock: 18, lowStockThreshold: 6, sku: "KG-OIL-5L", isNew: false, images: [img("oil1"), img("oil2")], description: "Light, cholesterol-free vegetable oil suited to everyday frying and stews.", tagsBadges: ["sale"] },
  { id: "p006", name: "Chivita 100% Orange Juice 1L", category: "beverages", price: 1900, compareAt: null, rating: 4.5, reviewCount: 145, stock: 60, lowStockThreshold: 12, sku: "CV-OJ-1L", isNew: false, images: [img("juice1"), img("juice2")], description: "No added sugar, no preservatives — just pressed oranges in a carton.", tagsBadges: [] },
  { id: "p007", name: "Nescafé Classic Coffee 200g", category: "beverages", price: 4200, compareAt: null, rating: 4.7, reviewCount: 58, stock: 22, lowStockThreshold: 6, sku: "NC-COF-200", isNew: true, images: [img("coffee1"), img("coffee2")], description: "Rich roasted instant coffee for the mornings that need it most.", tagsBadges: ["new"] },
  { id: "p008", name: "Eva Premium Table Water (12 pack)", category: "beverages", price: 1500, compareAt: null, rating: 4.3, reviewCount: 39, stock: 4, lowStockThreshold: 8, sku: "EV-WTR-12", isNew: false, images: [img("water1"), img("water2")], description: "Purified table water, 75cl x 12 bottles, sealed for freshness.", tagsBadges: [] },
  { id: "p009", name: "Tefal Non-Stick Frying Pan 24cm", category: "home", price: 8900, compareAt: 10500, rating: 4.9, reviewCount: 33, stock: 12, lowStockThreshold: 4, sku: "TF-PAN-24", isNew: false, images: [img("pan1"), img("pan2")], description: "Durable non-stick coating that makes eggs slide, not stick.", tagsBadges: ["sale"] },
  { id: "p010", name: "Binatone Electric Kettle 1.7L", category: "home", price: 9500, compareAt: null, rating: 4.6, reviewCount: 47, stock: 9, lowStockThreshold: 4, sku: "BN-KTL-17", isNew: false, images: [img("kettle1"), img("kettle2")], description: "Fast-boil kettle with auto shut-off for a safer kitchen counter.", tagsBadges: [] },
  { id: "p011", name: "Nivea Body Lotion 400ml", category: "personal-care", price: 3300, compareAt: 3800, rating: 4.5, reviewCount: 88, stock: 27, lowStockThreshold: 8, sku: "NV-LOT-400", isNew: false, images: [img("lotion1"), img("lotion2")], description: "24-hour moisture for skin that's had enough of the Abuja dust.", tagsBadges: ["sale"] },
  { id: "p012", name: "Dettol Antiseptic Liquid 500ml", category: "personal-care", price: 2100, compareAt: null, rating: 4.8, reviewCount: 156, stock: 40, lowStockThreshold: 10, sku: "DT-ANT-500", isNew: false, images: [img("dettol1"), img("dettol2")], description: "Trusted antiseptic for first aid, laundry, and household cleaning.", tagsBadges: [] },
  { id: "p013", name: "Pampers Baby Dry Pants (Size 4, 58pcs)", category: "baby", price: 8700, compareAt: 9500, rating: 4.7, reviewCount: 61, stock: 6, lowStockThreshold: 6, sku: "PP-DRY-S4", isNew: false, images: [img("pampers1"), img("pampers2")], description: "12-hour dryness so everybody in the house sleeps through the night.", tagsBadges: ["sale"] },
  { id: "p014", name: "Cerelac Infant Cereal 400g", category: "baby", price: 3600, compareAt: null, rating: 4.6, reviewCount: 44, stock: 15, lowStockThreshold: 6, sku: "CR-CER-400", isNew: true, images: [img("cerelac1"), img("cerelac2")], description: "Iron-fortified cereal for little ones starting on solids.", tagsBadges: ["new"] },
  { id: "p015", name: "Gala Sausage Roll (Box of 24)", category: "snacks", price: 6000, compareAt: null, rating: 4.4, reviewCount: 29, stock: 20, lowStockThreshold: 5, sku: "GL-SAU-24", isNew: false, images: [img("gala1"), img("gala2")], description: "The road-trip classic — a whole box for the office or the family car.", tagsBadges: [] },
  { id: "p016", name: "Digestive Biscuits 400g", category: "snacks", price: 1750, compareAt: 2000, rating: 4.3, reviewCount: 22, stock: 31, lowStockThreshold: 8, sku: "DG-BSC-400", isNew: false, images: [img("biscuit1"), img("biscuit2")], description: "Wholesome wheat biscuits, lightly sweet, perfectly dunkable.", tagsBadges: ["sale"] },
  { id: "p017", name: "Frozen Chicken (Whole, 1.2kg)", category: "frozen", price: 5200, compareAt: null, rating: 4.5, reviewCount: 51, stock: 2, lowStockThreshold: 6, sku: "FZ-CHK-12", isNew: false, images: [img("chicken1"), img("chicken2")], description: "Cleaned, frozen whole chicken — ready for the pot whenever you are.", tagsBadges: [] },
  { id: "p018", name: "Frozen Sweet Corn 900g", category: "frozen", price: 2400, compareAt: null, rating: 4.2, reviewCount: 18, stock: 25, lowStockThreshold: 6, sku: "FZ-CRN-900", isNew: false, images: [img("corn1"), img("corn2")], description: "Flash-frozen sweet corn kernels, ready in minutes.", tagsBadges: [] },
];

/**
 * The LIVE catalog every view reads from. Starts as a copy of the demo
 * data; syncCatalogFromStockySaver() below replaces its contents in place
 * (via splice, not reassignment) so every existing `import { PRODUCTS }`
 * elsewhere in the app keeps pointing at the same array and sees updates
 * automatically, no re-import needed.
 */
export const PRODUCTS = [...DEMO_PRODUCTS];

/** Utility: currency formatter (Naira, no decimals for whole values). */
export function formatNaira(amount) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function getProduct(id) {
  return PRODUCTS.find((p) => p.id === id) || null;
}

export function stockLabel(stock, threshold = 5) {
  if (stock <= 0) return { text: "Out of stock", cls: "out" };
  if (stock <= threshold) return { text: `Only ${stock} left`, cls: "low" };
  return { text: "In stock", cls: "in" };
}

function starString(rating) {
  const full = Math.round(rating);
  return "★".repeat(full) + "☆".repeat(5 - full);
}

/**
 * Renders a single product card. `wishlist` is a Set of product ids used to
 * pre-mark the heart icon as active.
 */
export function productCardHTML(p, wishlist = new Set()) {
  const stock = stockLabel(p.stock, p.lowStockThreshold);
  const isWished = wishlist.has(p.id);
  const badge = p.stock <= 0 ? '<span class="tag out">Sold out</span>'
    : p.tagsBadges.includes("sale") ? '<span class="tag sale">Sale</span>'
    : p.tagsBadges.includes("new") ? '<span class="tag new">New</span>' : "";

  return `
  <article class="product-card reveal" data-id="${p.id}">
    <div class="thumb-wrap">
      ${badge}
      <button class="wish-btn ${isWished ? "active" : ""}" data-action="toggle-wish" data-id="${p.id}" aria-pressed="${isWished}" aria-label="${isWished ? "Remove from" : "Add to"} wishlist">
        <svg viewBox="0 0 24 24"><path d="M12 21s-7.5-4.6-10-9.3C.5 8.2 2.4 5 5.9 5c2 0 3.4 1 6.1 3.6C14.7 6 16.1 5 18.1 5c3.5 0 5.4 3.2 3.9 6.7C19.5 16.4 12 21 12 21z"/></svg>
      </button>
      <a href="#/product/${p.id}"><img src="${p.images[0]}" alt="${p.name}" loading="lazy" width="600" height="600"></a>
    </div>
    <div class="body">
      <span class="cat-label">${labelFor(p.category)}</span>
      <h3><a href="#/product/${p.id}">${p.name}</a></h3>
      ${p.reviewCount > 0 ? `<div class="stars" aria-label="Rated ${p.rating} out of 5">${starString(p.rating)} <span class="count">(${p.reviewCount})</span></div>` : ""}
      <div class="price-row">
        <span class="price-now">${formatNaira(p.price)}</span>
        ${p.compareAt ? `<span class="price-was">${formatNaira(p.compareAt)}</span>` : ""}
      </div>
      <span class="stock-note ${stock.cls}">${stock.text}</span>
      <div class="card-actions">
        <button class="btn btn-primary btn-sm" data-action="add-cart" data-id="${p.id}" ${p.stock <= 0 ? "disabled" : ""}>
          ${p.stock <= 0 ? "Sold out" : "Add to cart"}
        </button>
        <a class="btn btn-outline btn-sm" href="#/product/${p.id}">View</a>
      </div>
    </div>
  </article>`;
}

function labelFor(catId) {
  return CATEGORIES.find((c) => c.id === catId)?.label ?? catId;
}

/** Renders the horizontal category strip on the homepage. */
export function categoryStripHTML() {
  return CATEGORIES.map(
    (c) => `
    <a class="cat-card reveal" href="#/shop?category=${c.id}">
      <span class="cat-icon" aria-hidden="true">${c.icon}</span>
      <strong>${c.label}</strong>
      <span>${PRODUCTS.filter((p) => p.category === c.id).length} items</span>
    </a>`
  ).join("");
}

/**
 * Core filter/search/sort engine used by the shop view.
 * @param {object} opts { query, category, sort, inStockOnly }
 */
export function queryProducts({ query = "", category = "all", sort = "featured", inStockOnly = false } = {}) {
  let list = [...PRODUCTS];

  if (category && category !== "all") {
    list = list.filter((p) => p.category === category);
  }
  if (query.trim()) {
    const q = query.trim().toLowerCase();
    list = list.filter(
      (p) => p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)
    );
  }
  if (inStockOnly) {
    list = list.filter((p) => p.stock > 0);
  }

  switch (sort) {
    case "price-asc":
      list.sort((a, b) => a.price - b.price);
      break;
    case "price-desc":
      list.sort((a, b) => b.price - a.price);
      break;
    case "rating":
      list.sort((a, b) => b.rating - a.rating);
      break;
    case "newest":
      list.sort((a, b) => Number(b.isNew) - Number(a.isNew));
      break;
    default:
      // "featured": sale items and new items first, then rating
      list.sort((a, b) => {
        const score = (p) => (p.tagsBadges.includes("sale") ? 2 : 0) + (p.isNew ? 1 : 0);
        return score(b) - score(a) || b.rating - a.rating;
      });
  }
  return list;
}

// ---------------------------------------------------------------------------
// LIVE CATALOG SYNC — pulls the product list itself from StockySaver
// ---------------------------------------------------------------------------

/**
 * Maps one StockySaver inventory row ({ id, name, price, qty, category? })
 * into the product shape every view in this app expects. StockySaver has
 * no images/description/rating data, so those get honest, generic
 * defaults rather than invented specifics.
 */
function mapFirebaseRowToProduct(row) {
  const category = row.category && CATEGORIES.some((c) => c.id === row.category) ? row.category : "general";
  return {
    id: row.id,
    firebaseId: row.id,
    name: row.name || "Unnamed item",
    category,
    price: Number(row.price) || 0,
    compareAt: null,
    rating: 0,
    reviewCount: 0,
    stock: Number(row.qty) || 0,
    lowStockThreshold: LOW_STOCK_THRESHOLD,
    sku: row.id,
    isNew: false,
    images: [img(`stockysaver-${row.id}`)],
    description: `${row.name} — available in store and synced live from StockySaver.`,
    tagsBadges: [],
  };
}

/**
 * One-time fetch: replaces the live PRODUCTS catalog with what's currently
 * in StockySaver's businesses/{bizId}/inventory. Returns true if it synced
 * real data, false if it fell back (Firebase not configured, or empty
 * inventory — in which case the demo catalog is left in place so the
 * storefront never shows an empty shop).
 */
export async function syncCatalogFromStockySaver() {
  if (!firebaseConfigured()) return false;
  const rows = await fetchInventoryList();
  if (!rows.length) return false;
  const mapped = rows.map(mapFirebaseRowToProduct);
  PRODUCTS.splice(0, PRODUCTS.length, ...mapped);
  return true;
}

/**
 * Starts a real-time subscription so PRODUCTS always mirrors StockySaver's
 * current inventory — a till sale, restock, or manual edit in StockySaver
 * updates the storefront automatically, no refresh needed. Calls
 * `onUpdate()` after every sync so the caller can re-render. Returns an
 * unsubscribe function (no-op if Firebase isn't configured).
 */
export function watchCatalogFromStockySaver(onUpdate) {
  if (!firebaseConfigured()) return () => {};
  return subscribeInventory((rows) => {
    if (!rows.length) return; // never blank out the shop on a transient empty read
    const mapped = rows.map(mapFirebaseRowToProduct);
    PRODUCTS.splice(0, PRODUCTS.length, ...mapped);
    if (onUpdate) onUpdate();
  });
}

/** True if the live catalog currently in memory came from StockySaver rather than demo data. */
export function isLiveCatalog() {
  return PRODUCTS.length > 0 && PRODUCTS.every((p) => !!p.firebaseId);
}
