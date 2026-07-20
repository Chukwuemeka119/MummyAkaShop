/**
 * ==========================================================================
 * FIREBASE-CONFIG.JS
 * --------------------------------------------------------------------------
 * Connected to your real StockySaver Firebase project (Realtime Database),
 * business code "SHOP" — this is the node in your Firebase data whose
 * `business.name` is "Mummy Aka Shop" (address "Jikwoyi", phone
 * "08065516220"). The storefront reads/writes the exact same
 * `businesses/SHOP/inventory` and `businesses/SHOP/sales` paths your
 * StockySaver POS uses.
 *
 * NOTE: you mentioned the business code was "STORE", but the Firebase data
 * you shared only has two business nodes — "EJIKE" and "SHOP" — and "SHOP"
 * is the one that matches Mummy Aka Shop. If "STORE" is a real code that
 * exists elsewhere in your database, change STORE_BIZ_ID below to match.
 * ==========================================================================
 */

export const firebaseConfig = {
  apiKey: "AIzaSyAF7q176rxAoCFqhH0Djquhu0MphaUMLyQ",
  authDomain: "pos-store-29e58.firebaseapp.com",
  databaseURL: "https://pos-store-29e58-default-rtdb.firebaseio.com",
  projectId: "pos-store-29e58",
  storageBucket: "pos-store-29e58.firebasestorage.app",
  messagingSenderId: "494046387333",
  appId: "1:494046387333:web:44ef67eeac8e40e4f19dec",
};

/**
 * Firebase is on. The storefront now reads/writes the exact same
 * `businesses/{bizId}/inventory` and `businesses/{bizId}/sales` paths
 * your StockySaver POS uses.
 */
export const FIREBASE_ENABLED = true;

/**
 * The business code Mummy Aka Shop logs into StockySaver with (the code
 * typed into the "bizcode" field on login.html). Everything reads/writes
 * under businesses/{STORE_BIZ_ID}/... — change this only if you ever
 * rename the business in StockySaver.
 */
export const STORE_BIZ_ID = "SHOP";

/**
 * StockySaver inventory rows only have { name, price, qty } — no SKU, no
 * images, no category. To connect a storefront product (see products.js)
 * to a real StockySaver row, the storefront matches by exact item name
 * (case-insensitive, whitespace-trimmed).
 *
 * If a product's storefront display name won't exactly match its
 * StockySaver name, add a `firebaseName` field to that product in
 * products.js, e.g.:
 *   { id: "p001", name: "Golden Penny Semovita 5kg", firebaseName: "Semovita 5kg", ... }
 * The sync logic always prefers `firebaseName` over `name` when present.
 */
export const LOW_STOCK_THRESHOLD = 5; // mirrors StockySaver's own LOW_STOCK_THRESHOLD
