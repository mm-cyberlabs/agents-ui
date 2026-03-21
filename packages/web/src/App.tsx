import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useWs } from "./hooks/use-ws.js";
import { Dashboard } from "./pages/Dashboard.js";
import { SessionDetail } from "./pages/SessionDetail.js";
import { AllAgents } from "./pages/AllAgents.js";
import { ConfigPage } from "./pages/ConfigPage.js";
import { VersionBanner } from "./components/VersionBanner.js";
import { WaitingAlert } from "./components/WaitingAlert.js";

function getWsUrl(): string {
  // In dev, Vite proxies /ws to the server
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}/ws`;
}

export function App() {
  const { sessions, activity, connected } = useWs(getWsUrl());

  return (
    <BrowserRouter>
      <VersionBanner />
      <WaitingAlert sessions={sessions} />
      <Routes>
        <Route
          path="/"
          element={<Dashboard sessions={sessions} connected={connected} />}
        />
        <Route
          path="/session/:id"
          element={<SessionDetail sessions={sessions} activity={activity} />}
        />
        <Route
          path="/agents"
          element={<AllAgents sessions={sessions} activity={activity} />}
        />
        <Route path="/config" element={<ConfigPage />} />
      </Routes>
    </BrowserRouter>
  );
}
