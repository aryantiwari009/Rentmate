export function getLocalListings() {
  try {
    return JSON.parse(localStorage.getItem("rentmateListings")) || [];
  } catch {
    return [];
  }
}

export function getLocalBookings() {
  try {
    return JSON.parse(localStorage.getItem("rentmateBookings")) || [];
  } catch {
    return [];
  }
}

export function saveLocalBookings(bookings) {
  localStorage.setItem("rentmateBookings", JSON.stringify(bookings));
}

export function getWishlist() {
  try {
    return JSON.parse(localStorage.getItem("rentmateLikes")) || [];
  } catch {
    return [];
  }
}

export function saveWishlist(items) {
  localStorage.setItem("rentmateLikes", JSON.stringify(items));
}

// The old built-in default photo (a sofa). Listings saved with it before the
// placeholder existed are treated as having no photo.
const LEGACY_DEFAULT_IMAGE = "photo-1555041469-a586c61ea9bc";

export function getImage(product) {
  const image = typeof product?.image === "string" ? product.image.trim() : "";
  return image && !image.includes(LEGACY_DEFAULT_IMAGE) ? image : "";
}


export function saveReviews(reviews) { localStorage.setItem("rentmateReviews", JSON.stringify(reviews)); }
export function getReviews(productId) {
  try { const all = JSON.parse(localStorage.getItem("rentmateReviews")) || {}; return all[String(productId)] || []; } catch { return []; }
}
export function addReview(productId, review) {
  try { const all = JSON.parse(localStorage.getItem("rentmateReviews")) || {}; const key = String(productId); all[key] = [review, ...(all[key] || [])]; localStorage.setItem("rentmateReviews", JSON.stringify(all)); } catch {}
}