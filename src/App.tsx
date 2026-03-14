import { useState, useMemo } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ENGINES } from "./config/engines";
import { ApiClient } from "./lib/api-client";
import {
  EngineContext,
  getStoredEngineId,
  storeEngineId,
} from "./hooks/useEngine";
import { LandingPage } from "./pages/LandingPage";
import { LiveDashboard } from "./pages/LiveDashboard";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      refetchOnWindowFocus: true,
    },
  },
});

function App() {
  const [engineId, setEngineIdState] = useState(getStoredEngineId);

  const engine = useMemo(
    () => ENGINES.find((e) => e.id === engineId) || ENGINES[0],
    [engineId]
  );

  const client = useMemo(() => new ApiClient(engine.url), [engine]);

  function setEngineId(id: string) {
    storeEngineId(id);
    setEngineIdState(id);
    // Invalidate all queries when switching engine
    queryClient.invalidateQueries();
  }

  return (
    <QueryClientProvider client={queryClient}>
      <EngineContext.Provider value={{ engine, setEngineId, client }}>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/live" element={<LiveDashboard />} />
          </Routes>
        </BrowserRouter>
      </EngineContext.Provider>
    </QueryClientProvider>
  );
}

export default App;
