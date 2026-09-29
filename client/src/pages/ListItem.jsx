import React, { useState } from "react";
import { Link } from "react-router-dom";
import { MapPin, ArrowRight, CheckCircle2, Star } from "lucide-react";
import ProductImage from "../components/ProductImage.jsx";
import { getLocalListings } from "../utils/storage.js";

function ListItem() {
  const [form, setForm] = useState({
    name: "",
    category: "Furniture",
    price: "",
    location: "Lucknow",
    description: "",
    image: "",
  });

  const [success, setSuccess] = useState(false);

  function updateField(field, value) {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  }

  function handleSubmit(e) {
    e.preventDefault();

    if (!form.name || !form.price || !form.location) {
      return;
    }

    const listing = {
      _id: `local-${Date.now()}`,
      name: form.name,
      category: form.category,
      price: Number(form.price),
      location: form.location,
      description:
        form.description ||
        "User listed rental item available on RentMate.",
      image: form.image.trim(),
      rating: 5,
      deposit: 0,
    };

    const existing = getLocalListings();

    localStorage.setItem(
      "rentmateListings",
      JSON.stringify([listing, ...existing])
    );

    setSuccess(true);

    setForm({
      name: "",
      category: "Furniture",
      price: "",
      location: "Lucknow",
      description: "",
      image: "",
    });
  }

  return (
    <section className="page listing-page">
      <div className="container">
        <header className="page-header">
          <h1>List an item</h1>
          <p>
            Have furniture or electronics you are not using? List it on
            RentMate and let someone else rent it by the month.
          </p>
        </header>

        {success && (
          <div className="alert alert-success listing-success" role="status">
            <CheckCircle2 size={22} aria-hidden="true" />
            <div>
              <strong>Your item is listed</strong>
              <p>It is now visible in the RentMate marketplace.</p>
            </div>
            <Link to="/explore" className="success-link">
              View listings
            </Link>
          </div>
        )}

        <div className="listing-layout">
          <form className="form-card listing-form" onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="item-name">Item name</label>
              <input
                id="item-name"
                value={form.name}
                onChange={(e) => updateField("name", e.target.value)}
                placeholder="e.g. Wooden study table"
                required
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="item-category">Category</label>
                <select
                  id="item-category"
                  value={form.category}
                  onChange={(e) => updateField("category", e.target.value)}
                >
                  <option>Furniture</option>
                  <option>Electronics</option>
                  <option>Home Essentials</option>
                  <option>Work & Study</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="item-price">Monthly rent</label>
                <div className="input-with-prefix">
                  <span aria-hidden="true">₹</span>
                  <input
                    id="item-price"
                    type="number"
                    min="1"
                    inputMode="numeric"
                    value={form.price}
                    onChange={(e) => updateField("price", e.target.value)}
                    placeholder="999"
                    required
                  />
                </div>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="item-location">Location</label>
              <div className="input-with-icon">
                <MapPin size={18} aria-hidden="true" />
                <input
                  id="item-location"
                  value={form.location}
                  onChange={(e) => updateField("location", e.target.value)}
                  placeholder="Lucknow"
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="item-image">
                Image URL <span className="optional">Optional</span>
              </label>
              <input
                id="item-image"
                inputMode="url"
                value={form.image}
                onChange={(e) => updateField("image", e.target.value)}
                placeholder="https://..."
              />
              <small className="input-hint">
                A clear photo in good light helps your item get rented faster.
              </small>
            </div>

            <div className="form-group">
              <label htmlFor="item-description">
                Description <span className="optional">Optional</span>
              </label>
              <textarea
                id="item-description"
                rows="5"
                value={form.description}
                onChange={(e) => updateField("description", e.target.value)}
                placeholder="Condition, size, age and anything a renter should know"
              />
            </div>

            <button type="submit" className="btn btn-primary btn-lg listing-submit">
              Publish listing
              <ArrowRight size={18} aria-hidden="true" />
            </button>
          </form>

          <aside className="listing-preview" aria-label="Listing preview">
            <h2>Preview</h2>
            <article className="product-card">
              <div className="product-image-wrap">
                <ProductImage
                  product={{ image: form.image, category: form.category }}
                  alt=""
                />
              </div>
              <div className="product-body">
                <div className="product-topline">
                  <span className="product-category">{form.category}</span>
                  <span className="product-rating">
                    <Star size={14} fill="currentColor" aria-hidden="true" /> New
                  </span>
                </div>
                <h3>{form.name || "Your item name"}</h3>
                <div className="product-location">
                  <MapPin size={14} aria-hidden="true" />
                  {form.location || "Location"}
                </div>
                <div className="product-bottom">
                  <div className="product-price">
                    <strong>₹{form.price ? Number(form.price).toLocaleString("en-IN") : "0"}</strong>
                    <span>/month</span>
                  </div>
                </div>
              </div>
            </article>
            <p className="muted-copy">This is how renters will see your listing in search results.</p>
          </aside>
        </div>
      </div>
    </section>
  );
}

export default ListItem;
