import { Card, CardHeader, CardTitle } from "../ui/Card";
import { Badge } from "../ui/Badge";
import { useRiskModel } from "../../hooks/useDashboardQuery";

/**
 * Layer 3: Portfolio Optimizer.
 *
 * This tab is the placeholder for the upcoming optimizer (Phase 3 of the
 * three-layer refactor). When `strategy/optimizer.py` lands, this view will
 * show:
 *   - Optimal vs actual weights
 *   - Constraint binding (leverage, net exposure, sector caps)
 *   - Marginal position value curve (the value of the Nth position)
 *   - N sensitivity table
 *
 * For now it surfaces the cached RiskSnapshot summary so the tab is not empty,
 * and explains the deferred state.
 */
export function OptimizerTab() {
  const { data: risk } = useRiskModel();

  return (
    <div className="p-4 space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Portfolio Optimizer</CardTitle>
        </CardHeader>
        <div className="text-sm text-gray-400 leading-relaxed">
          <strong className="text-gray-300">Layer 3 — Portfolio Optimizer.</strong>{" "}
          The current selection logic (rank_longs / rank_shorts / compute_target_portfolio)
          stays in place. Phase 3 of the three-layer refactor will merge them into a single
          <code className="mx-1 px-1 rounded bg-gray-900 text-gray-300">optimize_portfolio()</code>
          entry point that:
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>Reads from the Layer 1 alpha model (full universe scoring)</li>
            <li>Reads from the Layer 2 risk model (cached snapshot)</li>
            <li>Returns optimal weights + binding constraints + marginal position value</li>
            <li>Determines optimal N as an output, not a config parameter</li>
          </ul>
          <div className="mt-3 text-xs text-gray-500">
            Until Phase 3 lands, this tab shows the cached risk snapshot summary as a
            sanity check. Use the <strong>Construction</strong> tab for live target weights
            and the <strong>Risk Model</strong> tab for per-token risk metrics.
          </div>
        </div>
      </Card>

      {risk?.available && (
        <Card>
          <CardHeader>
            <CardTitle>Current Risk Snapshot</CardTitle>
          </CardHeader>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">
                Avg Long β
              </div>
              <div className="text-lg font-semibold text-gray-200 font-mono">
                {risk.avg_long_beta.toFixed(3)}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">
                Avg Short β
              </div>
              <div className="text-lg font-semibold text-gray-200 font-mono">
                {risk.avg_short_beta.toFixed(3)}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">
                Universe
              </div>
              <div className="text-lg font-semibold text-gray-200">
                {risk.n_symbols}{" "}
                <span className="text-xs text-gray-500 font-normal">
                  ({risk.active_longs.length}L / {risk.short_basket.length}S)
                </span>
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">
                Beta Symmetry
              </div>
              <div className="text-lg font-semibold font-mono">
                <Badge
                  variant={
                    Math.abs(risk.avg_long_beta - risk.avg_short_beta) < 0.1
                      ? "success"
                      : Math.abs(risk.avg_long_beta - risk.avg_short_beta) < 0.25
                      ? "warning"
                      : "danger"
                  }
                >
                  Δβ {Math.abs(risk.avg_long_beta - risk.avg_short_beta).toFixed(3)}
                </Badge>
              </div>
            </div>
          </div>
          <div className="mt-3 text-xs text-gray-600">
            The L/S budget split is sized so the long-book beta (vs the long basket) equals
            the short-book beta. Δβ is the residual after sizing — should be near zero when
            the basket is balanced.
          </div>
        </Card>
      )}
    </div>
  );
}
