import { FormEvent, useState } from "react";
import { Eye, EyeOff, Moon, Sun, Wrench } from "lucide-react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";

import { isApiError } from "../api/client";
import { useAuth } from "../state/AuthContext";
import { useTheme } from "../state/ThemeContext";

export function LoginPage() {
  const auth = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState(import.meta.env.DEV ? "manager.demo@facilityops.local" : "");
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
          {theme === "dark" ? <Sun aria-hidden size={16} /> : <Moon aria-hidden size={16} />}
          <span>{theme === "dark" ? "Light" : "Dark"}</span>
        </button>
      </div>
      <section className="login-panel" aria-labelledby="login-title">
        <form className="login-card stack" onSubmit={submit}>
          <div className="login-brand">
            <span className="brand-mark" aria-hidden="true"><Wrench size={22} /></span>
            <div>
              <p className="eyebrow">FacilityOps AI</p>
              <h1 id="login-title">Welcome back</h1>
            </div>
          </div>
          <p className="login-subtitle">Sign in to your operations workspace.</p>
          <label className="field-label">
            Email
            <input className="field-input" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </label>
          <label className="field-label">
            Password
            <span className="password-control">
              <input className="field-input" type={showPassword ? "text" : "password"} autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
              <button className="secondary-button icon-button" type="button" onClick={() => setShowPassword((current) => !current)}>
                {showPassword ? <EyeOff aria-hidden size={16} /> : <Eye aria-hidden size={16} />}
                <span>{showPassword ? "Hide" : "Show"}</span>
              </button>
            </span>
          </label>
          {error ? <div className="inline-error" role="alert">{error}</div> : null}
          <button className="primary-button" disabled={isSigningIn} type="submit">{isSigningIn ? "Signing in..." : "Sign in"}</button>
          {import.meta.env.DEV ? <p className="demo-note">Local demo users are listed in the project README. This sign-in screen is not production SSO.</p> : null}
        </form>
      </section>
    </main>
  );
}
