import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api } from "../utils/api.js";

const AuthContext = createContext({
  user: null,
  loading: true,
  error: null,
  login: async () => {},
  register: async () => {},
  logout: async () => {},
  checkAuth: async () => {},
  isAuthenticated: false,
});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const checkAuth = useCallback(async () => {
    try {
      const data = await api.get("/auth/me");
      setUser(data);
      setError(null);
      return data;
    } catch (err) {
      setUser(null);
      if (err.status !== 401) {
        setError(err.message);
      }
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const login = async ({ email, password }) => {
    setError(null);
    try {
      await api.post("/auth/login", { email, password });
      const currentUser = await api.get("/auth/me");
      setUser(currentUser);
      return currentUser;
    } catch (err) {
      setError(err.message || "Failed to sign in");
      throw err;
    }
  };

  const register = async ({ name, email, password }) => {
    setError(null);
    try {
      await api.post("/auth/register", { name, email, password });
      return await login({ email, password });
    } catch (err) {
      setError(err.message || "Failed to create account");
      throw err;
    }
  };

  const logout = async () => {
    try {
      await api.post("/auth/logout");
    } catch (err) {
      console.error("Logout request failed:", err);
    } finally {
      setUser(null);
    }
  };

  const value = {
    user,
    loading,
    error,
    login,
    register,
    logout,
    checkAuth,
    isAuthenticated: Boolean(user),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

export default AuthContext;
