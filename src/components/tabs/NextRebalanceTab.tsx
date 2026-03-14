import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle } from "../ui/Card";
import { useStatus } from "../../hooks/useDashboardQuery";
import { timeAgo } from "../../lib/utils";

export function NextRebalanceTab() {
  const { data: status } = useStatus();
  const nextRebalance = status?.feature_health?.next_rebalance_at;
  const lastRebalance = status?.feature_health?.last_rebalance;

  const [countdown, setCountdown] = useState("");

  useEffect(() => {
    if (!nextRebalance) return;
    function update() {
      const diff = new Date(nextRebalance!).getTime() - Date.now();
      if (diff <= 0) {
        setCountdown("Rebalance imminent!");
        return;
      }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setCountdown(`${h}h ${m}m ${s}s`);
    }
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [nextRebalance]);

  return (
    <div className="p-4 flex items-center justify-center min-h-[400px]">
      <Card className="text-center max-w-md w-full py-8">
        <CardHeader>
          <CardTitle>Next Rebalance</CardTitle>
        </CardHeader>
        <div className="text-4xl font-bold text-blue-400 my-4">
          {countdown || "—"}
        </div>
        <div className="text-xs text-gray-500 space-y-1">
          {nextRebalance && (
            <div>
              Scheduled:{" "}
              {new Date(nextRebalance).toLocaleString()}
            </div>
          )}
          {lastRebalance && (
            <div>Last rebalance: {timeAgo(lastRebalance)}</div>
          )}
        </div>
      </Card>
    </div>
  );
}
