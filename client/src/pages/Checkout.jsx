import React, { useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, BadgeCheck, CreditCard, ShieldCheck, Star, Truck } from "lucide-react";
import { getLocalBookings, getImage, saveLocalBookings } from "../utils/storage.js";
import { getUser } from "../utils/auth.js";
import ProductImage from "../components/ProductImage.jsx";

const inr = (n) => `₹${Number(n).toLocaleString("en-IN")}`;

function Checkout() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state || {};
  const user = getUser();

  const months = Number(state.months || 1);
  const delivery = Number(state.delivery || 0);
  const isBundle = Array.isArray(state.items) && state.items.length > 0;

  // One line per item: a single product, or every item in a bundle.
  const lines = useMemo(() => {
    if (isBundle) {
      return state.items.map((product) => ({
        product,
        rent: Number(product.price || 0),
        deposit: Number(product.deposit || 0),
      }));
    }
    if (state.product) {
      return [
        {
          product: state.product,
          rent: Number(state.rent || state.product.price || 0),
          deposit: Number(state.deposit || state.product.deposit || 0),
        },
      ];
    }
    return [];
  }, [state, isBundle]);

  const [paying, setPaying] = useState(false);
  const [done, setDone] = useState(false);

  const rent = lines.reduce((sum, l) => sum + l.rent, 0);
  const deposit = lines.reduce((sum, l) => sum + l.deposit, 0);
  const total = rent * months + deposit + delivery;

  if (!lines.length)
    return (
      <section className="page checkout-page">
        <div className="container">
          <div className="empty-page">
            <h2>Checkout session expired</h2>
            <p>Pick an item and dates again to continue.</p>
            <Link to="/explore" className="btn btn-primary">
              Back to Explore
            </Link>
          </div>
        </div>
      </section>
    );

  const title = isBundle ? state.bundle?.name || "Rental bundle" : lines[0].product.name;

  function confirm() {
    setPaying(true);
    setTimeout(() => {
      const stamp = Date.now();
      const bookings = lines.map((line, index) => ({
        ...line.product,
        productId: line.product._id || line.product.id,
        productName: line.product.name,
        monthlyRent: line.rent,
        months,
        deposit: line.deposit,
        total: line.rent * months + line.deposit + (index === 0 ? delivery : 0),
        startDate: state.startDate,
        status: "Active",
        image: getImage(line.product),
        ownerVerified: true,
        deliveryDate: state.deliveryDate,
        bundleName: isBundle ? title : undefined,
        _id: `booking-${stamp}-${index}`,
      }));
      saveLocalBookings([...bookings, ...getLocalBookings()]);
      setPaying(false);
      setDone(true);
    }, 700);
  }

  return (
    <section className="page checkout-page">
      <div className="container checkout-container">
        <button type="button" className="back-btn" onClick={() => navigate(-1)}>
          <ArrowLeft size={17} aria-hidden="true" /> Back
        </button>

        <header className="page-header">
          <h1>{isBundle ? "Confirm your bundle" : "Confirm your rental"}</h1>
          <p>Review dates, deposit and delivery before you confirm.</p>
        </header>

        {done ? (
          <div className="checkout-success" role="status">
            <span className="success-badge">
              <BadgeCheck size={32} aria-hidden="true" />
            </span>
            <h2>{isBundle ? "Bundle confirmed" : "Rental confirmed"}</h2>
            <p>
              {isBundle
                ? `${lines.length} items from ${title} are now in your My Rentals dashboard.`
                : `${title} is now in your My Rentals dashboard.`}
            </p>
            <div className="checkout-actions">
              <Link className="btn btn-primary" to="/rentals">
                View My Rentals
              </Link>
              <Link className="btn btn-secondary" to="/explore">
                Continue browsing
              </Link>
            </div>
          </div>
        ) : (
          <div className="checkout-grid">
            <div className="checkout-main">
              <div className="checkout-card">
                {isBundle && <h3>{title}</h3>}

                {lines.map(({ product, rent: lineRent }) => (
                  <div className="checkout-product" key={product._id || product.id}>
                    <ProductImage product={product} alt="" compact />
                    <div>
                      <span>{product.category}</span>
                      <h2>{product.name}</h2>
                      <p>
                        <Star size={14} fill="currentColor" aria-hidden="true" />{" "}
                        {product.rating || "4.8"} · {product.location || "Local"}
                      </p>
                      {isBundle && <p>{inr(lineRent)} / month</p>}
                    </div>
                  </div>
                ))}

                <dl className="checkout-lines">
                  <div>
                    <dt>Start date</dt>
                    <dd>{new Date(state.startDate).toLocaleDateString("en-IN")}</dd>
                  </div>
                  <div>
                    <dt>Duration</dt>
                    <dd>
                      {months} month{months > 1 ? "s" : ""}
                    </dd>
                  </div>
                  <div>
                    <dt>Delivery</dt>
                    <dd>Estimated in 2 days</dd>
                  </div>
                </dl>
              </div>

              <div className="checkout-card">
                <h3>Payment method</h3>
                <div className="payment-option selected">
                  <CreditCard size={20} aria-hidden="true" />
                  <div>
                    <b>Demo card payment</b>
                    <span>•••• 4242 · No real charge</span>
                  </div>
                  <BadgeCheck size={18} aria-hidden="true" />
                </div>
                <p className="checkout-note">
                  This checkout is a demo. No card details are collected and no payment is taken.
                </p>
              </div>
            </div>

            <aside className="checkout-summary">
              <h3>Price summary</h3>
              <div>
                <span>
                  {inr(rent)} × {months} month{months > 1 ? "s" : ""}
                  {isBundle ? ` (${lines.length} items)` : ""}
                </span>
                <b>{inr(rent * months)}</b>
              </div>
              <div>
                <span>Security deposit</span>
                <b>{inr(deposit)}</b>
              </div>
              <div>
                <span>Delivery</span>
                <b>{delivery ? inr(delivery) : "Included"}</b>
              </div>
              <div className="summary-total">
                <span>Pay today</span>
                <strong>{inr(total)}</strong>
              </div>

              <button
                type="button"
                className="btn btn-primary btn-lg checkout-btn"
                onClick={confirm}
                disabled={paying}
              >
                {paying ? "Confirming..." : `Confirm ${isBundle ? "bundle" : "rental"} · ${inr(total)}`}
              </button>

              <div className="checkout-protection">
                <ShieldCheck size={18} aria-hidden="true" />
                <span>
                  RentMate Protection
                  <small>Verified listing, secure deposit, support</small>
                </span>
              </div>
              <div className="checkout-protection">
                <Truck size={18} aria-hidden="true" />
                <span>
                  Delivery
                  <small>
                    {state.deliveryDate
                      ? new Date(state.deliveryDate).toLocaleDateString("en-IN")
                      : "Scheduled after booking"}
                  </small>
                </span>
              </div>
              {user && <small className="checkout-user">Booking as {user.name}</small>}
            </aside>
          </div>
        )}
      </div>
    </section>
  );
}
export default Checkout;
