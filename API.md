# StockySaver Integration — API Contract

This document describes the REST endpoints `js/stockysaver-api.js` expects once you set `USE_MOCK = false` there (or, if you're using Firebase instead, see the **Firebase** section in the main `README.md` — this file's REST contract still applies conceptually to what fields live on each record).

All requests are sent with:
```
Authorization: Bearer {CONFIG.apiKey}
X-Store-Id: {CONFIG.storeId}
Content-Type: application/json
```

Base URL is `CONFIG.baseUrl` (set in `js/stockysaver-api.js`), e.g. `https://api.stockysaver.com/v1`.

---

## `GET /stores/{storeId}/inventory`
Returns live stock + price for every product.

**Response 200**
```json
[
  { "productId": "p001", "stock": 34, "price": 6800, "lowStockThreshold": 8 }
]
```

## `GET /stores/{storeId}/inventory/{productId}`
Returns live stock + price for a single product (used on the product detail page).

**Response 200**
```json
{ "productId": "p001", "stock": 34, "price": 6800, "lowStockThreshold": 8 }
```
**Response 404** if the product isn't found in StockySaver.

## `POST /stores/{storeId}/orders/validate`
Pre-checkout validation — confirms every cart line is still available at the requested quantity.

**Request**
```json
{ "lines": [{ "productId": "p001", "quantity": 2 }] }
```
**Response 200**
```json
{
  "valid": false,
  "issues": [
    { "productId": "p001", "reason": "insufficient_stock", "available": 1 }
  ]
}
```
`reason` is one of: `not_found`, `insufficient_stock`.

## `POST /stores/{storeId}/orders`
Saves the order and atomically decrements inventory for each line.

**Request**
```json
{
  "customer": { "name": "Ngozi A.", "phone": "0801 234 5678", "email": "ngozi@example.com" },
  "fulfillment": { "method": "delivery", "address": "12 Aso Drive, Abuja", "notes": null },
  "payment": { "method": "card" },
  "lines": [{ "productId": "p001", "name": "Golden Penny Semovita 5kg", "quantity": 1, "unitPrice": 6800 }],
  "totals": { "subtotal": 6800, "delivery": 1500, "total": 8300 }
}
```
**Response 201**
```json
{
  "orderNumber": "MAS-20260718-4471",
  "status": "confirmed",
  "createdAt": "2026-07-18T10:32:00.000Z",
  "customer": { "...": "..." },
  "fulfillment": { "...": "..." },
  "lines": [ "..." ],
  "totals": { "...": "..." }
}
```
**Response 409** if stock changed between validation and submission (the front end will surface this as "Some items changed availability since you added them to cart.").

## `GET /stores/{storeId}/products/{productId}/media`
Returns canonical images + price for a product, used to keep storefront display data in sync with the POS catalog.

**Response 200**
```json
{ "images": ["https://.../a.jpg", "https://.../b.jpg"], "price": 6800 }
```

## `GET /health`
Lightweight connectivity check polled by the admin dashboard.

**Response 200**
```json
{ "status": "ok" }
```

---

## Error handling

Every method in `js/stockysaver-api.js` that fails a request throws a `StockySaverError` (message + HTTP status). UI code never lets a raw error reach the customer — it's always caught via the `withGracefulSync()` helper, which shows a toast and falls back to cached/local data so a StockySaver outage degrades gracefully instead of breaking checkout.

## Where to plug in your real values

Open `js/stockysaver-api.js` and edit the top of the file:
```js
const CONFIG = {
  baseUrl: "https://api.stockysaver.com/v1", // ← your real base URL
  apiKey: "REPLACE_WITH_STOCKYSAVER_API_KEY", // ← inject server-side in production
  storeId: "mummy-aka-shop",
  timeoutMs: 8000,
};
const USE_MOCK = true; // ← set to false
```
