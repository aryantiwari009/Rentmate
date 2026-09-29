import React from "react";
import { Link } from "react-router-dom";
import { Compass } from "lucide-react";

function NotFound() {
  return (
    <section className="page">
      <div className="container">
        <div className="empty-page">
          <div className="empty-icon">
            <Compass size={28} aria-hidden="true" />
          </div>
          <h1>Page not found</h1>
          <p>The page you are looking for does not exist or has moved.</p>
          <div className="checkout-actions">
            <Link to="/" className="btn btn-primary">
              Go home
            </Link>
            <Link to="/explore" className="btn btn-secondary">
              Browse rentals
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

export default NotFound;
