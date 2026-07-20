# Mummy Aka Shop 🛍️

A production-ready, fully responsive e-commerce storefront for **Mummy Aka Shop**, built with plain HTML5, CSS3, and vanilla JavaScript (ES6 modules) — no frameworks, no build step. Designed to connect with the **StockySaver** inventory / POS system.

---

## ✨ Features

- Responsive, mobile-first storefront (home, shop, product detail, cart, checkout, auth, profile, orders, wishlist)
- Sticky navigation with live search, cart/wishlist badges, and a mobile drawer menu
- Product search, category filtering, and sorting
- Shopping cart with quantity controls, persisted to `localStorage`
- Multi-step checkout (delivery details → review → confirmation) with pickup/delivery choice
- Customer registration, login, profile editing, and order history (demo auth, local only)
- Admin panel: dashboard, products, categories, orders, customers, inventory, low-stock notifications
- StockySaver integration layer with a **mock mode** so the whole site works instantly, offline, with zero backend
- Dark mode toggle (persisted, respects system preference on first visit)
- Scroll reveal animations, skeleton/loading states, toast notifications
- Accessible: semantic HTML, visible focus states, `aria-*` labelling, reduced-motion support, skip link
- SEO: meta tags, Open Graph tags, JSON-LD structured data, `robots.txt`, `sitemap.xml`
- PWA-ready: `manifest.webmanifest` and icon references already wired into `index.html`

---

## 📁 Project structure

```
mummy-aka-shop/
├── index.html                 # Single-page app shell (hash-routed)
├── css/
│   ├── style.css               # Design tokens + all component styles
│   └── responsive.css          # Breakpoints (mobile → large desktop)
├── js/
│   ├── app.js                  # Router + view rendering + event wiring
│   ├── cart.js                 # Cart & wishlist state (localStorage)
│   ├── products.js              # Product dataset + search/filter/sort
│   ├── auth.js                  # Customer + admin auth (demo, local)
│   └── stockysaver-api.js       # StockySaver integration layer (see docs/API.md)
├── images/                     # Local image assets (placeholder photography used by default)
├── assets/
│   ├── manifest.webmanifest    # PWA manifest
│   └── favicon.svg
├── docs/
│   └── API.md                  # StockySaver endpoint contract & integration guide
├── robots.txt
└── sitemap.xml
```

---

## 🚀 Getting started

No build tools, no `npm install`. Because the app uses ES6 modules (`<script type="module">`), it must be served over HTTP (not opened directly as a `file://` URL, which browsers block for modules).

**Option A — Python (already on most machines):**
```bash
cd mummy-aka-shop
python3 -m http.server 8080
# then open http://localhost:8080
```

**Option B — Node's `http-server`:**
```bash
npx http-server ./mummy-aka-shop -p 8080
```

**Option C — VS Code:** install the "Live Server" extension, right-click `index.html` → "Open with Live Server".

### Accounts
| Role | Credentials |
|---|---|
| Customer | Register your own via **Create account** on `#/register` |
| Admin | One shared admin — password only, no username. Business code is already set to `SHOP` — the node in your Firebase data matching "Mummy Aka Shop". When StockySaver is connected (it is, by default in this build), the admin password is whatever's set in StockySaver's own `businesses/SHOP/config/adminPassword` — the same password your POS's admin panel uses. If that field has never been set, StockySaver defaults it to `admin123`. |

---

## 🔌 Connecting StockySaver

All StockySaver traffic is isolated in **`js/stockysaver-api.js`**. Nothing else in the codebase calls `fetch` directly against StockySaver — the storefront, cart, and admin panel all go through this one module.

1. Open `js/stockysaver-api.js`.
2. Set `CONFIG.baseUrl` to your real StockySaver API base URL and `CONFIG.apiKey` to a valid key (ideally injected via a server-side proxy, not hardcoded client-side — see Security notes).
3. Set `USE_MOCK = false`.
4. That's it — every method (`fetchInventory`, `fetchProductStock`, `validateOrder`, `submitOrder`, `syncProductMedia`, `checkHealth`) will now hit the real endpoints described in `docs/API.md` instead of the local mock dataset.

