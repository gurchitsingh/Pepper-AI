const ONBOARDED_KEY = "pepper_onboarded";

export function isOnboarded(): boolean {
  return localStorage.getItem(ONBOARDED_KEY) === "true";
}

export function setOnboarded(): void {
  localStorage.setItem(ONBOARDED_KEY, "true");
}
