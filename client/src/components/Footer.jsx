import React from "react";
import { Link } from "react-router-dom";

function Footer() {
  return (
    <footer className="footer">
      <div className="container footer-container">
        <div className="footer-brand">
          <Link to="/" className="brand" aria-label="RentMate home">
            <span className="brand-logo" aria-hidden="true">R</span>
            <span className="brand-name">RentMate</span>
          </Link>
          <p>
            Rent furniture, electronics and everyday essentials by the month,
            and list what you are not using.
          </p>
        </div>

        <nav className="footer-links" aria-label="Footer">
          <div>
            <h4>Browse</h4>
            <Link to="/explore">All rentals</Link>
            <Link to="/explore?category=Furniture">Furniture</Link>
            <Link to="/explore?category=Electronics">Electronics</Link>
            <Link to="/explore?category=Work %26 Study">Work &amp; Study</Link>
          </div>
          <div>
            <h4>RentMate</h4>
            <Link to="/bundles">Bundles</Link>
            <Link to="/assistant">AI Assistant</Link>
            <Link to="/rentals">My Rentals</Link>
            <Link to="/saved">Saved items</Link>
            <Link to="/list-item">List an item</Link>
          </div>
        </nav>
      </div>

      <div className="container footer-bottom">
        <div className="footer-bottom-inner">© 2026 RentMate</div>
      </div>
    </footer>
  );
}

export default Footer;
