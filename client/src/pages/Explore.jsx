import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { Search, X } from "lucide-react";
import { api } from "../utils/api.js";
import ProductGrid, { ProductGridSkeleton } from "../components/ProductGrid.jsx";

const CATEGORIES = ["Furniture", "Electronics", "Home Essentials", "Work & Study"];

function Explore() {
  const location = useLocation();

  const params = new URLSearchParams(location.search);

  const initialQuery = params.get("q") || "";
  const initialCategory = params.get("category") || "";

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState(initialQuery);
  const [debouncedQuery, setDebouncedQuery] = useState(initialQuery);
  const [category, setCategory] = useState(initialCategory);
  const [maxPrice, setMaxPrice] = useState("");
  const [sort, setSort] = useState("recommended");

  useEffect(() => {
    setQuery(initialQuery);
    setDebouncedQuery(initialQuery);
    setCategory(initialCategory);
  }, [initialQuery, initialCategory]);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(query);
    }, 300);

    return () => clearTimeout(handler);
  }, [query]);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const searchParams = new URLSearchParams();
      if (debouncedQuery.trim()) {
        searchParams.set("q", debouncedQuery.trim());
      }
      if (category.trim()) {
        searchParams.set("category", category.trim());
      }
      if (maxPrice !== "" && !Number.isNaN(Number(maxPrice))) {
        searchParams.set("maxPrice", maxPrice.trim());
      }

      const queryString = searchParams.toString();
      const path = queryString ? `/products?${queryString}` : "/products";
      const data = await api.get(path);
      setProducts(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || "Failed to load rentals");
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, [debouncedQuery, category, maxPrice]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const sortedProducts = useMemo(() => {
    if (!products.length) return [];
    if (sort === "price-asc") return [...products].sort((a, b) => a.price - b.price);
    if (sort === "price-desc") return [...products].sort((a, b) => b.price - a.price);
    if (sort === "rating")
      return [...products].sort((a, b) => Number(b.rating || 0) - Number(a.rating || 0));
    return products;
  }, [products, sort]);

  const clearFilters = () => {
    setQuery("");
    setDebouncedQuery("");
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
            ) : error ? (
              "Error loading rentals"
            ) : (
              <>
                <strong>{sortedProducts.length}</strong>{" "}
                {sortedProducts.length === 1 ? "rental" : "rentals"} found
              </>
            )}
          </p>

          {hasFilters && (
            <button type="button" className="clear-btn" onClick={clearFilters}>
              <X size={15} aria-hidden="true" /> Clear filters
            </button>
          )}
        </div>

        {error ? (
          <div className="empty-state">
            <h3>Failed to load rentals</h3>
            <p>{error}</p>
            <button type="button" className="btn btn-primary" onClick={loadProducts}>
              Retry
            </button>
          </div>
        ) : loading ? (
          <ProductGridSkeleton count={8} />
        ) : (
          <ProductGrid
            products={sortedProducts}
            onClear={hasFilters ? clearFilters : undefined}
            emptyMessage="No items match your search"
          />
        )}
      </div>
    </section>
  );
}

export default Explore;
