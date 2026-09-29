import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Heart } from "lucide-react";
import { getLocalListings, getWishlist } from "../utils/storage.js";
import fallbackProducts from "../data/fallbackProducts.js";
import { API } from "../utils/config.js";
import ProductGrid, { ProductGridSkeleton } from "../components/ProductGrid.jsx";

function Saved() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savedIds, setSavedIds] = useState(getWishlist);

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

  const saved = useMemo(
    () => products.filter((p) => savedIds.includes(p._id || p.id)),
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
