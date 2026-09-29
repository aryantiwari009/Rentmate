import React, { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { Search, X } from "lucide-react";
import { getLocalListings } from "../utils/storage.js";
import fallbackProducts from "../data/fallbackProducts.js";
import { API } from "../utils/config.js";
import ProductGrid, { ProductGridSkeleton } from "../components/ProductGrid.jsx";

const CATEGORIES = ["Furniture", "Electronics", "Home Essentials", "Work & Study"];

function Explore() {
  const location = useLocation();

  const params = new URLSearchParams(location.search);

  const initialQuery = params.get("q") || "";
  const initialCategory = params.get("category") || "";

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState(initialQuery);
  const [category, setCategory] = useState(initialCategory);
  const [maxPrice, setMaxPrice] = useState("");
  const [sort, setSort] = useState("recommended");

  useEffect(() => {
    setQuery(initialQuery);
    setCategory(initialCategory);
  }, [initialQuery, initialCategory]);

  useEffect(() => {
    async function loadProducts() {
      try {
        const response = await fetch(`${API}/products`);

        if (!response.ok) {
          throw new Error();
        }

        const data = await response.json();

        if (Array.isArray(data) && data.length) {
          setProducts([...data, ...getLocalListings()]);
        } else {
          setProducts([...fallbackProducts, ...getLocalListings()]);
        }
      } catch {
        setProducts([...fallbackProducts, ...getLocalListings()]);
      } finally {
        setLoading(false);
      }
    }

    loadProducts();
  }, []);

  const filteredProducts = useMemo(() => {
    const list = products.filter((product) => {
      const search = query.toLowerCase().trim();

      const searchableText = `
        ${product.name || ""}
        ${product.category || ""}
        ${product.location || ""}
        ${product.description || ""}
      `.toLowerCase();

      const matchesSearch = !search || searchableText.includes(search);

      const matchesCategory =
        !category ||
        product.category?.toLowerCase() === category.toLowerCase();

      const matchesPrice =
        !maxPrice || Number(product.price) <= Number(maxPrice);

      return matchesSearch && matchesCategory && matchesPrice;
    });

    if (sort === "price-asc") return [...list].sort((a, b) => a.price - b.price);
    if (sort === "price-desc") return [...list].sort((a, b) => b.price - a.price);
    if (sort === "rating")
      return [...list].sort((a, b) => Number(b.rating || 0) - Number(a.rating || 0));
    return list;
  }, [products, query, category, maxPrice, sort]);

  const clearFilters = () => {
    setQuery("");
    setCategory("");
    setMaxPrice("");
  };

  const hasFilters = Boolean(query || category || maxPrice);

  return (
    <section className="page explore-page">
      <div className="container">
        <header className="page-header">
          <h1>Explore rentals</h1>
          <p>Furniture, electronics and everyday essentials, available by the month.</p>
        </header>

        <div className="filters-panel">
          <div className="search-box">
            <Search size={19} aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search chair, bed, monitor..."
              aria-label="Search rentals"
            />
          </div>

          <div className="filter-row">
            <label className="field-inline">
              <span>Max rent</span>
              <span className="price-input">
                <span aria-hidden="true">₹</span>
                <input
                  type="number"
                  min="0"
                  inputMode="numeric"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                  placeholder="Any"
                  aria-label="Maximum monthly rent in rupees"
                />
              </span>
            </label>

            <label className="field-inline">
              <span>Sort by</span>
              <select value={sort} onChange={(e) => setSort(e.target.value)}>
                <option value="recommended">Recommended</option>
                <option value="price-asc">Price: low to high</option>
                <option value="price-desc">Price: high to low</option>
                <option value="rating">Top rated</option>
              </select>
            </label>
          </div>
        </div>

        <div className="chip-row" role="group" aria-label="Filter by category">
          <button
            type="button"
            className={`chip ${category === "" ? "selected" : ""}`}
            aria-pressed={category === ""}
            onClick={() => setCategory("")}
          >
            All
          </button>
          {CATEGORIES.map((name) => (
            <button
              type="button"
              key={name}
              className={`chip ${category.toLowerCase() === name.toLowerCase() ? "selected" : ""}`}
              aria-pressed={category.toLowerCase() === name.toLowerCase()}
              onClick={() => setCategory(name)}
            >
              {name}
            </button>
          ))}
        </div>

        <div className="results-header" aria-live="polite">
          <p>
            {loading ? (
              "Loading rentals..."
            ) : (
              <>
                <strong>{filteredProducts.length}</strong>{" "}
                {filteredProducts.length === 1 ? "rental" : "rentals"} found
              </>
            )}
          </p>

          {hasFilters && (
            <button type="button" className="clear-btn" onClick={clearFilters}>
              <X size={15} aria-hidden="true" /> Clear filters
            </button>
          )}
        </div>

        {loading ? (
          <ProductGridSkeleton count={8} />
        ) : (
          <ProductGrid products={filteredProducts} onClear={hasFilters ? clearFilters : undefined} />
        )}
      </div>
    </section>
  );
}

export default Explore;
