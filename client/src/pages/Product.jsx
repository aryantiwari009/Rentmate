import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  MapPin,
  Star,
  ArrowRight,
  Heart,
  ShieldCheck,
  CalendarDays,
  Package,
  CheckCircle2,
  Truck,
  BadgeCheck,
  ChevronLeft,
} from "lucide-react";
import {
  getLocalListings,
  getLocalBookings,
  saveLocalBookings,
  getWishlist,
  saveWishlist,
} from "../utils/storage.js";
import fallbackProducts from "../data/fallbackProducts.js";
import { API } from "../utils/config.js";
import ProductImage from "../components/ProductImage.jsx";
import { getReviews, addReview } from "../utils/storage.js";

function Product() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [months, setMonths] = useState(1);
  const [startDate, setStartDate] = useState(
    new Date(Date.now() + 86400000).toISOString().slice(0, 10),
  );
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [reviews, setReviews] = useState(() => getReviews(id));
  const [reviewText, setReviewText] = useState("");
  const [reviewRating, setReviewRating] = useState(5);
  const [serverAvailable, setServerAvailable] = useState(null);
  const [liked, setLiked] = useState(() => getWishlist().includes(String(id)));

  useEffect(() => {
    let cancelled = false;
    async function checkAvailability() {
      try {
        const r = await fetch(
          `${API}/availability/${id}?startDate=${encodeURIComponent(startDate)}&months=${months}`,
        );
        if (r.ok) {
          const data = await r.json();
          if (!cancelled) setServerAvailable(data.available !== false);
          return;
        }
      } catch {}
      if (!cancelled) setServerAvailable(null);
    }
    checkAvailability();
    return () => {
      cancelled = true;
    };
  }, [id, startDate, months]);

  useEffect(() => {
    async function loadProduct() {
      setLoading(true);
      const local = getLocalListings().find(
        (i) => String(i._id || i.id) === String(id),
      );
      if (local) {
        setProduct(local);
        setLoading(false);
        return;
      }
      try {
        const r = await fetch(`${API}/products/${id}`);
        if (r.ok) {
          setProduct(await r.json());
          setLoading(false);
          return;
        }
      } catch {}
      const fallback = fallbackProducts.find(
        (i) => String(i._id) === String(id),
      );
      if (fallback) setProduct(fallback);
      setLoading(false);
    }
    loadProduct();
  }, [id]);

  if (loading)
    return (
      <div className="page-loading" role="status">
        <div className="loader" />
        <p>Loading rental...</p>
      </div>
    );
  if (!product)
    return (
      <div className="container">
        <div className="empty-page">
          <div className="empty-icon">
            <Package size={28} aria-hidden="true" />
          </div>
          <h2>Rental not found</h2>
          <p>This item may have been removed or is no longer available.</p>
          <Link to="/explore" className="btn btn-primary">
            Back to Explore
          </Link>
        </div>
      </div>
    );

  const deposit = Number(product.deposit || 0);
  const rent = Number(product.price || 0);
  const total = rent * months + deposit;
  const purchaseEstimate = Math.round(rent * 14);
  const savings = Math.max(0, purchaseEstimate - (rent * months + deposit));
  const selectedStart = new Date(`${startDate}T00:00:00`);
  const selectedEnd = new Date(selectedStart);
  selectedEnd.setMonth(selectedEnd.getMonth() + months);
  const overlapping = getLocalBookings().some(
    (b) =>
      String(b.productId) === String(product._id || product.id) &&
      b.status !== "Returned" &&
      (() => {
        const bs = new Date(b.startDate);
        const be = new Date(bs);
        be.setMonth(be.getMonth() + Number(b.months || 1));
        return selectedStart < be && selectedEnd > bs;
      })(),
  );
  const available =
    product.available !== false && !overlapping && serverAvailable !== false;
  const deliveryDate = new Date(selectedStart);
  deliveryDate.setDate(deliveryDate.getDate() + 2);

  function toggleWishlist() {
    const key = String(product._id || product.id);
    const next = liked
      ? getWishlist().filter((x) => String(x) !== key)
      : [...getWishlist(), key];
    saveWishlist(next);
    setLiked(!liked);
  }
  function handleBooking() {
    if (!available) return;
    setBooking(true);
    setError("");
    navigate("/checkout", {
      state: {
        product,
        months,
        rent,
        deposit,
        startDate: new Date(`${startDate}T10:00:00`).toISOString(),
        deliveryDate: deliveryDate.toISOString(),
        delivery: 0,
      },
    });
    setBooking(false);
  }

  function submitReview(e) {
    e.preventDefault();
    if (!reviewText.trim()) return;
    const review = {
      id: Date.now(),
      rating: reviewRating,
      text: reviewText.trim(),
      author: "You",
      date: new Date().toISOString(),
    };
    addReview(product._id || product.id, review);
    setReviews([review, ...reviews]);
    setReviewText("");
  }

  const stars = (n) =>
    Array.from({ length: 5 }).map((_, i) => (
      <Star
        key={i}
        size={15}
        aria-hidden="true"
        fill={i < n ? "currentColor" : "none"}
      />
    ));

  return (
    <section className="page product-detail-page">
      <div className="container">
        <button type="button" className="back-btn" onClick={() => navigate(-1)}>
          <ChevronLeft size={18} aria-hidden="true" /> Back
        </button>

        <div className="detail-layout">
          <div className="detail-main">
            <div className="detail-image">
              <ProductImage product={product} alt={product.name} />
              <button
                type="button"
                className={`detail-wishlist ${liked ? "liked" : ""}`}
                onClick={toggleWishlist}
                aria-label={liked ? "Remove from saved items" : "Save this item"}
                aria-pressed={liked}
              >
                <Heart size={20} fill={liked ? "currentColor" : "none"} />
              </button>
            </div>

            <div className="detail-panel">
              <h2>About this item</h2>
              <p className="detail-description">
                {product.description ||
                  "A quality rental item available through RentMate."}
              </p>

              <ul className="trust-row">
                <li>
                  <ShieldCheck size={19} aria-hidden="true" />
                  <span>Verified listing</span>
                </li>
                <li>
                  <CalendarDays size={19} aria-hidden="true" />
                  <span>Flexible duration</span>
                </li>
                <li>
                  <Truck size={19} aria-hidden="true" />
                  <span>Local delivery</span>
                </li>
              </ul>
            </div>

            <div className="detail-panel seller-trust">
              <div className="seller-avatar" aria-hidden="true">R</div>
              <div>
                <strong>RentMate Verified Owner</strong>
                <span>
                  <BadgeCheck size={14} aria-hidden="true" /> Identity and listing checked · 98% successful rentals
                </span>
              </div>
              <span className="seller-rating">
                <Star size={14} fill="currentColor" aria-hidden="true" /> 4.9
              </span>
            </div>

            <div className="detail-panel reviews-section">
              <div className="section-heading-inline">
                <h2>Reviews</h2>
                <span className="review-average">
                  <Star size={16} fill="currentColor" aria-hidden="true" />{" "}
                  {product.rating || "4.8"}
                </span>
              </div>

              {reviews.length ? (
                <div className="review-list">
                  {reviews.slice(0, 4).map((r) => (
                    <div className="review-item" key={r.id}>
                      <div
                        className="review-stars"
                        role="img"
                        aria-label={`${Number(r.rating || 5)} out of 5 stars`}
                      >
                        {stars(Number(r.rating || 5))}
                      </div>
                      <p>{r.text}</p>
                      <span>
                        {r.author} · {new Date(r.date).toLocaleDateString("en-IN")}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="muted-copy">
                  No reviews yet. Reviews open up after your rental.
                </p>
              )}

              <form className="review-form" onSubmit={submitReview}>
                <div className="review-rating-buttons" role="group" aria-label="Your rating">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      type="button"
                      key={n}
                      className={n <= reviewRating ? "selected" : ""}
                      onClick={() => setReviewRating(n)}
                      aria-label={`${n} star${n > 1 ? "s" : ""}`}
                      aria-pressed={n <= reviewRating}
                    >
                      <Star size={20} fill={n <= reviewRating ? "currentColor" : "none"} aria-hidden="true" />
                    </button>
                  ))}
                </div>
                <textarea
                  value={reviewText}
                  onChange={(e) => setReviewText(e.target.value)}
                  placeholder="What should another renter know?"
                  aria-label="Write a review"
                  rows={3}
                />
                <button className="btn btn-secondary" type="submit">
                  Post review
                </button>
              </form>
            </div>
          </div>

          <aside className="detail-content booking-card">
            <span className="detail-category">{product.category || "Rental"}</span>
            <h1>{product.name}</h1>
            <div className="detail-meta">
              <span>
                <Star size={16} fill="currentColor" aria-hidden="true" />
                {product.rating || "4.8"} rating
              </span>
              <span>
                <MapPin size={16} aria-hidden="true" />
                {product.location || "Lucknow"}
              </span>
            </div>

            <div className="price-large">
              ₹{rent.toLocaleString("en-IN")}
              <span>/ month</span>
            </div>

            <div
              className={`availability-card ${available ? "available" : "unavailable"}`}
              role="status"
            >
              {available ? (
                <CheckCircle2 size={20} aria-hidden="true" />
              ) : (
                <Package size={20} aria-hidden="true" />
              )}
              <div>
                <strong>
                  {available ? "Available for your dates" : "Unavailable for these dates"}
                </strong>
                <span>
                  {available
                    ? "Ready to reserve"
                    : "Choose another start date or duration"}
                </span>
              </div>
            </div>

            {!done ? (
              <>
                <div className="duration-section">
                  <label htmlFor="start-date">
                    <CalendarDays size={16} aria-hidden="true" /> Start date and duration
                  </label>
                  <div className="date-duration-row">
                    <input
                      id="start-date"
                      type="date"
                      min={new Date().toISOString().slice(0, 10)}
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                    />
                    <div className="duration-options" role="group" aria-label="Rental duration">
                      {[1, 3, 6, 12].map((value) => (
                        <button
                          type="button"
                          key={value}
                          className={months === value ? "selected" : ""}
                          aria-pressed={months === value}
                          onClick={() => setMonths(value)}
                        >
                          {value} mo
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="delivery-card">
                  <Truck size={20} aria-hidden="true" />
                  <div>
                    <strong>Estimated delivery</strong>
                    <span>
                      {deliveryDate.toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                      })}{" "}
                      · {product.location || "Local area"}
                    </span>
                  </div>
                </div>

                <dl className="bookingSummary">
                  <div>
                    <dt>Monthly rent</dt>
                    <dd>₹{rent.toLocaleString("en-IN")}</dd>
                  </div>
                  <div>
                    <dt>Duration</dt>
                    <dd>
                      {months} month{months > 1 ? "s" : ""}
                    </dd>
                  </div>
                  <div>
                    <dt>Security deposit</dt>
                    <dd>₹{deposit.toLocaleString("en-IN")}</dd>
                  </div>
                  <div>
                    <dt>Delivery</dt>
                    <dd>Included</dd>
                  </div>
                  <div className="summaryTotal">
                    <dt>Total at booking</dt>
                    <dd>₹{total.toLocaleString("en-IN")}</dd>
                  </div>
                </dl>

                <div className="buy-vs-rent">
                  <div>
                    <span>Buying estimate</span>
                    <b>₹{purchaseEstimate.toLocaleString("en-IN")}</b>
                  </div>
                  <div>
                    <span>Rental + deposit</span>
                    <b>₹{(rent * months + deposit).toLocaleString("en-IN")}</b>
                  </div>
                  <strong>
                    {savings > 0
                      ? `Potential cash saving: ₹${savings.toLocaleString("en-IN")}`
                      : "Flexible ownership-free option"}
                  </strong>
                </div>

                <div className="product-action-row">
                  <button
                    type="button"
                    className="btn btn-primary btn-lg book-btn"
                    onClick={handleBooking}
                    disabled={booking || !available}
                  >
                    {booking
                      ? "Opening checkout..."
                      : available
                        ? "Rent this item"
                        : "Choose available dates"}

                    {!booking && available && <ArrowRight size={18} aria-hidden="true" />}
                  </button>
                </div>
                {error && (
                  <p className="alert alert-error" role="alert">
                    {error}
                  </p>
                )}
              </>
            ) : (
              <div className="alert alert-success bookingSuccess">
                <CheckCircle2 size={22} aria-hidden="true" />
                <div>
                  <strong>Booking confirmed</strong>
                  <p>Your {product.name} rental has been added to My Rentals.</p>
                </div>
                <Link to="/rentals" className="success-link">
                  View rental
                </Link>
              </div>
            )}
          </aside>
        </div>
      </div>
    </section>
  );
}
export default Product;
