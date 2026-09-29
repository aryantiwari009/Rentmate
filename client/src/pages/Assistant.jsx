import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Briefcase, Calculator, GraduationCap, Home, Sparkles, WalletCards } from "lucide-react";
import { getLocalListings } from "../utils/storage.js";
import fallbackProducts from "../data/fallbackProducts.js";
import { API } from "../utils/config.js";
import ProductGrid from "../components/ProductGrid.jsx";
import { rentalBundles } from "../data/bundles.js";
import BundleIcon from "../components/BundleIcon.jsx";

function extractBudget(text) {
  const match = text.match(/(?:₹|rs\.?|inr)?\s*(\d{3,6})(?:\s*\/\s*month|\s*per\s*month|\s*monthly)?/i);
  return match ? Number(match[1]) : null;
}

function Assistant() {
  const [query, setQuery] = useState("");
  const [answer, setAnswer] = useState("");
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [budget, setBudget] = useState(null);
  const [bundle, setBundle] = useState(null);

  const catalog = useMemo(() => [...fallbackProducts, ...getLocalListings()], []);

  async function getRecommendations() {
    if (!query.trim()) return;
    setLoading(true); setAnswer(""); setRecommendations([]); setBundle(null);
    const parsedBudget = extractBudget(query);
    setBudget(parsedBudget);

    try {
      const response = await fetch(`${API}/ai/recommend`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ request: query, query }),
      });
      if (!response.ok) throw new Error("AI unavailable");
      const data = await response.json();
      setAnswer(data.answer || data.message || "Here is a setup based on your requirement.");
      const ids = new Set((data.recommendations || []).map((item) => String(item._id || item.id)));
      const serverMatches = (data.recommendations || []).map((item) => catalog.find((p) => String(p._id || p.id) === String(item._id || item.id)) || item);
      setRecommendations(serverMatches.length ? serverMatches : catalog.filter((p) => !parsedBudget || p.price <= parsedBudget).slice(0, 4));
      if (data.bundle) setBundle(data.bundle);
      else if (ids.size === 0) setBundle(pickBundle(query));
    } catch {
      const text = query.toLowerCase();
      let matches = catalog;
      if (text.includes("bed") || text.includes("sleep") || text.includes("room")) matches = catalog.filter((item) => ["Furniture","Home Essentials"].includes(item.category));
      else if (text.includes("tv") || text.includes("monitor") || text.includes("electronics")) matches = catalog.filter((item) => item.category === "Electronics");
      else if (text.includes("work") || text.includes("study") || text.includes("office")) matches = catalog.filter((item) => item.category === "Work & Study");
      if (parsedBudget) matches = matches.filter((item) => Number(item.price) <= parsedBudget);
      matches = matches.slice(0, 4);
      setRecommendations(matches);
      setBundle(pickBundle(query));
      const total = matches.reduce((sum, item) => sum + Number(item.price || 0), 0);
      setAnswer(parsedBudget && total > parsedBudget ? `I found a setup, but the first ${matches.length} items total ₹${total}/month, which is above your ₹${parsedBudget} budget. Try the bundle options below or increase the budget.` : `Based on your requirement, I found ${matches.length} rental options${parsedBudget ? ` within ₹${parsedBudget}/month` : ""}.`);
    }
    setLoading(false);
  }

  function pickBundle(text) {
    const value = text.toLowerCase();
    if (value.includes("student") || value.includes("study") || value.includes("college")) return rentalBundles[0];
    if (value.includes("work") || value.includes("office") || value.includes("coding")) return rentalBundles[1];
    return rentalBundles[2];
  }

  const recommendedTotal = recommendations.reduce((sum, item) => sum + Number(item.price || 0), 0);

  return (
    <section className="page assistant-page">
      <div className="container assistant-container">
        <header className="page-header assistant-header">
          <span className="assistant-icon">
            <Sparkles size={26} aria-hidden="true" />
          </span>
          <h1>Your rental assistant</h1>
          <p>
            Tell me what you need, your budget and how long you need it. I will suggest a
            practical starting setup.
          </p>
        </header>

        <div className="assistant-box">
          <div className="assistant-input-wrap">
            <Sparkles size={19} aria-hidden="true" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && getRecommendations()}
              placeholder="e.g. I am a student moving for 6 months, budget ₹3000/month"
              aria-label="Describe what you need"
            />
            <button
              type="button"
              className="btn btn-primary"
              onClick={getRecommendations}
              disabled={loading || !query.trim()}
            >
              {loading ? "Thinking..." : "Recommend"}
            </button>
          </div>

          <div className="suggestion-row">
            <span>Try:</span>
            <button type="button" className="chip" onClick={() => setQuery("I'm a student and need a study setup under ₹2000/month")}>
              <GraduationCap size={15} aria-hidden="true" /> Study setup
            </button>
            <button type="button" className="chip" onClick={() => setQuery("I need a temporary room setup under ₹3000/month")}>
              <Home size={15} aria-hidden="true" /> Temporary room
            </button>
            <button type="button" className="chip" onClick={() => setQuery("I need a work from home setup under ₹2500/month")}>
              <Briefcase size={15} aria-hidden="true" /> Work from home
            </button>
          </div>
        </div>

        {loading && (
          <div className="page-loading" role="status">
            <div className="loader" />
            <p>Finding the best matches...</p>
          </div>
        )}

        {answer && (
          <div className="ai-result">
            <div className="ai-answer">
              <span className="ai-result-icon">
                <Sparkles size={18} aria-hidden="true" />
              </span>
              <div>
                <span>RentMate AI</span>
                <p>{answer}</p>
              </div>
            </div>

            <div className="ai-metrics">
              <div>
                <WalletCards size={18} aria-hidden="true" />
                <span>Budget</span>
                <b>{budget ? `₹${budget}/mo` : "Flexible"}</b>
              </div>
              <div>
                <Calculator size={18} aria-hidden="true" />
                <span>Suggested total</span>
                <b>₹{recommendedTotal.toLocaleString("en-IN")}/mo</b>
              </div>
            </div>

            {bundle && (
              <div className="ai-bundle">
                <span className="category-icon">
                  <BundleIcon id={bundle.id} />
                </span>
                <div>
                  <h2>{bundle.name}</h2>
                  <p>{bundle.description}</p>
                </div>
                <Link to="/bundles" className="btn btn-secondary">
                  View bundle <ArrowRight size={17} aria-hidden="true" />
                </Link>
              </div>
            )}

            {recommendations.length > 0 && (
              <div>
                <div className="section-heading">
                  <h2>Recommended for you</h2>
                  <span className="muted-copy">{recommendations.length} items</span>
                </div>
                <ProductGrid products={recommendations} />
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
export default Assistant;
