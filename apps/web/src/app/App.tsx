import { BrowserRouter, Navigate, Routes, Route, useNavigate, useParams } from "react-router";
import { ShipmentsProvider } from "./data/ShipmentsContext";

import Layout from "./Layout";
import Operations from "./Operations";
import ShipmentDetail from "./ShipmentDetail";
import SOFTimeline from "./SOFTimeline";
import ClaimsList from "./ClaimsList";
import ClaimsAuditConsole from "./ClaimsAuditConsole";
import CommercialIntelligence from "./CommercialIntelligence";
import TerminalAnalytics from "./TerminalAnalytics";
import CargoRiskMonitor, { VesselCreateForm, VesselDetail } from "./CargoRiskMonitor";
import Settings from "./Settings";
import CreateShipmentForm from "./CreateShipmentForm";
import PreOpsRiskEngine from "./PreOpsRiskEngine";

import DesignSystem from "./DesignSystem";
import ComponentLibrary from "./ComponentLibrary";
import Modals from "./Modals";
import ScreenFrames from "./ScreenFrames";
import PrototypeConnections from "./PrototypeConnections";
import { AuthProvider } from "./AuthProvider";
import AuthGate from "./AuthGate";

function ClaimsListRoute() {
  const navigate = useNavigate();
  return <ClaimsList onOpenClaim={(claimId) => navigate(`/claims/${claimId}`)} />;
}

function ClaimDetailRoute() {
  const { claimId } = useParams();
  const navigate = useNavigate();

  return <ClaimsAuditConsole claimId={claimId} onSaveForReview={() => navigate("/claims")} />;
}

function ClaimsAuditRoute() {
  const navigate = useNavigate();
  return <ClaimsAuditConsole onSaveForReview={() => navigate("/claims")} />;
}

function RedirectRoute({ to }: { to: string }) {
  return <Navigate to={to} replace />;
}

function CommercialIntelligenceRoute() {
  const navigate = useNavigate();
  return <CommercialIntelligence onTerminal={() => navigate("/analytics/terminal")} />;
}

function TerminalAnalyticsRoute() {
  return <TerminalAnalytics />;
}

type NavTabName = "Operations" | "Claims" | "Analytics" | "Vessels";

function devOnNav(navigate: ReturnType<typeof useNavigate>) {
  return (tab: NavTabName) =>
    navigate(tab === "Operations" ? "/" : tab === "Claims" ? "/claims" : tab === "Analytics" ? "/analytics" : "/vessels");
}

function DesignSystemRoute() {
  const navigate = useNavigate();
  return <DesignSystem onNav={devOnNav(navigate)} />;
}

function ComponentLibraryRoute() {
  const navigate = useNavigate();
  return <ComponentLibrary onNav={devOnNav(navigate)} />;
}

function ModalsRoute() {
  const navigate = useNavigate();
  return <Modals onNav={devOnNav(navigate)} />;
}

function ScreenFramesRoute() {
  const navigate = useNavigate();
  return <ScreenFrames onNav={devOnNav(navigate)} onRoute={() => navigate("/")} />;
}

function PrototypeConnectionsRoute() {
  const navigate = useNavigate();
  return <PrototypeConnections onNav={devOnNav(navigate)} onRoute={() => navigate("/")} />;
}

export default function App() {
  return (
    <AuthProvider>
      <AuthGate>
        <ShipmentsProvider>
          <BrowserRouter>
            <Routes>
              {/* Focused wizard flow */}
              <Route path="/shipments/new" element={<CreateShipmentForm />} />
              <Route path="/shipments/new/risk-check" element={<PreOpsRiskEngine />} />

              {/* Persistent shell */}
              <Route element={<Layout />}>
                <Route path="/" element={<Operations />} />
                <Route path="/shipments/:id" element={<ShipmentDetail />} />
                <Route path="/shipments/:id/sof" element={<SOFTimeline />} />

                <Route path="/claims" element={<ClaimsListRoute />} />
                <Route path="/claims/:claimId" element={<ClaimDetailRoute />} />
                <Route path="/claims/audit" element={<ClaimsAuditRoute />} />
                <Route path="/claims/new" element={<RedirectRoute to="/claims" />} />

                <Route path="/analytics" element={<CommercialIntelligenceRoute />} />
                <Route path="/analytics/terminal" element={<TerminalAnalyticsRoute />} />
                <Route path="/analytics/recommendations" element={<RedirectRoute to="/analytics" />} />

                <Route path="/vessels" element={<CargoRiskMonitor />} />
                <Route path="/vessels/new" element={<VesselCreateForm />} />
                <Route path="/vessels/:vesselId" element={<VesselDetail />} />

                <Route path="/deals" element={<RedirectRoute to="/analytics/terminal" />} />
                <Route path="/entities" element={<RedirectRoute to="/analytics/terminal" />} />
                <Route path="/vault" element={<RedirectRoute to="/analytics/terminal" />} />
                <Route path="/settings" element={<Settings />} />
              </Route>

              {/* Dev/spec pages */}
              <Route path="/dev/design-system" element={<DesignSystemRoute />} />
              <Route path="/dev/components" element={<ComponentLibraryRoute />} />
              <Route path="/dev/modals" element={<ModalsRoute />} />
              <Route path="/dev/screens" element={<ScreenFramesRoute />} />
              <Route path="/dev/prototype" element={<PrototypeConnectionsRoute />} />
            </Routes>
          </BrowserRouter>
        </ShipmentsProvider>
      </AuthGate>
    </AuthProvider>
  );
}
