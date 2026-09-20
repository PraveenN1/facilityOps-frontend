import { FormEvent, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";

import { isApiError } from "../api/client";
import { useAuth } from "../state/AuthContext";
import { useTheme } from "../state/ThemeContext";

export function LoginPage() {
  const auth = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("manager.demo@facilityops.local");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ?? "/";

  if (auth.isAuthenticated) return <Navigate to="/" replace />;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsSigningIn(true);
    try {
      await auth.login({ email, password });
      navigate(from, { replace: true });
    } catch (err) {
      setError(isApiError(err) && err.status === 401 ? "Email or password is incorrect." : "Login failed. Try again.");
    } finally {
      setIsSigningIn(false);
    }
  };

  return (
    <main className="login-shell">
      <div className="login-theme-control">
        <button className="theme-toggle" type="button" onClick={toggleTheme} aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}>
          {theme === "dark" ? "Light" : "Dark"}
        </button>
      </div>
      <section className="login-panel" aria-labelledby="login-title">
        <div className="login-intro">
          <p className="eyebrow">FacilityOps AI</p>
          <h1 id="login-title">Sign in to FacilityOps AI</h1>
          <p>Access your operations workspace securely with your assigned role.</p>
          <div className="login-proof">
            <span>Cookie session</span>
            <span>CSRF-protected changes</span>
            <span>Role-based workspace</span>
          </div>
        </div>
        <form className="login-card stack" onSubmit={submit}>
          <div>
            <p className="eyebrow">Welcome back</p>
            <h2>Operations console</h2>
            <p className="muted-copy">Use a seeded local demo account or your assigned credentials.</p>
          </div>
          <label className="field-label">
            Email
            <input className="field-input" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </label>
          <label className="field-label">
            Password
            <span className="password-control">
              <input className="field-input" type={showPassword ? "text" : "password"} autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
              <button className="secondary-button" type="button" onClick={() => setShowPassword((current) => !current)}>{showPassword ? "Hide" : "Show"}</button>
            </span>
          </label>
          {error ? <div className="inline-error" role="alert">{error}</div> : null}
          <button className="primary-button" disabled={isSigningIn} type="submit">{isSigningIn ? "Signing in..." : "Sign in"}</button>
          <p className="demo-note">Local demo users are listed in the project README. This sign-in screen is not production SSO.</p>
        </form>
      </section>
    </main>
  );
}
