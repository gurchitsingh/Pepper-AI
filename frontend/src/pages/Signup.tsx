import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { GoogleSignInButton } from "../auth/GoogleSignInButton";
import { ApiError } from "../api/client";
import { isOnboarded } from "../onboarding/onboardingStatus";

export function Signup() {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const passwordStrong = /[A-Z]/.test(password) && /[0-9]/.test(password);
  const passwordsMatch = password === confirmPassword;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!passwordStrong) {
      setError("Password must contain at least one uppercase letter and one number");
      return;
    }
    if (!passwordsMatch) {
      setError("Passwords do not match");
      return;
    }
    setSubmitting(true);
    try {
      await signup(email, password, name);
      navigate(isOnboarded() ? "/" : "/preferences");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Signup failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6 bg-bg">
      <form onSubmit={handleSubmit} className="glass-card rounded-2xl p-8 w-full max-w-sm flex flex-col gap-4">
        <h1 className="font-heading text-accent text-2xl font-bold mb-2">Join Pepper</h1>
        {error && <p className="text-error text-sm">{error}</p>}
        <input
          type="text"
          placeholder="Name (optional)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="bg-surface border border-text-secondary/20 rounded-lg px-4 py-3 text-text-primary outline-none focus:ring-2 focus:ring-accent"
        />
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
          minLength={8}
          placeholder="Password (min 8 characters)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="bg-surface border border-text-secondary/20 rounded-lg px-4 py-3 text-text-primary outline-none focus:ring-2 focus:ring-accent"
        />
        {password.length > 0 && !passwordStrong && (
          <p className="text-error text-xs -mt-2">Must include an uppercase letter and a number</p>
        )}
        <input
          type="password"
          required
          placeholder="Confirm password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className="bg-surface border border-text-secondary/20 rounded-lg px-4 py-3 text-text-primary outline-none focus:ring-2 focus:ring-accent"
        />
        {confirmPassword.length > 0 && !passwordsMatch && (
          <p className="text-error text-xs -mt-2">Passwords do not match</p>
        )}
        <button
          type="submit"
          disabled={submitting}
          className="bg-accent text-accent-contrast font-medium h-12 rounded-full mt-2 disabled:opacity-50"
        >
          {submitting ? "Signing up..." : "Sign up"}
        </button>
        <p className="text-text-secondary text-sm text-center mt-2">
          Already have an account? <Link to="/login" className="text-accent hover:underline">Log in</Link>
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
