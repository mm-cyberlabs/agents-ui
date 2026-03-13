import { useState, useEffect } from "react";

interface VersionInfo {
  currentCommit: string;
  latestCommit: string | null;
  updateAvailable: boolean;
}

export function VersionBanner() {
  const [version, setVersion] = useState<VersionInfo | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch("/api/version");
        if (res.ok) {
          const data: VersionInfo = await res.json();
          setVersion(data);
        }
      } catch {
        // ignore
      }
    };
    check();
    const interval = setInterval(check, 60 * 1000); // check every minute
    return () => clearInterval(interval);
  }, []);

  if (!version || !version.updateAvailable || dismissed) return null;

  return (
    <div className="bg-cyan-600/90 text-white text-center py-2 px-4 text-sm font-medium flex items-center justify-center gap-3 sticky top-0 z-[100]">
      <span>
        A new version of agents-ui is available.
        Run <code className="bg-black/20 px-1.5 py-0.5 rounded font-mono text-xs">agents-ui setup</code> to update.
      </span>
      <button
        onClick={() => setDismissed(true)}
        className="text-white/70 hover:text-white text-lg leading-none ml-2"
      >
        &times;
      </button>
    </div>
  );
}
