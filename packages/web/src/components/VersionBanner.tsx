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
    const interval = setInterval(check, 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  if (!version || !version.updateAvailable || dismissed) return null;

  return (
    <div className="bg-gradient-to-r from-amber-500 to-yellow-500 text-gray-950 text-center py-2.5 px-4 text-sm font-semibold flex items-center justify-center gap-3 sticky top-0 z-[100] shadow-lg shadow-amber-500/20">
      <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
      </svg>
      <span>
        A new version of agents-ui is available.
        Run <code className="bg-black/10 px-1.5 py-0.5 rounded font-mono text-xs">agents-ui update</code> to update.
      </span>
      <button
        onClick={() => setDismissed(true)}
        className="text-gray-950/50 hover:text-gray-950 text-lg leading-none ml-2 transition-colors"
      >
        &times;
      </button>
    </div>
  );
}
