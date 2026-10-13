import { useEffect, useState, type FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { ApiError } from "../api/client";
import { updateMe } from "../api/endpoints";
import { isOnboarded } from "../onboarding/onboardingStatus";

const FIELD_LABEL = "text-[11px] font-semibold uppercase tracking-widest text-text-secondary";
const FIELD_INPUT =
  "bg-transparent border border-text-secondary/25 rounded-lg px-4 py-3 text-text-primary text-center text-2xl tracking-[0.5em] outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-colors";

const RESEND_COOLDOWN_SECONDS = 60;

export function VerifyEmail() {
  const { user, verifyEmail, resendVerificationCode, refreshUser, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const stateEmail = (location.state as { email?: string } | null)?.email;
  const email = user?.email ?? stateEmail ?? "";

  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_SECONDS);
  const [changingEmail, setChangingEmail] = useState(false);
  const [newEmail, setNewEmail] = useState("");

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const token = await verifyEmail(email, code);
      const onboarded = token.onboarding_completed || isOnboarded();
      navigate(onboarded ? "/" : "/preferences");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Verification failed");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResend() {
    if (cooldown > 0 || resending) return;
    setError(null);
    setInfo(null);
    setResending(true);
    try {
      await resendVerificationCode(email);
      setInfo("A new code is on its way.");
      setCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not resend code");
    } finally {
      setResending(false);
    }
  }

  async function handleChangeEmail(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setSubmitting(true);
    try {
      await updateMe({ email: newEmail });
      await refreshUser();
      setChangingEmail(false);
      setCode("");
      setCooldown(RESEND_COOLDOWN_SECONDS);
      setInfo("Email updated. A new code is on its way.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not change email");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-12 bg-bg">
      <div className="w-full max-w-sm flex flex-col gap-8">
        <div className="text-center">
          <h1 className="font-heading text-text-primary text-4xl font-semibold">Check your email</h1>
          <p className="text-text-secondary text-sm mt-3">
            We sent a 6-digit code to <span className="text-text-primary font-medium">{email || "your email"}</span>.
          </p>
        </div>

        {changingEmail ? (
          <form onSubmit={handleChangeEmail} className="flex flex-col gap-4">
            {error && <p className="text-error text-sm">{error}</p>}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="new-email" className={FIELD_LABEL}>
                New email address
              </label>
              <input
                id="new-email"
                type="email"
                required
                placeholder="you@example.com"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                className="bg-transparent border border-text-secondary/25 rounded-lg px-4 py-3 text-text-primary outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-colors"
              />
            </div>
            <button type="submit" disabled={submitting} className="btn-accent font-medium h-12 rounded-full disabled:opacity-50">
              {submitting ? "Updating..." : "Update email"}
            </button>
            <button
              type="button"
              onClick={() => setChangingEmail(false)}
              className="text-text-secondary text-sm text-center hover:underline"
            >
              Cancel
            </button>
          </form>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {error && <p className="text-error text-sm">{error}</p>}
            {info && <p className="text-text-secondary text-sm">{info}</p>}

            <div className="flex flex-col gap-1.5">
              <label htmlFor="verify-code" className={FIELD_LABEL}>
                Verification code
              </label>
              <input
                id="verify-code"
                type="text"
                inputMode="numeric"
                pattern="\d{6}"
                maxLength={6}
                required
                placeholder="000000"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                className={FIELD_INPUT}
              />
            </div>

            <button
              type="submit"
              disabled={submitting || code.length !== 6}
              className="btn-accent font-medium h-12 rounded-full mt-2 disabled:opacity-50"
            >
              {submitting ? "Verifying..." : "Verify"}
            </button>

            <button
              type="button"
              onClick={handleResend}
              disabled={cooldown > 0 || resending}
              className="text-accent text-sm text-center hover:underline disabled:opacity-50 disabled:no-underline"
            >
              {cooldown > 0 ? `Resend code in ${cooldown}s` : resending ? "Resending..." : "Resend code"}
            </button>

            <button
              type="button"
              onClick={() => setChangingEmail(true)}
              className="text-text-secondary text-sm text-center hover:underline"
            >
              Change email
            </button>

            <button type="button" onClick={logout} className="text-text-secondary/60 text-xs text-center hover:underline mt-2">
              Log out
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
