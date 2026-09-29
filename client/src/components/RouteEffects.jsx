import { useEffect } from "react";
import { useLocation } from "react-router-dom";

const TITLES = {
  "/": "Rent furniture, electronics and essentials",
  "/explore": "Explore rentals",
  "/bundles": "Rental bundles",
  "/assistant": "AI Assistant",
  "/rentals": "My rentals",
  "/saved": "Saved items",
  "/list-item": "List an item",
  "/login": "Sign in",
  "/checkout": "Confirm your rental",
};

function titleFor(pathname) {
  if (TITLES[pathname]) return TITLES[pathname];
  if (pathname.startsWith("/product/")) return "Rental details";
  return "Page not found";
}

/** On every route change: scroll to the top and set a page title. */
function RouteEffects() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    document.title = `${titleFor(pathname)} | RentMate`;
  }, [pathname]);

  return null;
}

export default RouteEffects;
