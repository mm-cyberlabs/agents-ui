import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import type {
  InstalledConfig,
  InstalledAgent,
  InstalledSkill,
} from "@agents-ui/core/browser";

export function ConfigPage() {
  const [config, setConfig] = useState<InstalledConfig | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/config")
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => setConfig(data as InstalledConfig))
      .catch((err) => setError(String(err)));
  }, []);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <Link to="/" className="text-cyan-400 hover:underline text-sm">
            &larr; Back to Dashboard
          </Link>
          <h1 className="text-2xl font-bold text-cyan-400 mt-1">
            Configuration
          </h1>
          <p className="text-sm text-gray-500">
            Installed Claude Code agents and skills
          </p>
        </div>
      </div>

      {error && (
        <div className="text-center py-20 text-red-400">
          <p>Failed to load config: {error}</p>
        </div>
      )}

      {!config && !error && (
        <div className="text-center py-20 text-gray-600">
          <p>Loading configuration...</p>
        </div>
      )}

      {config && (
        <div className="space-y-10">
          {/* Agents Section */}
          <section>
            <h2 className="text-sm font-bold text-cyan-400 uppercase tracking-wider mb-4">
              Installed Agents
              <span className="text-gray-500 ml-2">
                ({config.agents.length})
              </span>
            </h2>
            {config.agents.length === 0 ? (
              <p className="text-gray-600 text-sm">No agents installed.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {config.agents.map((agent: InstalledAgent) => (
                  <div
                    key={agent.name}
                    className="bg-gray-800 border border-gray-700 rounded-lg p-4 hover:border-cyan-500/40 transition-colors"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-cyan-400 font-bold text-sm">
                        {agent.name}
                      </h3>
                    </div>
                    <p className="text-gray-400 text-xs mb-3">
                      {agent.description}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {agent.model && (
                        <span className="px-2 py-0.5 rounded text-xs bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                          {agent.model}
                        </span>
                      )}
                      {agent.memory && (
                        <span className="px-2 py-0.5 rounded text-xs bg-gray-700 text-gray-400 border border-gray-600">
                          memory: {agent.memory}
                        </span>
                      )}
                    </div>
                    <p className="text-gray-600 text-xs mt-3 truncate" title={agent.filePath}>
                      {agent.filePath}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Skills Section */}
          <section>
            <h2 className="text-sm font-bold text-yellow-400 uppercase tracking-wider mb-4">
              Installed Skills
              <span className="text-gray-500 ml-2">
                ({config.skills.length})
              </span>
            </h2>
            {config.skills.length === 0 ? (
              <p className="text-gray-600 text-sm">No skills installed.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {config.skills.map((skill: InstalledSkill) => (
                  <div
                    key={skill.name}
                    className="bg-gray-800 border border-gray-700 rounded-lg p-4 hover:border-yellow-500/40 transition-colors"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-yellow-400 font-bold text-sm">
                        {skill.name}
                      </h3>
                    </div>
                    <p className="text-gray-400 text-xs mb-3">
                      {skill.description}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {skill.agent && (
                        <span className="px-2 py-0.5 rounded text-xs bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                          agent: {skill.agent}
                        </span>
                      )}
                      {skill.context && (
                        <span className="px-2 py-0.5 rounded text-xs bg-gray-700 text-gray-400 border border-gray-600">
                          context: {skill.context}
                        </span>
                      )}
                    </div>
                    {skill.allowedTools && skill.allowedTools.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1">
                        {skill.allowedTools.map((tool) => (
                          <span
                            key={tool}
                            className="px-1.5 py-0.5 rounded text-xs bg-gray-700/50 text-gray-500 border border-gray-700"
                          >
                            {tool}
                          </span>
                        ))}
                      </div>
                    )}
                    <p className="text-gray-600 text-xs mt-3 truncate" title={skill.dirPath}>
                      {skill.dirPath}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
