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