While `USE_MOCK` is `true`, the module simulates realistic network latency and mutates an in-memory copy of the product catalog so you can fully demo add-to-cart → checkout → inventory-decrement → low-stock warnings without any backend at all.

---

## 🎨 Design system

- **Palette:** deep indigo (`--ink`), warm ochre gold (`--gold`), cream background (`--cream`), charcoal text, coral for sale/alerts, sage green for success/in-stock.
- **Type:** Fraunces (display/headings), Manrope (body/UI), JetBrains Mono (prices, order numbers, SKUs, stock counts — a deliberate "shop ledger" motif).
- **Signature element:** receipt/ticket-style cards (see the homepage hero and order confirmation) with a dashed ledger divide and a "verified" stamp — a nod to a shop that keeps careful books.
- All colours and spacing are CSS custom properties in `:root` (and re-mapped under `[data-theme="dark"]`), so retheming is a token edit, not a rewrite.

---

## ♿ Accessibility

- Skip-to-content link, semantic landmarks (`header`, `nav`, `main`, `footer`)
- Visible `:focus-visible` outlines everywhere, including custom controls
- All icon-only buttons have `aria-label`s; toggles expose `aria-pressed`
- `prefers-reduced-motion` disables animation/transition durations
- Colour contrast targets WCAG AA against both light and dark backgrounds

---

## 🔒 Security notes (read before production)

This deliverable is a **front-end-only** demo. Before launch:

- Move `AuthAPI` (in `js/auth.js`) to a real backend with server-side password hashing (bcrypt/argon2) — the included `naiveHash()` is explicitly **not** cryptographically secure and only exists so the demo has *some* separation from plaintext.
- Never ship a real StockySaver API key in client-side JavaScript. Proxy StockySaver calls through your own backend so the key stays server-side.
- The admin panel now shares StockySaver's own admin password (`businesses/SHOP/config/adminPassword`) instead of a separate hardcoded one — change it in one place (StockySaver) and both panels update. If you ever run the storefront without StockySaver connected, it falls back to a local-only demo password (`mummyaka2026`) — fine for local testing, not for production.
- Add HTTPS, CSRF protection, and rate limiting once a real backend exists.
- Payment: the checkout UI is intentionally "pay with card" as a placeholder — plug in a PCI-compliant processor (Paystack, Flutterwave, Stripe) rather than handling card numbers directly.

---

## 🏪 Store profile (contact, address, hours, story)

Open **`js/store-config.js`** and fill in `STORE_INFO`: phone, WhatsApp number, email, address, city, opening hours, socials, and a short "about" story. These power:
- The homepage's new **"Visit us"** section (photo, story, address, hours, call/WhatsApp/directions buttons)
- The footer's phone/email/address
- The top announcement bar's delivery-threshold city text

Any field left as `""` or a `PASTE_...` placeholder is hidden automatically rather than showing broken/fake info — so it's safe to fill this in gradually.

## 📦 Live catalog from StockySaver

Once `STORE_BIZ_ID` is set in `js/firebase-config.js`, the storefront no longer shows the 18 demo products — it loads your **real StockySaver inventory** as the catalog on page load, and keeps it live afterward (a till sale, restock, or manual edit in StockySaver updates the site automatically, no refresh needed). This is powered by `syncCatalogFromStockySaver()` / `watchCatalogFromStockySaver()` in `js/products.js`.

Because StockySaver rows only have `{ name, price, qty }`, live-synced products get honest defaults: no rating/reviews shown (StockySaver has none), a single "Store Items" category (StockySaver has none — see `js/products.js` if you later add a `category` field to your Firebase rows), and a generic placeholder photo per item (StockySaver has no images). Swap in real photography by editing the `img()` mapping in `mapFirebaseRowToProduct()` inside `js/products.js`, or point it at your own hosted image URLs once you have them.

The admin **Products** and **Inventory** pages show a "Live from StockySaver" badge when this is active, and a manual "↻ Re-sync" button on the Inventory page force-refreshes if needed.

---



