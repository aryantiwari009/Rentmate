import React, { useEffect, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { LogOut, Menu, Plus, X } from "lucide-react";
import { getUser, logoutUser } from "../utils/auth.js";
import ThemeToggle from "./ThemeToggle.jsx";

const links = [
  { to: "/explore", label: "Explore" },
  { to: "/bundles", label: "Bundles" },
  { to: "/assistant", label: "AI Assistant" },
  { to: "/rentals", label: "My Rentals" },
  { to: "/saved", label: "Saved" },
];

function Nav() {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState(getUser());

  useEffect(() => {
    setOpen(false);
    setUser(getUser());
  }, [location.pathname]);

  useEffect(() => {
    document.body.classList.toggle("menu-open", open);
    return () => document.body.classList.remove("menu-open");
  }, [open]);

  return (
    <header className="navbar">
      <div className="container nav-container">
        <Link to="/" className="brand" aria-label="RentMate home">
          <span className="brand-logo" aria-hidden="true">R</span>
          <span className="brand-name">RentMate</span>
        </Link>

        <nav
          id="primary-nav"
          className={`nav-links ${open ? "nav-open" : ""}`}
          aria-label="Primary"
        >
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) => (isActive ? "active" : "")}
            >
              {link.label}
            </NavLink>
          ))}

          <div className="nav-actions">
            <ThemeToggle />
            <Link to="/list-item" className="btn btn-secondary btn-sm">
              <Plus size={16} aria-hidden="true" /> List an item
            </Link>

            {user ? (
              <button
                type="button"
                className="nav-user"
                onClick={() => {
                  logoutUser();
                  setUser(null);
                }}
                title="Sign out"
                aria-label={`Sign out ${user.name}`}
              >
                <span className="avatar" aria-hidden="true">
                  {user.name.trim().charAt(0).toUpperCase()}
                </span>
                <span className="nav-user-name">{user.name.split(" ")[0]}</span>
                <LogOut size={16} aria-hidden="true" />
              </button>
            ) : (
              <Link to="/login" className="btn btn-primary btn-sm">
                Sign in
              </Link>
            )}
          </div>
        </nav>

        <button
          type="button"
          className="mobile-menu-btn"
          onClick={() => setOpen(!open)}
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          aria-controls="primary-nav"
        >
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>
    </header>
  );
}

export default Nav;
