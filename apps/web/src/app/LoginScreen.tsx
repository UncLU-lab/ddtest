import { type FormEvent, useState } from "react";

import { useAuth } from "./AuthProvider";

function getErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) {
    return "Sign in failed. Check your email and password and try again.";
  }

  if (error.message.includes("auth/invalid-credential")) {
    return "Invalid email or password.";
  }

  if (error.message.includes("auth/too-many-requests")) {
    return "Too many attempts. Try again later.";
  }

  return "Sign in failed. Check your email and password and try again.";
}

export default function LoginScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      await signIn(email.trim(), password);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main
      className="min-h-screen flex items-center justify-center px-6"
      style={{ background: "linear-gradient(180deg, #F8FAFC 0%, #EEF2FF 100%)", fontFamily: "'Inter', sans-serif" }}
    >
      <section
        className="w-full max-w-md rounded-3xl p-8"
        style={{ backgroundColor: "#FFFFFF", boxShadow: "0 24px 64px rgba(15, 23, 42, 0.10)" }}
      >
        <div className="mb-8">
          <p style={{ fontSize: "12px", fontWeight: 600, letterSpacing: "0.08em", color: "#1D4ED8", textTransform: "uppercase" }}>
            Demurrage Defender
          </p>
          <h1 className="mt-3" style={{ fontSize: "28px", fontWeight: 600, color: "#0F172A" }}>
            Sign in
          </h1>
          <p className="mt-2" style={{ fontSize: "14px", color: "#475569" }}>
            Use your Firebase email and password to access the application.
          </p>
        </div>

        <form className="space-y-5" onSubmit={(event) => void handleSubmit(event)}>
          <label className="block">
            <span className="mb-2 block" style={{ fontSize: "13px", fontWeight: 500, color: "#334155" }}>
              Email
            </span>
            <input
              autoComplete="email"
              className="w-full rounded-2xl border px-4 py-3 outline-none"
              disabled={isSubmitting}
              onChange={(event) => setEmail(event.target.value)}
              required
              style={{ borderColor: "#CBD5E1", backgroundColor: "#FFFFFF", color: "#0F172A" }}
              type="email"
              value={email}
            />
          </label>

          <label className="block">
            <span className="mb-2 block" style={{ fontSize: "13px", fontWeight: 500, color: "#334155" }}>
              Password
            </span>
            <input
              autoComplete="current-password"
              className="w-full rounded-2xl border px-4 py-3 outline-none"
              disabled={isSubmitting}
              onChange={(event) => setPassword(event.target.value)}
              required
              style={{ borderColor: "#CBD5E1", backgroundColor: "#FFFFFF", color: "#0F172A" }}
              type="password"
              value={password}
            />
          </label>

          {errorMessage ? (
            <p role="alert" style={{ fontSize: "14px", color: "#B91C1C" }}>
              {errorMessage}
            </p>
          ) : null}

          <button
            className="w-full rounded-2xl px-4 py-3"
            disabled={isSubmitting}
            style={{ backgroundColor: isSubmitting ? "#93C5FD" : "#2563EB", color: "#FFFFFF", fontSize: "14px", fontWeight: 600 }}
            type="submit"
          >
            {isSubmitting ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </section>
    </main>
  );
}
