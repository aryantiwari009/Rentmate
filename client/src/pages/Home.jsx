import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Armchair,
  Briefcase,
  CalendarDays,
  CookingPot,
  HandCoins,
  MapPin,
  PackageCheck,
  Repeat2,
  Scale,
  Search,
  ShieldCheck,
  Sparkles,
  Tv,
  Users,
} from "lucide-react";
import { getLocalListings } from "../utils/storage.js";
import ProductImage from "../components/ProductImage.jsx";
import fallbackProducts from "../data/fallbackProducts.js";
import { rentalBundles } from "../data/bundles.js";
import { API } from "../utils/config.js";
import ProductGrid, { ProductGridSkeleton } from "../components/ProductGrid.jsx";
import BundleIcon from "../components/BundleIcon.jsx";

const categories = [
  { name: "Furniture", note: "Beds, sofas, tables", icon: Armchair },
  { name: "Electronics", note: "Monitors, TVs, appliances", icon: Tv },
  { name: "Home Essentials", note: "Kitchen and daily needs", icon: CookingPot },
  { name: "Work & Study", note: "Desks, chairs, monitors", icon: Briefcase },
];

const steps = [
  { icon: Search, title: "Find", text: "Browse furniture, electronics and essentials near you." },
  { icon: Scale, title: "Compare", text: "Check price, deposit, location and ratings side by side." },
  { icon: PackageCheck, title: "Rent", text: "Pick a start date and duration, then confirm your booking." },
  { icon: Repeat2, title: "Return or extend", text: "Send it back when you are done, or keep it a month longer." },
];

const benefits = [
  { icon: HandCoins, title: "Lower upfront cost", text: "Use what you need without paying the full price of buying it." },
  { icon: CalendarDays, title: "Flexible duration", text: "Rent for 1, 3, 6 or 12 months, whichever fits your plans." },
  { icon: MapPin, title: "Local availability", text: "See items available in your city, with delivery dates upfront." },
  { icon: Users, title: "Community listings", text: "Neighbours can list unused items and earn monthly rent." },
];

