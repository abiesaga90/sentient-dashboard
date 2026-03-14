import { useEngine } from "../../hooks/useEngine";
import { ENGINES } from "../../config/engines";
import { Badge } from "../ui/Badge";
import type { StatusResponse } from "../../types/api";

interface HeaderProps {
  status?: StatusResponse;
}

export function Header({ status }: HeaderProps) {
  const { engine, setEngineId } = useEngine();

  return (
    <header className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--bg-card)] px-4 py-3">
      <div className="flex items-center gap-3">
        <h1 className="text-base font-semibold text-gray-100">
          Sentient Advisory
        </h1>
        {status && (
          <Badge variant={status.status === "ok" ? "success" : "danger"}>
            {status.strategy_name}
          </Badge>
        )}
        {status && (
          <span className="text-xs text-gray-500">
            {status.execution_mode}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        {ENGINES.map((e) => (
          <button
            key={e.id}
            onClick={() => setEngineId(e.id)}
            className={`px-3 py-1 text-xs rounded-md transition-colors ${
              engine.id === e.id
                ? "bg-blue-600 text-white"
                : "bg-gray-800 text-gray-400 hover:text-gray-200"
            }`}
          >
            {e.label}
          </button>
        ))}
      </div>
    </header>
  );
}
