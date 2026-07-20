/**
 * ==========================================================================
 * STOCKYSAVER-API.JS
 * --------------------------------------------------------------------------
 * Thin, modular integration layer between Mummy Aka Shop and the StockySaver
 * inventory / POS system. Every call that will eventually hit StockySaver
 * lives in ONE place (this file) so the rest of the codebase never talks to
 * Firebase or `fetch` directly.
 *
 * Three possible backends, tried in this order:
 *   1. Firebase Realtime Database (StockySaver's actual backend) — used
 *      when firebase-config.js has FIREBASE_ENABLED = true AND a real
 *      STORE_BIZ_ID has been set.
 *   2. A generic StockySaver REST API — used when USE_MOCK = false and
 *      Firebase isn't configured. See /docs/API.md for the contract.
 *   3. Local mock data — the default, so the storefront is fully demoable
 *      with zero backend.
 *
 * IMPORTANT — matching storefront products to StockySaver rows:
 * StockySaver inventory rows only have { name, price, qty } — no SKU, no
 * images, no category. Every Firebase call below matches a storefront
 * product to a StockySaver row by exact item NAME (case-insensitive,
 * trimmed). If a product's storefront name won't match its real StockySaver
 * name, add a `firebaseName` override to that product in products.js:
 *   { id: "p001", name: "Golden Penny Semovita 5kg", firebaseName: "Semovita 5kg", ... }
 * ==========================================================================
 */

// ---------------------------------------------------------------------------
// CONFIGURATION — used only for the generic-REST fallback (backend #2 above)
// ---------------------------------------------------------------------------
const CONFIG = {
  baseUrl: "https://api.stockysaver.com/v1", // TODO: replace if you build a non-Firebase StockySaver REST API
  apiKey: "REPLACE_WITH_STOCKYSAVER_API_KEY",
  storeId: "mummy-aka-shop",
  timeoutMs: 8000,
};

// Set to false once CONFIG.baseUrl above points at a real REST API. Ignored
// entirely while Firebase is configured (Firebase always takes priority).
const USE_MOCK = true;

import {
  isConfigured as firebaseConfigured,
  fetchInventoryList,
  fetchInventoryItemByName,
  fetchInventoryItemById,
  decrementStock,
  pushSale,
  fetchSalesList,
} from "./firebase.js";
import { LOW_STOCK_THRESHOLD } from "./firebase-config.js";
import { PRODUCTS as SEED_PRODUCTS } from "./products.js";

/** Marks a sale record as having come from the website rather than the till — used both when writing sales and when reading them back for the admin panel. */
export const ONLINE_CASHIER_LABEL = "Mummy Aka Shop — Online";

// ---------------------------------------------------------------------------
// Internal: low-level HTTP helper with timeout + consistent error shape
// (only used by the generic-REST fallback)
// ---------------------------------------------------------------------------
async function stockysaverFetch(path, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CONFIG.timeoutMs);

  try {
    const res = await fetch(`${CONFIG.baseUrl}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${CONFIG.apiKey}`,
        "X-Store-Id": CONFIG.storeId,
        ...(options.headers || {}),
      },
      signal: controller.signal,
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new StockySaverError(body.message || `Request failed (${res.status})`, res.status);
    }
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

export class StockySaverError extends Error {
  constructor(message, status = 0) {
    super(message);
    this.name = "StockySaverError";
    this.status = status;
  }
}

// ---------------------------------------------------------------------------
// Mock data store — used only when Firebase isn't configured and USE_MOCK
// is true, so the storefront works instantly with zero backend.
// ---------------------------------------------------------------------------
const mockInventory = new Map(
  SEED_PRODUCTS.map((p) => [
    p.id,
    { productId: p.id, stock: p.stock, price: p.price, lowStockThreshold: p.lowStockThreshold ?? 5 },
  ])
);

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Resolves a storefront product id to the name StockySaver stores it under. */
function firebaseNameFor(productId) {
  const product = SEED_PRODUCTS.find((p) => p.id === productId);
  if (!product) return null;
  return product.firebaseName || product.name;
}

/**
 * Finds the real StockySaver row behind a storefront product. Products
 * synced live from StockySaver already carry `firebaseId` (the exact push
 * key) so lookup is direct; hand-curated demo/manual products fall back to
 * matching by name (see firebaseNameFor / the `firebaseName` override).
 */
