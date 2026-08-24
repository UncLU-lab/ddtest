import { getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";

export type AuthMode = "firebase" | "development";

function readAuthMode(): string | undefined {
  return import.meta.env.VITE_AUTH_MODE;
}

export function getAuthMode(): AuthMode {
  const authMode = readAuthMode();

  if (authMode === "firebase" || authMode === "development") {
    return authMode;
  }

  throw new Error('VITE_AUTH_MODE must be either "firebase" or "development".');
}

function getFirebaseConfig() {
  const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
  };

  if (Object.values(firebaseConfig).some((value) => !value)) {
    throw new Error("Firebase web authentication configuration is incomplete.");
  }

  return firebaseConfig;
}

export function isFirebaseAuthMode(): boolean {
  return getAuthMode() === "firebase";
}

export function isDevelopmentAuthMode(): boolean {
  return getAuthMode() === "development";
}

export function getFirebaseApp(): FirebaseApp {
  return getApps()[0] ?? initializeApp(getFirebaseConfig());
}

export function getFirebaseAuth(): Auth {
  return getAuth(getFirebaseApp());
}
