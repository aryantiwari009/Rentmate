import React, { useState } from "react";
import { Link } from "react-router-dom";
import {
  MapPin,
  ArrowRight,
  Package,
  CalendarClock,
  RotateCcw,
} from "lucide-react";
import {
  getLocalBookings,
  saveLocalBookings,
} from "../utils/storage.js";
import ProductImage from "../components/ProductImage.jsx";

function Rentals() {
  const [bookings, setBookings] = useState(getLocalBookings());
  function updateBooking(id, patch) {
    const updated = bookings.map((b) =>
      String(b._id) === String(id) ? { ...b, ...patch } : b,
    );
    setBookings(updated);
    saveLocalBookings(updated);
  }
  function extend(id) {
    const booking = bookings.find((b) => String(b._id) === String(id));
    if (!booking) return;
    const months = Number(booking.months || 1) + 1;
    updateBooking(id, {
      months,
      total:
        Number(booking.monthlyRent || 0) * months +
        Number(booking.deposit || 0),
      status: "Active",
    });
  }
  function returnRental(id) {
    updateBooking(id, {
      status: "Returned",
      returnedAt: new Date().toISOString(),
    });
  }
  if (!bookings.length)
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
  const active = bookings.filter((b) => b.status !== "Returned");
  const returned = bookings.filter((b) => b.status === "Returned");
  const money = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;
  return (
    <section className="page rentals-page">
      <div className="container">
        <header className="page-header page-header-row">
          <div>
            <h1>My rentals</h1>
            <p>Track active rentals, extend your term or return an item.</p>
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
            <strong>{returned.length}</strong>
            <span>Returned</span>
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
            const isReturned = booking.status === "Returned";
            return (
              <article
                className={`rental-card ${isReturned ? "rental-returned" : ""}`}
                key={booking._id}
              >
                <div className="rental-image">
                  <ProductImage product={booking} alt="" compact loading="lazy" />
                </div>
                <div className="rental-content">
                  <div className="rental-top">
                    <span className={`status-badge ${isReturned ? "returned" : ""}`}>
                      {booking.status || "Active"}
                    </span>
                    <span className="rental-location">
                      <MapPin size={14} aria-hidden="true" />
                      {booking.location || "Local"}
                    </span>
                  </div>
                  <h2>{booking.productName}</h2>
                  {booking.bundleName && (
                    <span className="rental-bundle">Part of {booking.bundleName}</span>
                  )}
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
                      <CalendarClock size={14} aria-hidden="true" /> Started{" "}
                      {booking.startDate
                        ? new Date(booking.startDate).toLocaleDateString("en-IN")
                        : "recently"}
                    </span>
                    {!isReturned ? (
                      <div className="rental-actions">
                        <button type="button" onClick={() => extend(booking._id)}>
                          <CalendarClock size={14} aria-hidden="true" /> Extend 1 month
                        </button>
                        <button type="button" onClick={() => returnRental(booking._id)}>
                          <RotateCcw size={14} aria-hidden="true" /> Return
                        </button>
                      </div>
                    ) : (
                      <span className="returned-date">Returned</span>
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