async function resolveFirebaseRow(productId) {
  const product = SEED_PRODUCTS.find((p) => p.id === productId);
  if (product?.firebaseId) {
    return fetchInventoryItemById(product.firebaseId);
  }
  return fetchInventoryItemByName(firebaseNameFor(productId));
}

// ---------------------------------------------------------------------------
// PUBLIC API — everything the storefront and admin panel call
// ---------------------------------------------------------------------------
export const StockySaverAPI = {
  /**
   * Fetches live stock levels + current prices for every product, from
   * businesses/{bizId}/inventory in StockySaver's Firebase.
   */
  async fetchInventory() {
    if (firebaseConfigured()) {
      const rows = await fetchInventoryList();
      // Map into the { productId, stock, price } shape the rest of the app
      // expects, matching each StockySaver row back to a storefront product
      // by name wherever possible.
      return rows.map((row) => {
        const match = SEED_PRODUCTS.find(
          (p) => (p.firebaseName || p.name).trim().toLowerCase() === (row.name || "").trim().toLowerCase()
        );
        return {
          productId: match ? match.id : row.id,
          firebaseId: row.id,
          name: row.name,
          stock: row.qty ?? 0,
          price: row.price ?? match?.price ?? 0,
          lowStockThreshold: LOW_STOCK_THRESHOLD,
        };
      });
    }
    if (USE_MOCK) {
      await delay(280);
      return Array.from(mockInventory.values());
    }
    return stockysaverFetch(`/stores/${CONFIG.storeId}/inventory`);
  },

  /**
   * Fetches live stock + price for a single product (used on the product
   * detail page so numbers are always fresh, not just cached from the grid).
   */
  async fetchProductStock(productId) {
    if (firebaseConfigured()) {
      const row = await resolveFirebaseRow(productId);
      if (!row) throw new StockySaverError(`Product not found in StockySaver inventory`, 404);
      return { productId, firebaseId: row.id, stock: row.qty ?? 0, price: row.price ?? 0 };
    }
    if (USE_MOCK) {
      await delay(180);
      const record = mockInventory.get(productId);
      if (!record) throw new StockySaverError("Product not found in StockySaver", 404);
      return { ...record };
    }
    return stockysaverFetch(`/stores/${CONFIG.storeId}/inventory/${productId}`);
  },

  /**
   * Pre-checkout validation: confirms every cart line is still in stock at
   * the quantity requested BEFORE we let the customer submit payment.
   * Body: { lines: [{ productId, quantity }] }
   */
  async validateOrder(lines) {
    if (firebaseConfigured()) {
      const issues = [];
      for (const { productId, quantity } of lines) {
        const row = await resolveFirebaseRow(productId);
        if (!row) {
          issues.push({ productId, reason: "not_found" });
        } else if ((row.qty ?? 0) < quantity) {
          issues.push({ productId, reason: "insufficient_stock", available: row.qty ?? 0 });
        }
      }
      return { valid: issues.length === 0, issues };
    }
    if (USE_MOCK) {
      await delay(320);
      const issues = [];
      lines.forEach(({ productId, quantity }) => {
        const record = mockInventory.get(productId);
        if (!record) {
          issues.push({ productId, reason: "not_found" });
        } else if (record.stock < quantity) {
          issues.push({ productId, reason: "insufficient_stock", available: record.stock });
        }
      });
      return { valid: issues.length === 0, issues };
    }
    return stockysaverFetch(`/stores/${CONFIG.storeId}/orders/validate`, {
      method: "POST",
      body: JSON.stringify({ lines }),
    });
  },

  /**
   * Saves the confirmed order and atomically decrements inventory for each
   * line item — via StockySaver's own transaction path when Firebase is
   * configured, so a website sale can never oversell against a till sale
   * happening at the same moment. Also writes the sale into StockySaver's
   * own `sales` list so it appears in the POS's Sales History and Reports.
   */
  async submitOrder(order) {
    if (firebaseConfigured()) {
      const { valid, issues } = await this.validateOrder(
        order.lines.map((l) => ({ productId: l.productId, quantity: l.quantity }))
      );
      if (!valid) {
        throw new StockySaverError("Some items changed availability since you added them to cart.", 409);
      }

      // Decrement stock one line at a time via the same atomic transaction
      // StockySaver's own checkout uses, so concurrent till + web sales
      // can't oversell the same item.
      const stockErrors = [];
      for (const line of order.lines) {
        const row = await resolveFirebaseRow(line.productId);
        if (!row) {
          stockErrors.push(`"${line.name}" not found in StockySaver inventory.`);
          continue;
        }
        const result = await decrementStock(row.id, line.quantity);
        if (!result.committed) {
          stockErrors.push(`"${line.name}" no longer has enough stock.`);
        }
      }
      if (stockErrors.length) {
        throw new StockySaverError(stockErrors.join(" "), 409);
      }

      const orderNumber = generateOrderNumber();

      // Log into StockySaver's own sales list, in the same shape its POS
      // checkout writes, so it shows up in Sales History / Reports there too.
      await pushSale({
        cashier: "Mummy Aka Shop — Online",
        customer: order.customer?.name || "Website customer",
        timestamp: new Date().toISOString(),
        total: order.totals.total,
        orderNumber,
        fulfilment: order.fulfillment?.method || null,
        items: order.lines.map((l) => ({
          name: l.name,
          qty: l.quantity,
          price: l.unitPrice,
          total: l.unitPrice * l.quantity,
        })),
      });

      return { orderNumber, status: "confirmed", createdAt: new Date().toISOString(), ...order };
    }
    if (USE_MOCK) {
      await delay(500);
      // Re-validate right before "committing" — guards against race
      // conditions where stock changed between validation and submission.
      const { valid } = await this.validateOrder(
        order.lines.map((l) => ({ productId: l.productId, quantity: l.quantity }))
      );
      if (!valid) {
        throw new StockySaverError(
          "Some items changed availability since you added them to cart.",
          409
        );
      }
      order.lines.forEach(({ productId, quantity }) => {
        const record = mockInventory.get(productId);
        record.stock = Math.max(0, record.stock - quantity);
      });
      const orderNumber = generateOrderNumber();
      return {
        orderNumber,
        status: "confirmed",
        createdAt: new Date().toISOString(),
        ...order,
      };
    }
    return stockysaverFetch(`/stores/${CONFIG.storeId}/orders`, {
      method: "POST",
      body: JSON.stringify(order),
    });
  },

  /**
   * Syncs canonical pricing from StockySaver. StockySaver doesn't store
   * product images, so the storefront's own placeholder/product images in
   * products.js are always used for display — only price is synced.
   */
  async syncProductMedia(productId) {
    if (firebaseConfigured()) {
      const row = await resolveFirebaseRow(productId);
      return row ? { images: null, price: row.price ?? null } : null;
    }
    if (USE_MOCK) {
      await delay(150);
      const product = SEED_PRODUCTS.find((p) => p.id === productId);
      return product ? { images: product.images, price: product.price } : null;
    }
    return stockysaverFetch(`/stores/${CONFIG.storeId}/products/${productId}/media`);
  },

  /**
   * Lightweight connectivity check the admin dashboard polls to show a
   * "StockySaver: connected / degraded / offline" indicator.
   */
  async checkHealth() {
    if (firebaseConfigured()) {
      try {
        await fetchInventoryList();
        return { status: "connected", latencyMs: 0, mock: false, backend: "firebase" };
      } catch (err) {
        return { status: "offline", error: err.message, mock: false, backend: "firebase" };
      }
    }
    if (USE_MOCK) {
      await delay(120);
      return { status: "connected", latencyMs: 120, mock: true };
    }
    try {
      const start = performance.now();
      await stockysaverFetch(`/health`);
      return { status: "connected", latencyMs: Math.round(performance.now() - start), mock: false };
    } catch (err) {
      return { status: "offline", error: err.message, mock: false };
    }
  },
};

function generateOrderNumber() {
  const date = new Date();
  const stamp = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(
    date.getDate()
  ).padStart(2, "0")}`;
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `MAS-${stamp}-${rand}`;
}

/**
 * Convenience wrapper used by cart.js / app.js: attempts a StockySaver call
 * and gracefully degrades (toast + safe fallback) instead of throwing raw
 * errors into the UI when the sync fails.
 */
export async function withGracefulSync(fn, { onError, fallback = null } = {}) {
  try {
    return await fn();
  } catch (err) {
    console.error("[StockySaver sync failed]", err);
    if (onError) onError(err);
    return fallback;
  }
}
