import { FormEvent, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";

import { isApiError } from "../api/client";
import { useAuth } from "../state/AuthContext";

export function LoginPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("manager.demo@facilityops.local");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ?? "/";

  if (auth.isAuthenticated) return <Navigate to="/" replace />;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    try {
      await auth.login({ email, password });
      navigate(from, { replace: true });
    } catch (err) {
      setError(isApiError(err) && err.status === 401 ? "Email or password is incorrect." : "Login failed. Try again.");
    }
  };

  return (
    <main className="login-shell">
      <section className="login-panel" aria-labelledby="login-title">
        <div>
          <p className="eyebrow">FacilityOps AI</p>
          <h1 id="login-title">Operations console</h1>
          <p className="muted-copy">Sign in with a backend demo account. Authentication uses HttpOnly cookies and CSRF tokens.</p>
        </div>
        <form className="stack" onSubmit={submit}>
          <label className="field-label">
            Email
            <input className="field-input" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </label>
          <label className="field-label">
            Password
            <input className="field-input" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
          </label>
          {error ? <div className="inline-error" role="alert">{error}</div> : null}
          <button className="primary-button" type="submit">Sign in</button>
        </form>
        <p className="demo-note">Local demo accounts are documented in README.md. This is not production SSO.</p>
      </section>
    </main>
  );
}
