# RentMate

RentMate is a hackathon MVP for renting furniture, electronics, and everyday essentials without the high upfront cost of buying.

## MVP flow
Browse → Search/Filter → Product Details → Book Rental → My Rentals

AI Rental Assistant is included as a UI-ready feature with a backend endpoint. Add an OpenAI-compatible API key in `server/.env` to enable live AI recommendations.

## Stack
- React + Vite
- Node.js + Express
- MongoDB + Mongoose
- Tailwind-style custom CSS (no Tailwind setup required)
- JWT-ready architecture
- AI endpoint
- Cloudinary-ready image field

## UI and design system
The client uses a single stylesheet, `client/src/styles.css`, built on design tokens
(colour, type, spacing, radius, shadow) defined at the top of the file.

- **Themes:** Light, Dark and System. The switcher is `components/ThemeToggle.jsx`, the logic is in
  `utils/theme.js`, and a small script in `client/index.html` applies the saved theme before first paint.
  Dark colours are the `:root[data-theme="dark"]` block; use tokens (`var(--surface)`, `var(--ink)`) rather than
  hard-coded colours so both themes keep working.
- **Photos:** `components/ProductImage.jsx` shows the item's photo, or a themed category placeholder when an item
  has no photo or the photo fails to load. Listings without a photo are saved with an empty `image`.
- **Bundles:** defined in `data/bundles.js` as keyword "slots" (table, chair, monitor, bed, fridge) and matched
  against the live catalogue, so they work with any product names and prices. "Rent this bundle" goes through
  `/checkout` and creates one booking per item.
- **Extras:** Saved items page (`/saved`), a 404 page, scroll-to-top and per-page titles on navigation.

## Run

### Server
```bash
cd server
npm install
npm run dev
```

### Client
```bash
cd client
npm install
npm run dev
```

Server: http://localhost:5000  
Client: http://localhost:5173

Create `server/.env`:
```env
PORT=5000
MONGO_URI=mongodb://127.0.0.1:27017/rentmate
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini
```

The app falls back to demo data if MongoDB is not connected, so you can start designing and demoing immediately.

## Payments (PayPal Sandbox)

RentMate supports booking payments via the PayPal JavaScript SDK and Orders v2 API in the sandbox environment.

### Environment variables
Add the following to `server/.env`:
```env
PAYPAL_CLIENT_ID=your-sandbox-client-id
PAYPAL_CLIENT_SECRET=your-sandbox-secret
PAYPAL_API=https://api-m.sandbox.paypal.com
PAYPAL_CURRENCY=USD
INR_PER_USD=85
```
- `INR_PER_USD`: Fixed conversion rate (e.g. 85) used as a demo rate to convert INR rental totals into USD for PayPal Sandbox checkout. The charged amount is always computed on the server from `booking.total / INR_PER_USD`.

### Known limitations
- **No automatic refunds:** Cancelling a paid booking is permitted by the system, but does not initiate an automatic refund via PayPal. Any refunds must be handled manually out-of-band.
- **No webhooks:** Payment status updates are captured and confirmed synchronously upon buyer approval via the PayPal Orders v2 capture endpoint.
- **Sandbox only:** PayPal transactions run in sandbox mode for demo and testing.
- **Booking date release:** A pending booking older than 30 minutes stops blocking dates for other users.

## Deploy on Render

Deploy RentMate as a single Web Service on Render that serves both the API and the built client:

- **Build Command:**
  ```bash
  npm install --prefix client && npm run build --prefix client && npm install --prefix server
  ```
- **Start Command:**
  ```bash
  npm start --prefix server
  ```

### Environment variables (Names only)
Configure the following environment variables in the Render dashboard:
- `MONGO_URI`
- `JWT_SECRET`
- `NODE_ENV`
- `PAYPAL_CLIENT_ID`
- `PAYPAL_CLIENT_SECRET`
- `PAYPAL_API`
- `PAYPAL_CURRENCY`
- `INR_PER_USD`
- `AI_API_KEY`
- `AI_BASE_URL`
- `AI_MODEL`

> **Note:** Free Render services spin down after 15 minutes of inactivity, so the initial request after sleep may take 30 to 60 seconds.