function Home() {
  const navigate = useNavigate();
  const [products, setProducts] = useState(fallbackProducts);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    async function loadProducts() {
      try {
        const response = await fetch(`${API}/products`);

        if (!response.ok) {
          throw new Error("Products API failed");
        }

        const data = await response.json();

        if (Array.isArray(data) && data.length > 0) {
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

  function handleSearch(e) {
    e.preventDefault();
    const q = search.trim();
    navigate(q ? `/explore?q=${encodeURIComponent(q)}` : "/explore");
  }

  const featured = products[0];

  return (
    <div>
      {/* HERO */}
      <section className="hero">
        <div className="container hero-container">
          <div className="hero-content">
            <h1>Rent what you need, for as long as you need it.</h1>

            <p className="lead">
              Furniture, electronics and everyday essentials on flexible monthly
              rentals, delivered to your door and returned when you are done.
            </p>

            <form className="hero-search" onSubmit={handleSearch} role="search">
              <Search size={20} aria-hidden="true" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search for a chair, bed or monitor"
                aria-label="Search rentals"
              />
              <button type="submit" className="btn btn-primary">
                Search
              </button>
            </form>

            <div className="hero-quick">
              <span>Popular:</span>
              {categories.map((c) => (
                <Link
                  key={c.name}
                  to={`/explore?category=${encodeURIComponent(c.name)}`}
                  className="chip"
                >
                  {c.name}
                </Link>
              ))}
            </div>
          </div>

          {featured && (
            <Link to={`/product/${featured._id || featured.id}`} className="hero-feature">
              <ProductImage product={featured} alt={featured.name} fetchpriority="high" decoding="async" />
              <div className="hero-feature-info">
                <div>
                  <strong>{featured.name}</strong>
                  <span>
                    <MapPin size={14} aria-hidden="true" />
                    {featured.location || "Lucknow"}
                  </span>
                </div>
                <div className="hero-feature-price">
                  <strong>₹{Number(featured.price).toLocaleString("en-IN")}</strong>
                  <span>/ month</span>
                </div>
              </div>
            </Link>
          )}
        </div>

        <div className="container">
          <ul className="trust-strip">
            <li>
              <ShieldCheck size={18} aria-hidden="true" /> Verified listings
            </li>
            <li>
              <CalendarDays size={18} aria-hidden="true" /> Rent from 1 to 12 months
            </li>
            <li>
              <PackageCheck size={18} aria-hidden="true" /> Delivery dates shown before you book
            </li>
          </ul>
        </div>
      </section>

      {/* CATEGORIES */}
      <section className="section">
        <div className="container">
          <div className="section-heading">
            <h2>Browse by category</h2>
            <Link to="/explore" className="text-link">
              All rentals <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>

          <div className="category-grid">
            {categories.map(({ name, note, icon: Icon }) => (
              <Link
                key={name}
                to={`/explore?category=${encodeURIComponent(name)}`}
                className="category-card"
              >
                <span className="category-icon">
                  <Icon size={22} aria-hidden="true" />
                </span>
                <span>
                  <h3>{name}</h3>
                  <p>{note}</p>
                </span>
                <ArrowRight size={18} className="category-arrow" aria-hidden="true" />
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* POPULAR */}
      <section className="section section-tint">
        <div className="container">
          <div className="section-heading">
            <h2>Popular rentals</h2>
            <Link to="/explore" className="text-link">
              See all <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>

          {loading ? (
            <ProductGridSkeleton count={4} />
          ) : (
            <ProductGrid products={products.slice(0, 4)} />
          )}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="section">
        <div className="container">
          <div className="section-heading stacked">
            <h2>How renting works</h2>
            <p>From search to return, everything happens in one place.</p>
          </div>

          <ol className="steps-grid">
            {steps.map(({ icon: Icon, title, text }, i) => (
              <li className="step-card" key={title}>
                <span className="step-icon">
                  <Icon size={22} aria-hidden="true" />
                </span>
                <span className="step-count">Step {i + 1}</span>
                <h3>{title}</h3>
                <p>{text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* BUNDLES */}
      <section className="section section-tint">
        <div className="container">
          <div className="section-heading">
            <h2>Rent a complete setup</h2>
            <Link to="/bundles" className="text-link">
              See bundles <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>

          <div className="home-bundle-strip">
            {rentalBundles.map((bundle) => (
              <Link to="/bundles" className="home-bundle" key={bundle.id}>
                <span className="category-icon">
                  <BundleIcon id={bundle.id} />
                </span>
                <span>
                  <strong>{bundle.name}</strong>
                  <p>{bundle.fallbackItems.map((i) => i.name).join(", ")}</p>
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* AI PROMO */}
      <section className="section">
        <div className="container">
          <div className="ai-promo">
            <div className="ai-promo-copy">
              <h2>Not sure what to rent?</h2>
              <p>
                Tell the assistant what you need and your monthly budget. It
                suggests a starter setup from the catalogue.
              </p>
              <Link to="/assistant" className="btn btn-primary">
                <Sparkles size={18} aria-hidden="true" /> Try the AI Assistant
              </Link>
            </div>

            <div className="ai-promo-visual" aria-hidden="true">
              <div className="ai-message">
                <span>You</span>
                <p>I need a study setup under ₹2,000 a month.</p>
              </div>
              <div className="ai-message ai-message-answer">
                <span>RentMate AI</span>
                <p>A desk and an ergonomic chair fit your budget. Want to see them?</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* WHY RENTMATE */}
      <section className="section">
        <div className="container">
          <div className="section-heading stacked">
            <h2>Why people rent with RentMate</h2>
          </div>

          <div className="benefits-grid">
            {benefits.map(({ icon: Icon, title, text }) => (
              <div className="benefit-card" key={title}>
                <span className="benefit-icon">
                  <Icon size={22} aria-hidden="true" />
                </span>
                <h3>{title}</h3>
                <p>{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="section cta-section">
        <div className="container">
          <div className="final-cta">
            <div>
              <h2>Have something you are not using?</h2>
              <p>List it on RentMate and earn rent while someone else puts it to use.</p>
            </div>
            <div className="final-cta-actions">
              <Link to="/list-item" className="btn btn-on-dark">
                List an item
              </Link>
              <Link to="/explore" className="btn btn-outline-dark">
                Browse rentals
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

export default Home;