import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { ApiError } from "../api/client";

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
      navigate("/");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Login failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <form onSubmit={handleSubmit} className="glass-card rounded-2xl p-8 w-full max-w-sm flex flex-col gap-4">
        <h1 className="font-display text-primary text-2xl font-bold mb-2">Log in to Weave AI</h1>
        {error && <p className="text-error text-sm">{error}</p>}
        <input
          type="email"
          required
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="bg-surface-container-high rounded-lg px-4 py-3 text-on-surface outline-none focus:ring-2 focus:ring-primary"
        />
        <input
          type="password"
          required
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="bg-surface-container-high rounded-lg px-4 py-3 text-on-surface outline-none focus:ring-2 focus:ring-primary"
        />
        <button
          type="submit"
          disabled={submitting}
          className="bg-primary text-on-primary font-medium h-12 rounded-full mt-2 disabled:opacity-50"
        >
          {submitting ? "Logging in..." : "Log in"}
        </button>
        <p className="text-on-surface-variant text-sm text-center mt-2">
          No account? <Link to="/signup" className="text-primary hover:underline">Sign up</Link>
        </p>
      </form>
    </div>
  );
}
