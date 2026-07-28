import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { GoogleSignInButton } from "../auth/GoogleSignInButton";
import { ApiError } from "../api/client";
import { isOnboarded } from "../onboarding/onboardingStatus";

export function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
      navigate(isOnboarded() ? "/" : "/preferences");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Login failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6 bg-bg">
      <form onSubmit={handleSubmit} className="glass-card rounded-2xl p-8 w-full max-w-sm flex flex-col gap-4">
        <h1 className="font-heading text-accent text-2xl font-bold mb-2">Log in to Pepper</h1>
        {error && <p className="text-error text-sm">{error}</p>}
        <input
          type="email"
          required
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="bg-surface border border-text-secondary/20 rounded-lg px-4 py-3 text-text-primary outline-none focus:ring-2 focus:ring-accent"
        />
        <input
          type="password"
          required
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="bg-surface border border-text-secondary/20 rounded-lg px-4 py-3 text-text-primary outline-none focus:ring-2 focus:ring-accent"
        />
        <button
          type="submit"
          disabled={submitting}
          className="bg-accent text-accent-contrast font-medium h-12 rounded-full mt-2 disabled:opacity-50"
        >
          {submitting ? "Logging in..." : "Log in"}
        </button>
        <p className="text-text-secondary text-sm text-center mt-2">
          No account? <Link to="/signup" className="text-accent hover:underline">Sign up</Link>
        </p>

        <div className="flex items-center gap-3 my-1">
          <div className="h-px bg-text-secondary/20 flex-grow" />
          <span className="text-text-secondary text-xs">OR</span>
          <div className="h-px bg-text-secondary/20 flex-grow" />
        </div>

        <GoogleSignInButton />
      </form>
    </div>
  );
}
