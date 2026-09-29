import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Eye,
  EyeOff,
  Lock,
  Mail,
  User,
  ArrowRight,
  CalendarDays,
  PackageCheck,
  ShieldCheck,
} from "lucide-react";
import { saveUser } from "../utils/auth.js";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();

  const [mode, setMode] = useState("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("Renter");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const isSignup = mode === "signup";

  const switchMode = () => {
    setMode(isSignup ? "signin" : "signup");
    setError("");
    setName("");
    setPassword("");
  };

  const submit = (e) => {
    e.preventDefault();
    setError("");

    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail || !password) {
      setError("Please enter your email and password.");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setError("Please enter a valid email address.");
      return;
    }

    if (password.length < 6) {
      setError("Password must contain at least 6 characters.");
      return;
    }

    setLoading(true);

    try {
      const users = JSON.parse(localStorage.getItem("rentmateUsers") || "[]");

      if (isSignup) {
        if (!name.trim()) {
          setError("Please enter your full name.");
          setLoading(false);
          return;
        }

        const alreadyExists = users.some(
          (user) => user.email === normalizedEmail,
        );

        if (alreadyExists) {
          setError(
            "An account with this email already exists. Please sign in.",
          );
          setLoading(false);
          return;
        }

        const newUser = {
          id: crypto.randomUUID(),
          name: name.trim(),
          email: normalizedEmail,
          password,
          role,
          verified: false,
          createdAt: new Date().toISOString(),
        };

        localStorage.setItem(
          "rentmateUsers",
          JSON.stringify([...users, newUser]),
        );

        saveUser(newUser);

        navigate(location.state?.from || "/");
        return;
      }

      const existingUser = users.find(
        (user) => user.email === normalizedEmail && user.password === password,
      );

      if (!existingUser) {
        setError("Invalid email or password.");
        setLoading(false);
        return;
      }

      saveUser(existingUser);

      navigate(location.state?.from || "/");
    } catch (err) {
      console.error("Authentication error:", err);
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-layout">
        <aside className="auth-intro">
          <Link to="/" className="brand" aria-label="RentMate home">
            <span className="brand-logo" aria-hidden="true">R</span>
            <span className="brand-name">RentMate</span>
          </Link>

          <div className="auth-intro-body">
            <h2>Make room for what matters.</h2>
            <p>
              Rent the things you need for the season you are in, and skip
              buying for a life you have not planned yet.
            </p>

            <ul className="auth-points">
              <li>
                <PackageCheck size={18} aria-hidden="true" />
                Browse locally and see delivery dates upfront
              </li>
              <li>
                <CalendarDays size={18} aria-hidden="true" />
                Rent for 1 to 12 months, extend or return anytime
              </li>
              <li>
                <ShieldCheck size={18} aria-hidden="true" />
                Verified listings from RentMate owners
              </li>
            </ul>
          </div>
        </aside>

        <div className="auth-card">
          <div className="auth-header">
            <h1>{isSignup ? "Create your account" : "Welcome back"}</h1>
            <p>
              {isSignup
                ? "Start renting, or list your own items."
                : "Sign in to continue to your RentMate account."}
            </p>
          </div>

          {error && (
            <div className="alert alert-error" role="alert">
              {error}
            </div>
          )}

          <form onSubmit={submit} className="auth-form" noValidate>
            {isSignup && (
              <div className="form-group">
                <label htmlFor="name">Full name</label>

                <div className="input-wrapper">
                  <User size={18} aria-hidden="true" />

                  <input
                    id="name"
                    type="text"
                    placeholder="Your full name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoComplete="name"
                  />
                </div>
              </div>
            )}

            <div className="form-group">
              <label htmlFor="email">Email address</label>

              <div className="input-wrapper">
                <Mail size={18} aria-hidden="true" />

                <input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="password">Password</label>

              <div className="input-wrapper">
                <Lock size={18} aria-hidden="true" />

                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder={isSignup ? "At least 6 characters" : "Enter your password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={isSignup ? "new-password" : "current-password"}
                />

                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {isSignup && (
              <div className="form-group">
                <span className="label" id="role-label">I want to</span>
                <div className="segmented" role="group" aria-labelledby="role-label">
                  <button
                    type="button"
                    className={role === "Renter" ? "selected" : ""}
                    aria-pressed={role === "Renter"}
                    onClick={() => setRole("Renter")}
                  >
                    Rent items
                  </button>
                  <button
                    type="button"
                    className={role === "Owner" ? "selected" : ""}
                    aria-pressed={role === "Owner"}
                    onClick={() => setRole("Owner")}
                  >
                    List items
                  </button>
                </div>
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary btn-lg auth-submit"
              disabled={loading}
            >
              {loading
                ? "Please wait..."
                : isSignup
                  ? "Create account"
                  : "Sign in"}

              {!loading && <ArrowRight size={18} aria-hidden="true" />}
            </button>
          </form>

          <div className="auth-switch">
            <span>
              {isSignup ? "Already have an account?" : "New to RentMate?"}
            </span>

            <button type="button" onClick={switchMode}>
              {isSignup ? "Sign in" : "Create an account"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
