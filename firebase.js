/**
 * ==========================================================================
 * FIREBASE.JS
 * --------------------------------------------------------------------------
 * Talks to the SAME Firebase Realtime Database StockySaver's own app.js
 * uses — same SDK version, same `businesses/{bizId}/...` path structure.
 * An order placed on the storefront decrements the exact inventory row
 * StockySaver shows at the till, and is logged into StockySaver's own
 * `sales` list so it shows up in the Reports tab too.
 *
 * Everything here is guarded so the app runs fine (falling back to mock
 * data in stockysaver-api.js) even before STORE_BIZ_ID is filled in.
 * ==========================================================================
 */

import { firebaseConfig, FIREBASE_ENABLED, STORE_BIZ_ID } from "./firebase-config.js";

let app = null;
let db = null;
let dbFns = null; // { ref, get, onValue, update, push, remove, set, runTransaction }

/** True only once the SDK has loaded AND a real business code has been set. */
export function isConfigured() {
  return FIREBASE_ENABLED && !!db && !!STORE_BIZ_ID && STORE_BIZ_ID !== "PASTE_YOUR_BUSINESS_CODE_HERE";
}

if (FIREBASE_ENABLED) {
  try {
    const { initializeApp } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js");
    dbFns = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js");
    app = initializeApp(firebaseConfig);
    db = dbFns.getDatabase(app);
    console.info("[Firebase] Connected to StockySaver project:", firebaseConfig.projectId);
    if (STORE_BIZ_ID === "PASTE_YOUR_BUSINESS_CODE_HERE") {
      console.warn("[Firebase] STORE_BIZ_ID is still a placeholder — set it in firebase-config.js to sync real data.");
    }
  } catch (err) {
    console.error("[Firebase] Failed to initialize — falling back to mock data.", err);
  }
}

export { app, db, dbFns, FIREBASE_ENABLED, STORE_BIZ_ID };

function bizPath(path) {
  return `businesses/${STORE_BIZ_ID}/${path}`;
}

/**
 * Mirrors StockySaver's own `bizRef()` helper — returns a Database ref
 * scoped to this business, e.g. bizRef('inventory'), bizRef('sales').
 */
export function bizRef(path) {
  if (!isConfigured()) return null;
  return dbFns.ref(db, bizPath(path));
}

/** Reads businesses/{bizId}/inventory as a flat array of { id, name, price, qty }. */
export async function fetchInventoryList() {
  if (!isConfigured()) return [];
  const snap = await dbFns.get(bizRef("inventory"));
  const list = [];
  if (snap.exists()) snap.forEach((child) => list.push({ id: child.key, ...child.val() }));
  return list;
}

/** Finds one inventory row by exact (trimmed, case-insensitive) name match. */
export async function fetchInventoryItemByName(name) {
  if (!isConfigured() || !name) return null;
  const target = name.trim().toLowerCase();
  const list = await fetchInventoryList();
  return list.find((i) => (i.name || "").trim().toLowerCase() === target) || null;
}

/** Finds one inventory row directly by its Firebase push key. */
export async function fetchInventoryItemById(itemId) {
  if (!isConfigured() || !itemId) return null;
  const snap = await dbFns.get(bizRef(`inventory/${itemId}`));
  return snap.exists() ? { id: itemId, ...snap.val() } : null;
}

/**
 * Subscribes to businesses/{bizId}/inventory in real time — fires
 * `callback(list)` immediately with the current data and again every time
 * StockySaver's inventory changes (a till sale, a restock, a manual edit).
 * Returns an unsubscribe function. No-op (returns a no-op unsubscribe) when
 * Firebase isn't configured.
 */
export function subscribeInventory(callback) {
  if (!isConfigured()) return () => {};
  return dbFns.onValue(bizRef("inventory"), (snap) => {
    const list = [];
    if (snap.exists()) snap.forEach((child) => list.push({ id: child.key, ...child.val() }));
    callback(list);
  });
}

/**
 * Atomically decrements an inventory row's qty, exactly like StockySaver's
 * own runTransaction() call in handlePrint(). Returns { committed, newQty }.
 * If StockySaver's stock is genuinely too low, the transaction aborts
 * (returns undefined) and committed will be false.
 */
export async function decrementStock(itemId, qty) {
  if (!isConfigured()) return { committed: false, newQty: null };
  const qtyRef = dbFns.ref(db, bizPath(`inventory/${itemId}/qty`));
  const result = await dbFns.runTransaction(qtyRef, (current) => {
    const c = current ?? 0;
    if (c < qty) return; // abort — insufficient stock
    return Math.max(0, c - qty);
  });
  return { committed: result.committed, newQty: result.committed ? result.snapshot.val() : null };
}

/**
 * Writes a sale into businesses/{bizId}/sales using the same shape
 * StockySaver's handlePrint() writes, so it appears in StockySaver's own
 * Sales History and Reports tabs. Returns the new sale's push key.
 */
export async function pushSale(sale) {
  if (!isConfigured()) return null;
  const newRef = await dbFns.push(bizRef("sales"), sale);
  return newRef.key;
}

/** Reads businesses/{bizId}/business (store name/address/phone), like StockySaver's loadStore(). */
export async function fetchBusinessProfile() {
  if (!isConfigured()) return null;
  const snap = await dbFns.get(bizRef("business"));
  return snap.exists() ? snap.val() : null;
}

/**
 * Reads every sale under businesses/{bizId}/sales — both StockySaver's own
 * till sales AND orders placed on this storefront (they're written into
 * the same list, see pushSale() above). Most recent first.
 */
export async function fetchSalesList() {
  if (!isConfigured()) return [];
  const snap = await dbFns.get(bizRef("sales"));
  const list = [];
  if (snap.exists()) snap.forEach((child) => list.push({ id: child.key, ...child.val() }));
  list.sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));
  return list;
}

/**
 * Real-time equivalent of fetchSalesList — fires immediately and again on
 * every new sale (website or till), so the admin dashboard/orders page
 * stays live without polling. Returns an unsubscribe function.
 */
export function subscribeSales(callback) {
  if (!isConfigured()) return () => {};
  return dbFns.onValue(bizRef("sales"), (snap) => {
    const list = [];
    if (snap.exists()) snap.forEach((child) => list.push({ id: child.key, ...child.val() }));
    list.sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));
    callback(list);
  });
}

/**
 * Reads the ONE shared admin password StockySaver already uses
 * (businesses/{bizId}/config/adminPassword), so this storefront's admin
 * panel and your POS's admin panel are protected by the exact same
 * credential — one admin, one password, both places. Mirrors StockySaver's
 * own getAdminPw() fallback of "admin123" when the field isn't set yet.
 */
export async function fetchAdminPassword() {
  if (!isConfigured()) return null;
  try {
    const snap = await dbFns.get(bizRef("config"));
    return snap.exists() ? snap.val().adminPassword || "admin123" : "admin123";
  } catch {
    return "admin123";
  }
}

/** Lightweight connectivity check — confirms the business node is reachable. */
export async function checkConnection() {
  if (!isConfigured()) return false;
  try {
    const snap = await dbFns.get(bizRef("config/active"));
    return snap.exists() ? snap.val() !== false : true;
  } catch {
    return false;
  }
}
