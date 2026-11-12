import React, { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  MapPin,
  ArrowRight,
  Package,
  CalendarClock,
  X,
  AlertTriangle,
  CheckCircle2,
  FileText,
  ExternalLink,
} from "lucide-react";
import { api } from "../utils/api.js";
import { useAuth } from "../context/AuthContext.jsx";
import ProductImage from "../components/ProductImage.jsx";
import PayButton from "../components/PayButton.jsx";

function Rentals() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState(null);
  const [generatingInvoice, setGeneratingInvoice] = useState({});
  const [invoiceError, setInvoiceError] = useState({});

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

  function promptCancel(booking) {
    setCancelTarget(booking);
    setCancelError(null);
  }

  async function confirmCancel() {
    if (!cancelTarget || cancelling) return;
    setCancelling(true);
    setCancelError(null);
    try {
      await api.patch(`/bookings/${cancelTarget._id}/cancel`);
      setCancelTarget(null);
      await loadBookings();
    } catch (err) {
      setCancelError(err.message || "Failed to cancel booking");
    } finally {
      setCancelling(false);
    }
  }

  async function handleGenerateInvoice(bookingId) {
    setGeneratingInvoice((prev) => ({ ...prev, [bookingId]: true }));
    setInvoiceError((prev) => ({ ...prev, [bookingId]: null }));
    try {
      const res = await api.post("/payments/create-invoice", { bookingId });
      if (res.invoiceUrl) {
        window.open(res.invoiceUrl, "_blank", "noopener,noreferrer");
      }
      await loadBookings();
    } catch (err) {
      setInvoiceError((prev) => ({
        ...prev,
        [bookingId]: err.message || "Failed to generate PayPal invoice",
      }));
    } finally {
      setGeneratingInvoice((prev) => ({ ...prev, [bookingId]: false }));
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

                  {booking.status === "active" && booking.paymentStatus === "pending" && (
                    <div style={{ marginTop: "var(--s-3)", marginBottom: "var(--s-2)" }}>
                      <PayButton booking={booking} onSuccess={loadBookings} />
                    </div>
                  )}

                  {booking.paypalInvoiceUrl ? (
                    <div style={{ marginTop: "var(--s-2)", marginBottom: "var(--s-2)" }}>
                      <a
                        href={booking.paypalInvoiceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-secondary btn-sm"
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "5px",
                          fontSize: "0.75rem",
                          padding: "4px 10px",
                        }}
                      >
                        <FileText size={14} aria-hidden="true" />
                        <span>View PayPal Invoice</span>
                        <ExternalLink size={12} aria-hidden="true" />
                      </a>
                    </div>
                  ) : (
                    booking.status === "active" && (
                      <div style={{ marginTop: "var(--s-2)", marginBottom: "var(--s-2)" }}>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          disabled={generatingInvoice[booking._id]}
                          onClick={() => handleGenerateInvoice(booking._id)}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "5px",
                            fontSize: "0.75rem",
                            padding: "4px 10px",
                          }}
                        >
                          <FileText size={14} aria-hidden="true" />
                          <span>
                            {generatingInvoice[booking._id]
                              ? "Creating Invoice..."
                              : "Request PayPal Invoice"}
                          </span>
                        </button>
                      </div>
                    )
                  )}

                  {invoiceError[booking._id] && (
                    <div
                      className="alert alert-error"
                      role="alert"
                      style={{
                        marginTop: "var(--s-2)",
                        marginBottom: "var(--s-2)",
                        fontSize: "0.8125rem",
                        padding: "var(--s-2) var(--s-3)",
                        display: "flex",
                        alignItems: "flex-start",
                        justifyContent: "space-between",
                        gap: "8px",
                        lineHeight: 1.4,
                      }}
                    >
                      <div>
                        <strong style={{ display: "block", marginBottom: "2px" }}>
                          PayPal Invoicing:
                        </strong>
                        <span>{invoiceError[booking._id]}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setInvoiceError((prev) => ({ ...prev, [booking._id]: null }))
                        }
                        style={{
                          background: "transparent",
                          border: "none",
                          cursor: "pointer",
                          padding: "2px",
                          color: "inherit",
                          opacity: 0.7,
                          flexShrink: 0,
                        }}
                        aria-label="Dismiss error"
                      >
                        <X size={14} aria-hidden="true" />
                      </button>
                    </div>
                  )}

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
                          onClick={() => promptCancel(booking)}
                          disabled={cancelling && cancelTarget?._id === booking._id}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                            cursor: "pointer",
                            color: "var(--danger, #dc2626)",
                          }}
                        >
                          <X size={14} aria-hidden="true" />
                          Cancel booking
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

      {cancelTarget && (
        <div
          className="confirm-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="cancel-modal-title"
          onClick={(e) => {
            if (e.target === e.currentTarget && !cancelling) {
              setCancelTarget(null);
              setCancelError(null);
            }
          }}
        >
          <div className="confirm-modal-dialog">
            <div className="confirm-modal-header">
              <div className="confirm-modal-icon" aria-hidden="true">
                <AlertTriangle size={24} />
              </div>
              <h2 id="cancel-modal-title" className="confirm-modal-title">
                Cancel booking?
              </h2>
            </div>

            <p className="confirm-modal-body">
              Are you sure you want to cancel your rental for{" "}
              <strong>{cancelTarget.product?.name || "this item"}</strong>?
              Your reserved dates will be freed for other users.
            </p>

            {cancelTarget.paymentStatus === "paid" ? (
              <div className="confirm-modal-refund-notice">
                <CheckCircle2 size={18} aria-hidden="true" style={{ flexShrink: 0 }} />
                <span>
                  A full automatic refund of <strong>{money(cancelTarget.total)}</strong> will be credited directly to your original payment method.
                </span>
              </div>
            ) : null}

            {cancelError && (
              <div
                className="form-error"
                style={{
                  padding: "var(--s-3)",
                  borderRadius: "var(--r-2)",
                  background: "var(--danger-tint)",
                  color: "var(--danger)",
                  fontSize: "0.875rem",
                }}
              >
                {cancelError}
              </div>
            )}

            <div className="confirm-modal-actions">
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  setCancelTarget(null);
                  setCancelError(null);
                }}
                disabled={cancelling}
              >
                Keep booking
              </button>
              <button
                type="button"
                className="btn btn-sm"
                style={{
                  background: "var(--danger)",
                  color: "#ffffff",
                  borderColor: "var(--danger)",
                }}
                onClick={confirmCancel}
                disabled={cancelling}
              >
                {cancelling
                  ? "Cancelling..."
                  : cancelTarget.paymentStatus === "paid"
                  ? "Cancel & Refund"
                  : "Confirm cancellation"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export default Rentals;
