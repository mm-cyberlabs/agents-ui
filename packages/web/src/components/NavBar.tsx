import { useState, useCallback } from "react";
import { Link, useLocation } from "react-router-dom";

const TABS = [
  { path: "/", label: "Dashboard" },
  { path: "/agents", label: "All Agents" },
  { path: "/config", label: "Config" },
];

interface Props {
  connected: boolean;
  onRefresh: () => Promise<void>;
}

export function NavBar({ connected, onRefresh }: Props) {
  const location = useLocation();
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await onRefresh();
    // Brief delay so the user sees the feedback
    setTimeout(() => setRefreshing(false), 600);
  }, [onRefresh]);

  // Highlight the active tab — session detail pages highlight Dashboard
  const activePath = TABS.find((t) => t.path === location.pathname)?.path
    ?? (location.pathname.startsWith("/session/") ? "/" : "");

  return (
    <nav className="border-b border-gray-800 bg-gray-950/80 backdrop-blur-sm sticky top-0 z-40">
      <div className="flex items-center justify-between px-6 h-12">
        {/* Left: brand + tabs */}
        <div className="flex items-center gap-6">
          <Link to="/" className="text-lg font-bold text-cyan-400 shrink-0">
            agents-ui
          </Link>
          <div className="flex items-center gap-1">
            {TABS.map((tab) => (
              <Link
                key={tab.path}
                to={tab.path}
                className={`px-3 py-1.5 text-sm rounded transition-colors ${
                  activePath === tab.path
                    ? "bg-cyan-500/15 text-cyan-300"
                    : "text-gray-400 hover:text-white hover:bg-gray-800"
                }`}
              >
                {tab.label}
              </Link>
            ))}
          </div>
        </div>

        {/* Right: refresh + connection */}
        <div className="flex items-center gap-4">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className={`flex items-center gap-1.5 px-3 py-1 text-sm rounded border transition-all ${
              refreshing
                ? "bg-cyan-500/20 border-cyan-500/40 text-cyan-400"
                : "bg-gray-800 border-gray-700 text-gray-400 hover:text-white hover:border-gray-600"
            }`}
            title="Re-scan sessions and refresh statuses"
          >
            <span className={refreshing ? "animate-spin" : ""}>↻</span>
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
          <div className="flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full ${connected ? "bg-green-400" : "bg-red-400"}`}
            />
            <span className="text-xs text-gray-500">
              {connected ? "Connected" : "Disconnected"}
            </span>
          </div>
        </div>
      </div>
    </nav>
  );
}
