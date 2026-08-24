import { type ReactNode } from "react";

import { useAuth } from "./AuthProvider";
import LoginScreen from "./LoginScreen";

function AuthLoadingScreen() {
  return (
    <main
      className="min-h-screen flex items-center justify-center px-6"
      style={{ backgroundColor: "#F8FAFC", fontFamily: "'Inter', sans-serif" }}
    >
      <div className="text-center">
        <p style={{ fontSize: "14px", fontWeight: 600, color: "#0F172A" }}>Loading session...</p>
      </div>
    </main>
  );
}

export default function AuthGate({ children }: { children: ReactNode }) {
  const { status } = useAuth();

  if (status === "loading") {
    return <AuthLoadingScreen />;
  }

  if (status === "unauthenticated") {
    return <LoginScreen />;
  }

  return <>{children}</>;
}
