/**
 * ==========================================================================
 * AUTH.JS
 * --------------------------------------------------------------------------
 * Customer registration / login / profile / order-history UI logic.
 *
 * IMPORTANT: This is a front-end demo implementation. Passwords are never
 * sent anywhere in plaintext over the wire because there IS no wire yet —
 * everything is local to the browser (localStorage) purely so the UI is
 * fully interactive without a backend. Before going live, replace
 * `AuthAPI` below with real calls to your auth service (session cookies or
 * JWT) and NEVER store real passwords in localStorage.
 * ==========================================================================
 */

import { isConfigured as firebaseConfigured, fetchAdminPassword } from "./firebase.js";

const USERS_KEY = "mas_users_v1";
const SESSION_KEY = "mas_session_v1";
const ORDERS_KEY = "mas_orders_v1";

function readStorage(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}
function writeStorage(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

// Extremely lightweight hash so we at least don't store raw passwords —
// NOT cryptographically secure. Replace with real server-side hashing
// (bcrypt/argon2) once a backend exists.
function naiveHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return String(hash);
}

export const AuthAPI = {
  register({ name, email, phone, password }) {
    const users = readStorage(USERS_KEY, []);
    if (users.some((u) => u.email.toLowerCase() === email.toLowerCase())) {
      throw new Error("An account with this email already exists.");
    }
    const user = { id: `u_${Date.now()}`, name, email, phone, passwordHash: naiveHash(password), createdAt: new Date().toISOString() };
    users.push(user);
    writeStorage(USERS_KEY, users);
    this.setSession(user);
    return user;
  },

  login({ email, password }) {
    const users = readStorage(USERS_KEY, []);
    const user = users.find((u) => u.email.toLowerCase() === email.toLowerCase());
    if (!user || user.passwordHash !== naiveHash(password)) {
      throw new Error("Incorrect email or password.");
    }
    this.setSession(user);
    return user;
  },

  logout() {
    localStorage.removeItem(SESSION_KEY);
    window.dispatchEvent(new CustomEvent("auth:change", { detail: null }));
  },

  setSession(user) {
    writeStorage(SESSION_KEY, { id: user.id, name: user.name, email: user.email });
    window.dispatchEvent(new CustomEvent("auth:change", { detail: this.currentUser() }));
  },

  currentUser() {
    return readStorage(SESSION_KEY, null);
  },

  isLoggedIn() {
    return !!this.currentUser();
  },

  updateProfile(patch) {
    const session = this.currentUser();
    if (!session) throw new Error("Not logged in.");
    const users = readStorage(USERS_KEY, []);
    const idx = users.findIndex((u) => u.id === session.id);
    if (idx === -1) throw new Error("User not found.");
    users[idx] = { ...users[idx], ...patch };
    writeStorage(USERS_KEY, users);
    this.setSession(users[idx]);
    return users[idx];
  },

  fullProfile() {
    const session = this.currentUser();
    if (!session) return null;
    const users = readStorage(USERS_KEY, []);
    return users.find((u) => u.id === session.id) || null;
  },
};

export const OrdersStore = {
  saveOrder(order) {
    const all = readStorage(ORDERS_KEY, []);
    const owner = AuthAPI.currentUser();
    all.unshift({ ...order, ownerId: owner ? owner.id : "guest" });
    writeStorage(ORDERS_KEY, all);
  },
  forCurrentUser() {
    const owner = AuthAPI.currentUser();
    const all = readStorage(ORDERS_KEY, []);
    if (!owner) return [];
    return all.filter((o) => o.ownerId === owner.id);
  },
  all() {
    return readStorage(ORDERS_KEY, []);
  },
};

/**
 * Admin auth — deliberately ONE admin, no separate usernames. When
 * StockySaver is connected, this reads the exact same
 * businesses/{bizId}/config/adminPassword your POS already uses, so the
 * storefront admin panel and the StockySaver admin panel share one
 * password. Falls back to a local-only demo password when StockySaver
 * isn't connected yet.
 */
