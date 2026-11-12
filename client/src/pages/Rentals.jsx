import React, { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  MapPin,
  ArrowRight,
  Package,
  CalendarClock,
  X,
} from "lucide-react";
import { api } from "../utils/api.js";
import { useAuth } from "../context/AuthContext.jsx";
import ProductImage from "../components/ProductImage.jsx";

function Rentals() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [cancellingId, setCancellingId] = useState(null);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/login", { replace: true, state: { from: "/rentals" } });
    }
  }, [user, authLoading, navigate]);

  const loadBookings = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api.get("/bookings");
      setBookings(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || "Failed to load rentals");
      setBookings([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      loadBookings();
    }
  }, [user, loadBookings]);

  async function handleCancel(id) {
    const ok = window.confirm("Are you sure you want to cancel this booking?");
    if (!ok) return;

    setCancellingId(id);
    try {
      await api.patch(`/bookings/${id}/cancel`);
      await loadBookings();
    } catch (err) {
      alert(err.message || "Failed to cancel booking");
    } finally {
      setCancellingId(null);
    }
  }

  const money = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

  if (authLoading || (loading && !bookings.length && !error)) {
    return (
      <div className="page-loading" role="status">
        <div className="loader" />
        <p>Loading your rentals...</p>
      </div>
    );
  }

  if (error) {
    return (
      <section className="page rentals-page">
        <div className="container">
          <div className="empty-page">
            <h2>Failed to load rentals</h2>
            <p>{error}</p>
            <button type="button" className="btn btn-primary" onClick={loadBookings}>
              Retry
            </button>
          </div>
        </div>
      </section>
    );
  }

  if (!bookings.length) {
    return (
      <section className="page rentals-page">
        <div className="container">
          <div className="empty-page">
            <div className="empty-icon">
              <Package size={28} aria-hidden="true" />
            </div>
            <h1>No rentals yet</h1>
            <p>Your active and past rentals will show up here once you book something.</p>
            <Link to="/explore" className="btn btn-primary">
              Browse rentals <ArrowRight size={18} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>
    );
  }

  const active = bookings.filter((b) => b.status === "active");
  const past = bookings.filter((b) => b.status !== "active");

  return (
    <section className="page rentals-page">
      <div className="container">
        <header className="page-header page-header-row">
          <div>
            <h1>My rentals</h1>
            <p>Track active rentals, dates and manage your bookings.</p>
          </div>
          <Link to="/explore" className="btn btn-primary">
            Rent something <ArrowRight size={18} aria-hidden="true" />
          </Link>
        </header>

        <div className="rental-stats">
          <div>
            <strong>{active.length}</strong>
            <span>Active rentals</span>
          </div>
          <div>
            <strong>{past.length}</strong>
            <span>Past / Cancelled</span>
          </div>
          <div>
            <strong>
              {money(active.reduce((s, b) => s + Number(b.monthlyRent || 0), 0))}
            </strong>
            <span>Monthly spend</span>
          </div>
        </div>

        <div className="rentals-grid">
          {bookings.map((booking) => {
            const isInactive = booking.status !== "active";
            const product = booking.product || {};
            const productName = product.name || "Rental item";
            const location = product.location || "Lucknow";

            return (
              <article
                className={`rental-card ${isInactive ? "rental-returned" : ""}`}
                key={booking._id}
              >
                <div className="rental-image">
                  <ProductImage product={product} alt="" compact loading="lazy" />
                </div>
                <div className="rental-content">
                  <div className="rental-top">
                    <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                      <span className={`status-badge ${booking.status}`}>
                        {booking.status}
                      </span>
                      <span className={`payment-badge ${booking.paymentStatus}`}>
                        {booking.paymentStatus}
                      </span>
                    </div>
                    <span className="rental-location">
                      <MapPin size={14} aria-hidden="true" />
                      {location}
                    </span>
                  </div>

                  <h2>{productName}</h2>

                  <dl className="rental-details">
                    <div>
                      <dt>Monthly rent</dt>
                      <dd>{money(booking.monthlyRent)}</dd>
                    </div>
                    <div>
                      <dt>Duration</dt>
                      <dd>{booking.months} mo</dd>
                    </div>
                    <div>
                      <dt>Total</dt>
                      <dd>{money(booking.total)}</dd>
                    </div>
                  </dl>

                  <div className="rental-footer">
                    <span>
                      <CalendarClock size={14} aria-hidden="true" />{" "}
                      {booking.startDate
                        ? `${new Date(booking.startDate).toLocaleDateString("en-IN")} - ${new Date(booking.endDate).toLocaleDateString("en-IN")}`
                        : "Scheduled"}
                    </span>

                    {booking.status === "active" ? (
                      <div className="rental-actions">
                        <button
                          type="button"
                          onClick={() => handleCancel(booking._id)}
                          disabled={cancellingId === booking._id}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                            cursor: cancellingId === booking._id ? "not-allowed" : "pointer",
                            color: "var(--danger, #dc2626)",
                          }}
                        >
                          <X size={14} aria-hidden="true" />
                          {cancellingId === booking._id ? "Cancelling..." : "Cancel booking"}
                        </button>
                      </div>
                    ) : (
                      <span className="returned-date" style={{ textTransform: "capitalize" }}>
                        {booking.status}
                      </span>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export default Rentals;
