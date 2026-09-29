import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Heart, MapPin, Package, Star } from "lucide-react";
import { getWishlist, saveWishlist } from "../utils/storage.js";
import ProductImage from "./ProductImage.jsx";

export function ProductGridSkeleton({ count = 4 }) {
  return (
    <div className="product-grid" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <div className="product-card skeleton-card" key={i}>
          <div className="product-image-wrap skeleton" />
          <div className="product-body">
            <div className="skeleton skeleton-line short" />
            <div className="skeleton skeleton-line" />
            <div className="skeleton skeleton-line medium" />
          </div>
        </div>
      ))}
    </div>
  );
}

function ProductGrid({ products, onClear, onWishlistChange }) {
  const [wishlist, setWishlist] = useState(getWishlist());

  const toggleWishlist = (id) => {
    let updated;

    if (wishlist.includes(id)) {
      updated = wishlist.filter((item) => item !== id);
    } else {
      updated = [...wishlist, id];
    }

    setWishlist(updated);
    saveWishlist(updated);
    if (onWishlistChange) onWishlistChange(updated);
  };

  if (!products || products.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-icon">
          <Package size={28} aria-hidden="true" />
        </div>
        <h3>No rentals match your search</h3>
        <p>Try a different keyword, pick another category or raise your budget.</p>
        {onClear && (
          <button type="button" className="btn btn-secondary" onClick={onClear}>
            Clear filters
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="product-grid">
      {products.map((product) => {
        const id = product._id || product.id;
        const liked = wishlist.includes(id);
        const unavailable = product.available === false;
        const deposit = Number(product.deposit || 0);

        return (
          <article className="product-card" key={id}>
            <div className="product-image-wrap">
              <Link
                to={`/product/${id}`}
                tabIndex={-1}
                aria-hidden="true"
                className="product-image-link"
              >
                <ProductImage product={product} alt="" loading="lazy" />
              </Link>

              {String(id).startsWith("local-") && (
                <span className="product-badge">Community listing</span>
              )}
              {unavailable && (
                <span className="product-badge product-badge-muted">
                  Unavailable
                </span>
              )}

              <button
                type="button"
                className={`wishlist-btn ${liked ? "liked" : ""}`}
                onClick={() => toggleWishlist(id)}
                aria-label={
                  liked
                    ? `Remove ${product.name} from saved items`
                    : `Save ${product.name}`
                }
                aria-pressed={liked}
              >
                <Heart size={18} fill={liked ? "currentColor" : "none"} />
              </button>
            </div>

            <div className="product-body">
              <div className="product-topline">
                <span className="product-category">
                  {product.category || "Rental"}
                </span>
                <span className="product-rating">
                  <Star size={14} fill="currentColor" aria-hidden="true" />
                  {product.rating || "4.8"}
                </span>
              </div>

              <h3>
                <Link to={`/product/${id}`}>{product.name}</Link>
              </h3>

              <div className="product-location">
                <MapPin size={14} aria-hidden="true" />
                {product.location || "Lucknow"}
              </div>

              <div className="product-bottom">
                <div className="product-price">
                  <strong>₹{Number(product.price).toLocaleString("en-IN")}</strong>
                  <span>/month</span>
                  {deposit > 0 && (
                    <small>₹{deposit.toLocaleString("en-IN")} deposit</small>
                  )}
                </div>

                <Link to={`/product/${id}`} className="btn btn-secondary btn-sm">
                  View details
                </Link>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}

export default ProductGrid;
