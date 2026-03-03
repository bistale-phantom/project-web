import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";

export default function Navbar() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <nav className="navbar">
      <div className="navbar-left">
        <Link to="/" className="navbar-brand">
          <span className="navbar-brand-emoji">🌸</span>
          TaskTracker
        </Link>
      </div>
      <div className="navbar-right">
        <button className="btn-icon" onClick={toggleTheme} title="Toggle theme">
          {theme === "light" ? "🌙" : "☀️"}
        </button>
        {user ? (
          <>
            <Link to="/profile" className="navbar-user">
              {user.name || user.email}
            </Link>
            <button className="btn-sm" onClick={handleLogout}>
              Logout
            </button>
          </>
        ) : (
          <Link to="/login" className="btn-sm">Login</Link>
        )}
      </div>
    </nav>
  );
}