Mummy Aka Shop is now wired directly to your **real StockySaver Firebase project** — same Realtime Database, same `businesses/{bizId}/...` structure StockySaver's own `app.js` uses. `js/firebase-config.js` already has your real project credentials filled in.

**One thing left to do:** open `js/firebase-config.js` and set your business code:
```js
export const STORE_BIZ_ID = "STORE";
```
This is already set to `SHOP` — the business code typed into StockySaver's `login.html`. Everything reads/writes under `businesses/SHOP/...`, matching your real POS data.

### How the sync works
- **Stock display** — `fetchProductStock` / `fetchInventory` read `businesses/{bizId}/inventory` live.
- **Checkout validation** — before "placing" an order, the storefront checks each item's real `qty` in StockySaver.
- **Stock deduction** — uses the exact same atomic `runTransaction()` pattern StockySaver's own checkout uses, so a website sale and a till sale happening at the same moment can never oversell the same item.
- **Sales history** — every online order is also written into `businesses/{bizId}/sales`, in the same shape StockySaver's POS writes, so online orders show up in StockySaver's own **Sales History** and **Reports** tabs automatically.
- **Admin panel** — the storefront's own `#/admin/orders` and `#/admin` dashboard now read live from `businesses/{bizId}/sales` too, showing both till sales and web orders side by side (tagged 🏪 Till / 🌐 Web) from any device — not just orders placed on the browser you're viewing from.

### ⚠️ The one manual step: name matching
StockySaver inventory rows only store `{ name, price, qty }` — no SKU, no images, no category. So the storefront matches each of its own products (in `js/products.js`) to a StockySaver row **by exact item name** (case-insensitive, whitespace-trimmed).

- If your real StockySaver item is named exactly the same as the storefront product's `name`, nothing else to do.
- If the names differ (e.g. StockySaver has "Semovita 5kg" but the storefront shows "Golden Penny Semovita 5kg"), add a `firebaseName` override to that product in `products.js`:
  ```js
  { id: "p001", name: "Golden Penny Semovita 5kg", firebaseName: "Semovita 5kg", ... }
  ```
  The sync always prefers `firebaseName` when present.
- **Replace the 18 demo products in `products.js` with your real catalog** before going live — the sample data (Semovita, Peak Milk, etc.) won't match anything in your real StockySaver inventory unless you happen to stock those exact items under those exact names.

### What StockySaver doesn't have (and how the storefront covers it)
- **Product images** — StockySaver has none, so the storefront always uses its own `images` array in `products.js` for display; only price/stock sync live.
- **Categories, ratings, descriptions** — storefront-only fields, unaffected by the sync.
- **Low-stock threshold** — StockySaver hardcodes `LOW_STOCK_THRESHOLD = 5`; mirrored in `firebase-config.js` as `LOW_STOCK_THRESHOLD` so both systems agree on when to warn.

### Security rules
Your existing StockySaver rules likely already allow authenticated reads/writes under `businesses/{bizId}`. Since the storefront runs unauthenticated in a customer's browser, at minimum confirm:
- `businesses/{bizId}/inventory` is publicly **readable** (so stock can display) but not publicly writable.
- `businesses/{bizId}/sales` allows **create/push** from unauthenticated clients (so orders can be logged), but not read/update/delete.
Check these under Firebase Console → Realtime Database → Rules before going live.

---



`index.html` already links a manifest and icons. To finish the PWA conversion:
1. Add real `icon-192.png` / `icon-512.png` files to `assets/`.
2. Register a service worker (`sw.js`) for offline caching of the app shell (`index.html`, `css/*`, `js/*`).
3. Add `navigator.serviceWorker.register('/sw.js')` near the bottom of `js/app.js`.

---

## 📦 Sample data

`js/products.js` ships with 18 realistic Nigerian retail products across 7 categories (Provisions, Beverages, Home & Kitchen, Personal Care, Baby & Kids, Snacks, Frozen Foods) with prices in Naira, ratings, stock levels (including deliberately low/out-of-stock items to exercise the warning states), and placeholder photography.

---

Built for **Mummy Aka Shop** by Michael Web™.
