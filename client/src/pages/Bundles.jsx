import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AlertCircle, ArrowRight, Check, Package, Sparkles } from "lucide-react";
import { API } from "../utils/config.js";
import fallbackProducts from "../data/fallbackProducts.js";
import { getLocalListings } from "../utils/storage.js";
import { rentalBundles, matchSlot } from "../data/bundles.js";
import BundleIcon from "../components/BundleIcon.jsx";

const DURATIONS = [1, 3, 6, 12];
const inr = (n) => `₹${Number(n).toLocaleString("en-IN")}`;

function Bundles() {
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [months, setMonths] = useState({});
  const startDate = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

  useEffect(() => {
    async function load() {
      try {
        const response = await fetch(`${API}/products`);
        const data = response.ok ? await response.json() : [];
        setProducts([
          ...(Array.isArray(data) && data.length ? data : fallbackProducts),
          ...getLocalListings(),
        ]);
      } catch {
        setProducts([...fallbackProducts, ...getLocalListings()]);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const bundleData = useMemo(
    () =>
      rentalBundles.map((bundle) => {
        const items = bundle.slots.map((slotDef) => ({
          label: slotDef.label,
          product: matchSlot(slotDef, products),
        }));
        const found = items.filter((i) => i.product);
        return {
          ...bundle,
          items,
          missing: items.length - found.length,
          rent: found.reduce((sum, i) => sum + Number(i.product.price || 0), 0),
          deposit: found.reduce((sum, i) => sum + Number(i.product.deposit || 0), 0),
        };
      }),
    [products],
  );

  function rentBundle(bundle) {
    const term = months[bundle.id] || 1;
    const delivery = new Date(`${startDate}T10:00:00`);
    delivery.setDate(delivery.getDate() + 2);

    navigate("/checkout", {
      state: {
        bundle: { id: bundle.id, name: bundle.name },
        items: bundle.items.filter((i) => i.product).map((i) => i.product),
        months: term,
        startDate: new Date(`${startDate}T10:00:00`).toISOString(),
        deliveryDate: delivery.toISOString(),
        delivery: 0,
      },
    });
  }

  return (
    <section className="page bundles-page">
      <div className="container">
        <header className="page-header page-header-row">
          <div>
            <h1>Rental bundles</h1>
            <p>Rent a complete setup in one go instead of shopping item by item.</p>
          </div>
          <Link to="/assistant" className="btn btn-secondary">
            <Sparkles size={18} aria-hidden="true" /> Build one with AI
          </Link>
        </header>

        {loading ? (
          <div className="page-loading" role="status">
            <div className="loader" />
            <p>Loading bundles...</p>
          </div>
        ) : (
          <div className="bundle-grid">
            {bundleData.map((bundle) => {
              const term = months[bundle.id] || 1;
              const canRent = bundle.missing < bundle.items.length;

              return (
                <article className="bundle-card" key={bundle.id}>
                  <span className="bundle-icon">
                    <BundleIcon id={bundle.id} size={24} />
                  </span>
                  <h2>{bundle.name}</h2>
                  <p>{bundle.description}</p>

                  <ul className="bundle-items">
                    {bundle.items.map((item) => {
                      const id = item.product && (item.product._id || item.product.id);
                      return (
                        <li key={item.label} className={item.product ? "" : "bundle-item-missing"}>
                          {item.product ? (
                            <Check size={16} aria-hidden="true" />
                          ) : (
                            <AlertCircle size={16} aria-hidden="true" />
                          )}
                          {item.product ? (
                            <Link to={`/product/${id}`}>{item.product.name}</Link>
                          ) : (
                            <span>{item.label}</span>
                          )}
                          <b>
                            {item.product ? `${inr(item.product.price)}` : "Not listed"}
                          </b>
                        </li>
                      );
                    })}
                  </ul>

                  {bundle.missing > 0 && canRent && (
                    <p className="bundle-warning">
                      {bundle.missing === 1
                        ? "One item isn't listed right now, so it's left out of this bundle."
                        : `${bundle.missing} items aren't listed right now and are left out.`}
                    </p>
                  )}

                  <div className="duration-options" role="group" aria-label={`${bundle.name} duration`}>
                    {DURATIONS.map((value) => (
                      <button
                        type="button"
                        key={value}
                        className={term === value ? "selected" : ""}
                        aria-pressed={term === value}
                        onClick={() => setMonths({ ...months, [bundle.id]: value })}
                      >
                        {value} mo
                      </button>
                    ))}
                  </div>

                  <div className="bundle-total">
                    <span>Monthly total</span>
                    <strong>{inr(bundle.rent)}</strong>
                    <small>
                      {inr(bundle.rent * term)} for {term} month{term > 1 ? "s" : ""} + {inr(bundle.deposit)} deposit
                    </small>
                  </div>

                  <button
                    type="button"
                    className="btn btn-primary bundle-btn"
                    disabled={!canRent}
                    onClick={() => rentBundle(bundle)}
                  >
                    {canRent ? "Rent this bundle" : "Currently unavailable"}
                    {canRent && <ArrowRight size={17} aria-hidden="true" />}
                  </button>
                </article>
              );
            })}
          </div>
        )}

        <p className="bundle-note">
          <Package size={18} aria-hidden="true" /> Bundle prices come from the live catalogue,
          using the lowest-priced matching item for each part of the setup.
        </p>
      </div>
    </section>
  );
}
export default Bundles;
