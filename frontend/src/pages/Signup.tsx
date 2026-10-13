import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { GoogleSignInButton } from "../auth/GoogleSignInButton";
import { ApiError } from "../api/client";
import { isOnboarded } from "../onboarding/onboardingStatus";

const FIELD_LABEL = "text-[11px] font-semibold uppercase tracking-widest text-text-secondary";
const FIELD_INPUT =
  "bg-transparent border border-text-secondary/25 rounded-lg px-4 py-3 text-text-primary outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-colors";

const USERNAME_PATTERN = /^[a-zA-Z0-9_.]{3,32}$/;

export function Signup() {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const passwordStrong = /[A-Z]/.test(password) && /[0-9]/.test(password);
  const passwordsMatch = password === confirmPassword;
  const usernameValid = USERNAME_PATTERN.test(username);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!usernameValid) {
      setError("Username must be 3-32 characters: letters, numbers, underscores, or periods");
      return;
    }
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
      const token = await signup(email, password, username, name);
      if (!token.email_verified) {
        navigate("/verify-email", { state: { email } });
      } else if (!token.onboarding_completed && !isOnboarded()) {
        navigate("/preferences");
      } else {
        navigate("/");
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Signup failed");
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
            Create your account
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {error && <p className="text-error text-sm">{error}</p>}

          <div className="flex flex-col gap-1.5">
            <label htmlFor="signup-name" className={FIELD_LABEL}>
              Full name
            </label>
            <input
              id="signup-name"
              type="text"
              placeholder="Name (optional)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={FIELD_INPUT}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="signup-username" className={FIELD_LABEL}>
              Username
            </label>
            <input
              id="signup-username"
              type="text"
              required
              placeholder="yourusername"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className={FIELD_INPUT}
            />
            {username.length > 0 && !usernameValid && (
              <p className="text-error text-xs">3-32 characters: letters, numbers, underscores, or periods</p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="signup-email" className={FIELD_LABEL}>
              Email address
            </label>
            <input
              id="signup-email"
              type="email"
              required
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={FIELD_INPUT}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="signup-password" className={FIELD_LABEL}>
              Password
            </label>
            <input
              id="signup-password"
              type="password"
              required
              minLength={8}
              placeholder="Min 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={FIELD_INPUT}
            />
            {password.length > 0 && !passwordStrong && (
              <p className="text-error text-xs">Must include an uppercase letter and a number</p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="signup-confirm" className={FIELD_LABEL}>
              Repeat password
            </label>
            <input
              id="signup-confirm"
              type="password"
              required
              placeholder="Repeat password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className={FIELD_INPUT}
            />
            {confirmPassword.length > 0 && !passwordsMatch && (
              <p className="text-error text-xs">Passwords do not match</p>
            )}
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="btn-accent font-medium h-12 rounded-full mt-2 disabled:opacity-50"
          >
            {submitting ? "Creating account..." : "Create Account"}
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
            Already have an account?{" "}
            <Link to="/login" className="text-accent hover:underline">
              Log In
            </Link>
          </p>
        </form>

        <div className="flex items-center justify-center gap-3 text-text-secondary/60 text-xs">
          <a href="#" className="hover:text-text-secondary">
            Terms of Service
          </a>
          <span>&bull;</span>
          <a href="#" className="hover:text-text-secondary">
            Privacy Policy
          </a>
        </div>
      </div>
    </div>
  );
}
