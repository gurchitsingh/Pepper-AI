import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { GoogleSignInButton } from "../auth/GoogleSignInButton";
import { ApiError } from "../api/client";
import { isOnboarded } from "../onboarding/onboardingStatus";

const FIELD_LABEL = "text-[11px] font-semibold uppercase tracking-widest text-text-secondary";
const FIELD_INPUT =
  "bg-transparent border border-text-secondary/25 rounded-lg px-4 py-3 text-text-primary outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-colors";

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
      const token = await login(email, password);
      if (!token.email_verified) {
        navigate("/verify-email", { state: { email } });
      } else if (!token.onboarding_completed && !isOnboarded()) {
        navigate("/preferences");
      } else {
        navigate("/");
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Login failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-12 bg-bg">
      <div className="w-full max-w-sm flex flex-col gap-8">
        <div className="text-center">
          <h1 className="font-heading text-text-primary text-4xl font-semibold">Pepper AI</h1>
          <p className="text-text-secondary text-xs font-semibold uppercase tracking-[0.2em] mt-2">
            Log in to your account
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {error && <p className="text-error text-sm">{error}</p>}

          <div className="flex flex-col gap-1.5">
            <label htmlFor="login-email" className={FIELD_LABEL}>
              Email address
            </label>
            <input
              id="login-email"
              type="email"
              required
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={FIELD_INPUT}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="login-password" className={FIELD_LABEL}>
              Password
            </label>
            <input
              id="login-password"
              type="password"
              required
              placeholder="Your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={FIELD_INPUT}
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="btn-accent font-medium h-12 rounded-full mt-2 disabled:opacity-50"
          >
            {submitting ? "Logging in..." : "Log In"}
          </button>

          <div className="flex items-center gap-3 my-1">
            <div className="h-px bg-text-secondary/20 flex-grow" />
            <span className="text-text-secondary text-[11px] font-semibold uppercase tracking-widest">
              Or continue with
            </span>
            <div className="h-px bg-text-secondary/20 flex-grow" />
          </div>

          <GoogleSignInButton />

          <p className="text-text-secondary text-sm text-center mt-2">
            No account?{" "}
            <Link to="/signup" className="text-accent hover:underline">
              Sign up
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
