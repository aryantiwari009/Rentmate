import React from "react";
import { Route, Routes } from "react-router-dom";
import Nav from "./components/Nav.jsx";
import Footer from "./components/Footer.jsx";
import Home from "./pages/Home.jsx";
import Explore from "./pages/Explore.jsx";
import Product from "./pages/Product.jsx";
import Assistant from "./pages/Assistant.jsx";
import ListItem from "./pages/ListItem.jsx";
import Rentals from "./pages/Rentals.jsx";
import Bundles from "./pages/Bundles.jsx";
import Login from "./pages/Login.jsx";
import Checkout from "./pages/Checkout.jsx";
import Saved from "./pages/Saved.jsx";
import NotFound from "./pages/NotFound.jsx";
import RouteEffects from "./components/RouteEffects.jsx";

function App() {
  return (
    <>
      <RouteEffects />
      <Nav />

      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/explore" element={<Explore />} />
          <Route path="/product/:id" element={<Product />} />
          <Route path="/assistant" element={<Assistant />} />
          <Route path="/rentals" element={<Rentals />} />
          <Route path="/bundles" element={<Bundles />} />
          <Route path="/list-item" element={<ListItem />} />
          <Route path="/login" element={<Login />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/saved" element={<Saved />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>

      <Footer />
    </>
  );
}

export default App;
