import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Heart } from "lucide-react";
import { getLocalListings, getWishlist } from "../utils/storage.js";
import { api } from "../utils/api.js";
import ProductGrid, { ProductGridSkeleton } from "../components/ProductGrid.jsx";

function Saved() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [savedIds, setSavedIds] = useState(getWishlist);

  const loadProducts = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get("/products");
      setProducts([
        ...(Array.isArray(data) ? data : []),
        ...getLocalListings(),
      ]);
    } catch (err) {
      setError(err.message || "Failed to load products");
      setProducts(getLocalListings());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, []);

  const saved = useMemo(
    () => products.filter((p) => p && savedIds.includes(String(p._id || p.id))),
    [products, savedIds],
  );

  return (
    <section className="page">
      <div className="container">
        <header className="page-header">
          <h1>Saved items</h1>
          <p>Rentals you have saved with the heart button, kept on this device.</p>
        </header>

        {loading ? (
          <ProductGridSkeleton count={4} />
        ) : error && !saved.length ? (
          <div className="empty-state">
            <h3>Failed to load saved rentals</h3>
            <p>{error}</p>
            <button type="button" className="btn btn-primary" onClick={loadProducts}>
              Retry
            </button>
          </div>
        ) : saved.length ? (
          <ProductGrid products={saved} onWishlistChange={setSavedIds} />
        ) : (
          <div className="empty-state">
            <div className="empty-icon">
              <Heart size={28} aria-hidden="true" />
            </div>
            <h3>Nothing saved yet</h3>
            <p>Tap the heart on any rental to keep it here for later.</p>
            <Link to="/explore" className="btn btn-primary">
              Browse rentals <ArrowRight size={18} aria-hidden="true" />
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}

export default Saved;
