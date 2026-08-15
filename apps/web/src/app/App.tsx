import { BrowserRouter, Routes, Route, useNavigate } from "react-router";
import { ShipmentsProvider } from "./data/ShipmentsContext";

import Layout from "./Layout";
import Operations from "./Operations";
import ShipmentDetail from "./ShipmentDetail";
import SOFTimeline from "./SOFTimeline";
import ClaimsList from "./ClaimsList";
import ClaimsAuditConsole from "./ClaimsAuditConsole";
import GenerateClaim from "./GenerateClaim";
import CommercialIntelligence from "./CommercialIntelligence";
import TerminalAnalytics from "./TerminalAnalytics";
import RecommendationsEngine from "./RecommendationsEngine";
import DealTemplateLibrary from "./DealTemplateLibrary";
import EntityDirectory from "./EntityDirectory";
import DocumentVault from "./DocumentVault";
import CargoRiskMonitor from "./CargoRiskMonitor";
import Settings from "./Settings";
import CreateShipmentForm from "./CreateShipmentForm";
import PreOpsRiskEngine from "./PreOpsRiskEngine";

import DesignSystem from "./DesignSystem";
import ComponentLibrary from "./ComponentLibrary";
import Modals from "./Modals";
import ScreenFrames from "./ScreenFrames";
import PrototypeConnections from "./PrototypeConnections";

// ─── Route wrapper components ──────────────────────────────────────────────
// These screens still take explicit callback props (rather than calling
// useNavigate internally), so each gets a thin wrapper here that supplies
// the right navigation target for its route.

function ClaimsListRoute() {
  const navigate = useNavigate();
  return (
    <ClaimsList
      onOpenAudit={() => navigate("/claims/audit")}
      onNewClaim={() => navigate("/claims/new")}
    />
  );
}

function ClaimsAuditRoute() {
  const navigate = useNavigate();
  return (
    <ClaimsAuditConsole
      onGenerateReport={() => navigate("/claims/new")}
      onSaveForReview={() => navigate("/claims")}
    />
  );
}

function GenerateClaimRoute() {
  const navigate = useNavigate();
  return <GenerateClaim onComplete={() => navigate("/claims")} />;
}

function CommercialIntelligenceRoute() {
  const navigate = useNavigate();
  return <CommercialIntelligence onTerminal={() => navigate("/analytics/terminal")} />;
}

function TerminalAnalyticsRoute() {
  const navigate = useNavigate();
  return <TerminalAnalytics onDealTemplates={() => navigate("/deals")} />;
}

function RecommendationsEngineRoute() {
  const navigate = useNavigate();
  return <RecommendationsEngine onAddToClaim={() => navigate("/claims/new")} />;
}

function DealTemplateLibraryRoute() {
  const navigate = useNavigate();
  return (
    <DealTemplateLibrary
      onEntities={() => navigate("/entities")}
      onVault={() => navigate("/vault")}
      onUseTemplate={() => navigate("/shipments/new")}
    />
  );
}

// Dev/scaffold screens (Figma Make spec pages) — intentionally NOT linked
// from the primary nav. Reachable only by direct URL under /dev/*, matching
// how a real build would keep design-system/reference pages out of the
// production nav without deleting them outright.
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
    <ShipmentsProvider>
      <BrowserRouter>
        <Routes>
        {/* ── Focused wizard flow: no persistent shell, matches modal/wizard UX ── */}
        <Route path="/shipments/new" element={<CreateShipmentForm />} />
        <Route path="/shipments/new/risk-check" element={<PreOpsRiskEngine />} />

        {/* ── Everything else lives inside the persistent shell ── */}
        <Route element={<Layout />}>
          <Route path="/" element={<Operations />} />
          <Route path="/shipments/:id" element={<ShipmentDetail />} />
          <Route path="/shipments/:id/sof" element={<SOFTimeline />} />

          <Route path="/claims" element={<ClaimsListRoute />} />
          <Route path="/claims/audit" element={<ClaimsAuditRoute />} />
          <Route path="/claims/new" element={<GenerateClaimRoute />} />

          <Route path="/analytics" element={<CommercialIntelligenceRoute />} />
          <Route path="/analytics/terminal" element={<TerminalAnalyticsRoute />} />
          <Route path="/analytics/recommendations" element={<RecommendationsEngineRoute />} />

          <Route path="/vessels" element={<CargoRiskMonitor />} />

          <Route path="/deals" element={<DealTemplateLibraryRoute />} />
          <Route path="/entities" element={<EntityDirectory />} />
          <Route path="/vault" element={<DocumentVault />} />
          <Route path="/settings" element={<Settings />} />
        </Route>

        {/* ── Dev/spec pages — unlinked from primary nav, direct URL only ── */}
        <Route path="/dev/design-system" element={<DesignSystemRoute />} />
        <Route path="/dev/components" element={<ComponentLibraryRoute />} />
        <Route path="/dev/modals" element={<ModalsRoute />} />
        <Route path="/dev/screens" element={<ScreenFramesRoute />} />
        <Route path="/dev/prototype" element={<PrototypeConnectionsRoute />} />
      </Routes>
    </BrowserRouter>
    </ShipmentsProvider>
  );
}
