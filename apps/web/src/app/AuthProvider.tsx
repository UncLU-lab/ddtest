import { createContext, type ReactNode, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut as firebaseSignOut, type User } from "firebase/auth";

import { getAuthMode, getFirebaseAuth, type AuthMode } from "../lib/auth";

export type AuthStatus = "loading" | "unauthenticated" | "authenticated";

interface AuthContextValue {
  mode: AuthMode;
  status: AuthStatus;
  user: User | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const mode = getAuthMode();
  const [status, setStatus] = useState<AuthStatus>(mode === "development" ? "authenticated" : "loading");
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    if (mode === "development") {
      setUser(null);
      setStatus("authenticated");
      return;
    }

    const auth = getFirebaseAuth();
    setStatus("loading");

    return onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setStatus(nextUser ? "authenticated" : "unauthenticated");
    });
  }, [mode]);

  async function handleSignIn(email: string, password: string) {
    if (mode !== "firebase") {
      throw new Error("Email/password sign-in is only available in firebase authentication mode.");
    }

    await signInWithEmailAndPassword(getFirebaseAuth(), email, password);
  }

  async function handleSignOut() {
    if (mode !== "firebase") {
      return;
    }

    await firebaseSignOut(getFirebaseAuth());
  }

  return (
    <AuthContext.Provider
      value={{
        mode,
        status,
        user,
        signIn: handleSignIn,
        signOut: handleSignOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider.");
  }

  return context;
}
