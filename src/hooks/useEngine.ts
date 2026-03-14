import { createContext, useContext } from "react";
import { ENGINES, type Engine } from "../config/engines";
import { ApiClient } from "../lib/api-client";

export interface EngineContextValue {
  engine: Engine;
  setEngineId: (id: string) => void;
  client: ApiClient;
}

export const EngineContext = createContext<EngineContextValue>({
  engine: ENGINES[0],
  setEngineId: () => {},
  client: new ApiClient(ENGINES[0].url),
});

export function useEngine() {
  return useContext(EngineContext);
}

export function getStoredEngineId(): string {
  try {
    return localStorage.getItem("engine_id") || ENGINES[0].id;
  } catch {
    return ENGINES[0].id;
  }
}

export function storeEngineId(id: string) {
  try {
    localStorage.setItem("engine_id", id);
  } catch {}
}
