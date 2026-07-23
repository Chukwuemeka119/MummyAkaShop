/**
 * ==========================================================================
 * CART.JS
 * --------------------------------------------------------------------------
 * Shopping cart + wishlist state. Persists to localStorage so a customer's
 * cart survives a page refresh or a closed tab. Emits a "cart:change" and
 * "wishlist:change" CustomEvent on `window` whenever state mutates, so
 * app.js can re-render badges/UI without tight coupling.
 * ==========================================================================
 */

import { getProduct, formatNaira } from "./products.js";

const CART_KEY = "mas_cart_v1";
const WISHLIST_KEY = "mas_wishlist_v1";
const DELIVERY_FEE = 1500;
const FREE_DELIVERY_THRESHOLD = 30000;

function readStorage(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}
function writeStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.warn("Could not persist to localStorage:", err);
  }
}

// state: { [productId]: quantity }
let cartState = readStorage(CART_KEY, {});
// state: array of productIds
let wishlistState = readStorage(WISHLIST_KEY, []);

function persistCart() {
  writeStorage(CART_KEY, cartState);
  window.dispatchEvent(new CustomEvent("cart:change", { detail: getCartSummary() }));
}
function persistWishlist() {
  writeStorage(WISHLIST_KEY, wishlistState);
  window.dispatchEvent(new CustomEvent("wishlist:change", { detail: [...wishlistState] }));
}

export const Cart = {
  /** Adds `qty` of a product, clamped to available stock. */
  add(productId, qty = 1) {
    const product = getProduct(productId);
    if (!product || product.stock <= 0) return false;
    const current = cartState[productId] || 0;
    const next = Math.min(current + qty, product.stock);
    cartState[productId] = next;
    persistCart();
    return true;
  },

  setQty(productId, qty) {
    const product = getProduct(productId);
    if (!product) return;
    const clamped = Math.max(0, Math.min(qty, product.stock));
    if (clamped <= 0) {
      delete cartState[productId];
    } else {
      cartState[productId] = clamped;
    }
    persistCart();
  },

  remove(productId) {
    delete cartState[productId];
    persistCart();
  },

  clear() {
    cartState = {};
    persistCart();
  },

  getLines() {
    return Object.entries(cartState)
      .map(([productId, qty]) => {
        const product = getProduct(productId);
        if (!product) return null;
        return { product, qty, lineTotal: product.price * qty };
      })
      .filter(Boolean);
  },

  count() {
    return Object.values(cartState).reduce((sum, q) => sum + q, 0);
  },
};

/**
 * @param {"delivery"|"pickup"} fulfilmentMethod - pickup always waives the
 * delivery fee outright, regardless of subtotal; delivery still gets free
 * shipping once the subtotal clears FREE_DELIVERY_THRESHOLD.
 */
export function getCartSummary(fulfilmentMethod = "delivery") {
  const lines = Cart.getLines();
  const subtotal = lines.reduce((sum, l) => sum + l.lineTotal, 0);
  const isPickup = fulfilmentMethod === "pickup";
  const delivery = isPickup || subtotal === 0 || subtotal >= FREE_DELIVERY_THRESHOLD ? 0 : DELIVERY_FEE;
  const total = subtotal + delivery;
  return { lines, subtotal, delivery, total, count: Cart.count(), freeDeliveryThreshold: FREE_DELIVERY_THRESHOLD, isPickup };
}

export const Wishlist = {
  toggle(productId) {
    const idx = wishlistState.indexOf(productId);
    if (idx >= 0) wishlistState.splice(idx, 1);
    else wishlistState.push(productId);
    persistWishlist();
    return wishlistState.includes(productId);
  },
  has(productId) {
    return wishlistState.includes(productId);
  },
  set() {
    return new Set(wishlistState);
  },
  items() {
    return wishlistState.map(getProduct).filter(Boolean);
  },
};

/** Renders the cart page markup (used by app.js's #/cart route). */
export function cartViewHTML() {
  const { lines, subtotal, delivery, total, freeDeliveryThreshold } = getCartSummary();

  if (lines.length === 0) {
    return `
    <div class="empty-state panel reveal in-view">
      <div class="emoji">🧺</div>
      <h2>Your basket is empty</h2>
      <p class="muted">Browse the shop and add a few things — your cart is saved automatically.</p>
      <a class="btn btn-primary" href="#/shop">Start shopping</a>
    </div>`;
  }

  const remainingForFree = Math.max(0, freeDeliveryThreshold - subtotal);

  return `
  <div class="cart-layout">
    <div>
      <div class="flex-between mt-0">
        <h1 class="mt-0">Your basket <span class="muted mono">(${lines.length} item${lines.length > 1 ? "s" : ""})</span></h1>
        <button class="btn btn-ghost btn-sm" data-action="clear-cart">Clear basket</button>
      </div>
      ${remainingForFree > 0 ? `<div class="panel" style="padding:.8rem 1rem;margin-bottom:1rem;"><span class="mono">Add ${formatNaira(remainingForFree)} more for free delivery 🚚</span> <span class="muted" style="font-size:12px">(choosing store pickup at checkout waives this too)</span></div>` : `<div class="panel" style="padding:.8rem 1rem;margin-bottom:1rem;background:var(--sage-100);border-color:transparent;"><span class="mono" style="color:var(--sage)">✓ You qualify for free delivery</span></div>`}
      <div class="panel">
        ${lines
          .map(
            (l) => `
          <div class="cart-line" data-id="${l.product.id}">
            <img src="${l.product.images[0]}" alt="${l.product.name}" loading="lazy">
            <div class="name-block">
              <div class="name"><a href="#/product/${l.product.id}">${l.product.name}</a></div>
              <div class="unit-price">${formatNaira(l.product.price)} each</div>
              <button class="remove-link" data-action="remove-line" data-id="${l.product.id}">Remove</button>
            </div>
            <div class="line-actions">
              <div class="qty-stepper" data-id="${l.product.id}">
                <button data-action="dec" aria-label="Decrease quantity">−</button>
                <input type="number" min="1" max="${l.product.stock}" value="${l.qty}" data-action="qty-input" aria-label="Quantity for ${l.product.name}">
                <button data-action="inc" aria-label="Increase quantity">+</button>
              </div>
              <div class="line-total mono">${formatNaira(l.lineTotal)}</div>
            </div>
          </div>`
          )
          .join("")}
      </div>
    </div>
    <aside class="panel" aria-label="Order summary">
      <h2 class="mt-0">Order summary</h2>
      <div class="summary-row"><span>Subtotal</span><span class="mono">${formatNaira(subtotal)}</span></div>
      <div class="summary-row"><span>Delivery</span><span class="mono">${delivery === 0 ? "Free" : formatNaira(delivery)}</span></div>
      <div class="summary-row total"><span>Total</span><span>${formatNaira(total)}</span></div>
      <a href="#/checkout" class="btn btn-gold btn-block mt-1">Proceed to checkout</a>
      <a href="#/shop" class="btn btn-outline btn-block mt-1">Continue shopping</a>
    </aside>
  </div>`;
}
