import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "./AuthContext";
import { isOnboarded } from "../onboarding/onboardingStatus";

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
          }) => void;
          renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void;
        };
      };
    };
  }
}

let scriptPromise: Promise<void> | null = null;

function loadGoogleScript(): Promise<void> {
  if (window.google?.accounts?.id) return Promise.resolve();
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Failed to load Google sign-in script"));
      document.head.appendChild(script);
    });
  }
  return scriptPromise;
}

export function GoogleSignInButton() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { googleLogin } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!CLIENT_ID || !containerRef.current) return;

    loadGoogleScript()
      .then(() => {
        if (!containerRef.current || !window.google) return;
        window.google.accounts.id.initialize({
          client_id: CLIENT_ID,
          callback: async ({ credential }) => {
            try {
              await googleLogin(credential);
              navigate(isOnboarded() ? "/" : "/preferences");
            } catch {
              setError("Google sign-in failed");
            }
          },
        });
        window.google.accounts.id.renderButton(containerRef.current, {
          theme: "outline",
          size: "large",
          width: 320,
        });
      })
      .catch(() => setError("Google sign-in unavailable"));
  }, [googleLogin, navigate]);

  if (!CLIENT_ID) {
    return (
      <button
        type="button"
        disabled
        title="Google sign-in not configured (VITE_GOOGLE_CLIENT_ID missing)"
        className="bg-surface border border-text-secondary/20 text-text-secondary font-medium h-12 rounded-full opacity-50 cursor-not-allowed"
      >
        Continue with Google
      </button>
    );
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <div ref={containerRef} />
      {error && <p className="text-error text-sm">{error}</p>}
    </div>
  );
}
