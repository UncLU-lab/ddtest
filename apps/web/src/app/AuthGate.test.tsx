import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import AuthGate from "./AuthGate";
import { AuthProvider } from "./AuthProvider";
import Layout from "./Layout";

const firebaseMocks = vi.hoisted(() => ({
  initializeApp: vi.fn(() => ({ name: "test-app" })),
  getAuth: vi.fn(),
  onAuthStateChanged: vi.fn(),
  signInWithEmailAndPassword: vi.fn(),
  signOut: vi.fn(),
}));

let authStateListener: ((user: unknown) => void) | null = null;
let currentUser: { getIdToken?: () => Promise<string> } | null = null;

vi.mock("firebase/app", () => ({
  getApps: () => [],
  initializeApp: firebaseMocks.initializeApp,
}));

vi.mock("firebase/auth", () => ({
  getAuth: firebaseMocks.getAuth,
  onAuthStateChanged: firebaseMocks.onAuthStateChanged,
  signInWithEmailAndPassword: firebaseMocks.signInWithEmailAndPassword,
  signOut: firebaseMocks.signOut,
}));

function setFirebaseMode() {
  import.meta.env.VITE_AUTH_MODE = "firebase";
  import.meta.env.VITE_FIREBASE_API_KEY = "api-key";
  import.meta.env.VITE_FIREBASE_AUTH_DOMAIN = "example.firebaseapp.com";
  import.meta.env.VITE_FIREBASE_PROJECT_ID = "example-project";
  import.meta.env.VITE_FIREBASE_APP_ID = "app-id";
}

function renderGate() {
  return render(
    <AuthProvider>
      <AuthGate>
        <div>Protected app</div>
      </AuthGate>
    </AuthProvider>,
  );
}

async function emitAuthState(user: unknown) {
  await act(async () => {
    authStateListener?.(user);
  });
}

describe("firebase auth gate", () => {
  beforeEach(() => {
    setFirebaseMode();
    currentUser = null;
    authStateListener = null;

    firebaseMocks.initializeApp.mockClear();
    firebaseMocks.getAuth.mockReset();
    firebaseMocks.onAuthStateChanged.mockReset();
    firebaseMocks.signInWithEmailAndPassword.mockReset();
    firebaseMocks.signOut.mockReset();

    firebaseMocks.getAuth.mockImplementation(() => ({
      authStateReady: vi.fn().mockResolvedValue(undefined),
      currentUser,
    }));
    firebaseMocks.onAuthStateChanged.mockImplementation((_auth, callback) => {
      authStateListener = callback;
      return vi.fn();
    });
    firebaseMocks.signInWithEmailAndPassword.mockResolvedValue(undefined);
    firebaseMocks.signOut.mockResolvedValue(undefined);
  });

  afterEach(() => {
    import.meta.env.VITE_AUTH_MODE = undefined;
    import.meta.env.VITE_DEVELOPMENT_AUTH_TOKEN = undefined;
  });

  it("does not render protected content while auth state is loading", () => {
    renderGate();

    expect(screen.getByText("Loading session...")).toBeInTheDocument();
    expect(screen.queryByText("Protected app")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Sign in" })).not.toBeInTheDocument();
  });

  it("renders the login screen when firebase auth is unauthenticated", async () => {
    renderGate();
    await emitAuthState(null);

    expect(await screen.findByRole("heading", { name: "Sign in" })).toBeInTheDocument();
    expect(screen.queryByText("Protected app")).not.toBeInTheDocument();
  });

  it("renders the app when firebase auth is authenticated", async () => {
    renderGate();
    await emitAuthState({ uid: "user-1" });

    expect(await screen.findByText("Protected app")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Sign in" })).not.toBeInTheDocument();
  });

  it("invokes Firebase email/password sign-in from the login screen", async () => {
    const user = userEvent.setup();

    renderGate();
    await emitAuthState(null);

    await user.type(await screen.findByLabelText("Email"), "captain@example.com");
    await user.type(screen.getByLabelText("Password"), "secret-pass");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => {
      expect(firebaseMocks.signInWithEmailAndPassword).toHaveBeenCalledWith(
        expect.anything(),
        "captain@example.com",
        "secret-pass",
      );
    });
  });

  it("shows a safe login error message", async () => {
    const user = userEvent.setup();
    firebaseMocks.signInWithEmailAndPassword.mockRejectedValueOnce(new Error("Firebase: Error (auth/invalid-credential)."));

    renderGate();
    await emitAuthState(null);

    await user.type(await screen.findByLabelText("Email"), "captain@example.com");
    await user.type(screen.getByLabelText("Password"), "wrong-pass");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Invalid email or password.");
  });

  it("calls Firebase signOut from the layout control", async () => {
    const user = userEvent.setup();

    render(
      <AuthProvider>
        <MemoryRouter>
          <Layout />
        </MemoryRouter>
      </AuthProvider>,
    );

    await emitAuthState({ uid: "user-1" });

    await user.click(await screen.findByRole("button", { name: "Sign out" }));

    await waitFor(() => {
      expect(firebaseMocks.signOut).toHaveBeenCalledWith(expect.anything());
    });
  });

  it("keeps development auth mode working without Firebase auth state", async () => {
    import.meta.env.VITE_AUTH_MODE = "development";
    import.meta.env.VITE_DEVELOPMENT_AUTH_TOKEN = "dev-token";

    render(
      <AuthProvider>
        <AuthGate>
          <div>Protected app</div>
        </AuthGate>
      </AuthProvider>,
    );

    expect(await screen.findByText("Protected app")).toBeInTheDocument();
    expect(firebaseMocks.onAuthStateChanged).not.toHaveBeenCalled();
  });
});
