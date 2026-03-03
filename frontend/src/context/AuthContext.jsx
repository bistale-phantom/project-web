import { createContext, useContext, useState, useEffect } from "react";
import * as authApi from "../api/auth";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem("user");
    return saved ? JSON.parse(saved) : null;
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      authApi
        .getMe()
        .then((u) => {
          setUser(u);
          localStorage.setItem("user", JSON.stringify(u));
        })
        .catch(() => {
          localStorage.removeItem("token");
          localStorage.removeItem("user");
          setUser(null);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email, password) => {
    const { token, user: u } = await authApi.login(email, password);
    localStorage.setItem("token", token);
    localStorage.setItem("user", JSON.stringify(u));
    setUser(u);
  };

  const register = async (email, password, name) => {
    const { token, user: u } = await authApi.register(email, password, name);
    localStorage.setItem("token", token);
    localStorage.setItem("user", JSON.stringify(u));
    setUser(u);
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
  };

  const refreshUser = async () => {
    const u = await authApi.getMe();
    setUser(u);
    localStorage.setItem("user", JSON.stringify(u));
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