const ADMIN_KEY = "mas_admin_session";
const LOCAL_FALLBACK_PASSWORD = "mummyaka2026"; // used only while Firebase isn't configured

export const AdminAuth = {
  async login({ password }) {
    const correct = firebaseConfigured() ? await fetchAdminPassword() : LOCAL_FALLBACK_PASSWORD;
    if (password !== correct) {
      throw new Error("Incorrect admin password.");
    }
    writeStorage(ADMIN_KEY, { loggedInAt: new Date().toISOString() });
    return true;
  },
  logout() {
    localStorage.removeItem(ADMIN_KEY);
  },
  isLoggedIn() {
    return !!readStorage(ADMIN_KEY, null);
  },
};

// ---------------------------------------------------------------------------
// View renderers
// ---------------------------------------------------------------------------
export function authViewHTML(mode = "login") {
  return `
  <div class="auth-wrap panel reveal in-view">
    <div class="auth-tabs" role="tablist">
      <button role="tab" class="${mode === "login" ? "active" : ""}" data-auth-tab="login">Sign in</button>
      <button role="tab" class="${mode === "register" ? "active" : ""}" data-auth-tab="register">Create account</button>
    </div>

    <form id="login-form" style="${mode === "login" ? "" : "display:none"}" novalidate>
      <div class="field">
        <label for="login-email">Email address</label>
        <input id="login-email" name="email" type="email" required autocomplete="email">
      </div>
      <div class="field">
        <label for="login-password">Password</label>
        <input id="login-password" name="password" type="password" required autocomplete="current-password" minlength="6">
      </div>
      <p class="error-msg mono" id="login-error" style="display:none;color:var(--coral);font-size:12.5px;"></p>
      <button class="btn btn-primary btn-block" type="submit">Sign in</button>
      <p class="muted center mt-1" style="font-size:12.5px">Demo tip: register an account first — there's no real backend yet.</p>
    </form>

    <form id="register-form" style="${mode === "register" ? "" : "display:none"}" novalidate>
      <div class="field">
        <label for="reg-name">Full name</label>
        <input id="reg-name" name="name" type="text" required autocomplete="name">
      </div>
      <div class="field">
        <label for="reg-email">Email address</label>
        <input id="reg-email" name="email" type="email" required autocomplete="email">
      </div>
      <div class="field">
        <label for="reg-phone">Phone number</label>
        <input id="reg-phone" name="phone" type="tel" required autocomplete="tel" placeholder="080X XXX XXXX">
      </div>
      <div class="field">
        <label for="reg-password">Password</label>
        <input id="reg-password" name="password" type="password" required autocomplete="new-password" minlength="6">
        <span class="hint">At least 6 characters.</span>
      </div>
      <p class="error-msg mono" id="register-error" style="display:none;color:var(--coral);font-size:12.5px;"></p>
      <button class="btn btn-primary btn-block" type="submit">Create account</button>
    </form>
  </div>`;
}

export function profileViewHTML() {
  const user = AuthAPI.fullProfile();
  if (!user) return authViewHTML("login");
  return `
  <div class="panel reveal in-view" style="max-width:560px;margin:0 auto;">
    <h1 class="mt-0">My profile</h1>
    <form id="profile-form" novalidate>
      <div class="field-row">
        <div class="field"><label for="p-name">Full name</label><input id="p-name" name="name" value="${user.name}" required></div>
        <div class="field"><label for="p-phone">Phone</label><input id="p-phone" name="phone" value="${user.phone || ""}" required></div>
      </div>
      <div class="field"><label for="p-email">Email</label><input id="p-email" name="email" type="email" value="${user.email}" disabled></div>
      <div class="field"><label for="p-address">Delivery address</label><textarea id="p-address" name="address" rows="3">${user.address || ""}</textarea></div>
      <button class="btn btn-primary" type="submit">Save changes</button>
    </form>
    <hr class="stitch-divider mt-2" style="margin-bottom:1.4rem;">
    <button class="btn btn-outline btn-block" data-action="logout">Sign out</button>
  </div>`;
}
