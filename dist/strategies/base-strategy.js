"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseStrategy = void 0;
class BaseStrategy {
    generateSignals(marketData) {
        throw new Error("Method not implemented.");
    }
    evaluatePerformance(trades) {
        const performance = {
            totalTrades: trades.length,
            winningTrades: 0,
            losingTrades: 0,
            totalProfit: 0,
            totalLoss: 0
        };
        trades.forEach(trade => {
            const profit = trade.exitPrice - trade.entryPrice;
            if (profit > 0) {
                performance.winningTrades++;
                performance.totalProfit += profit;
            }
            else {
                performance.losingTrades++;
                performance.totalLoss += Math.abs(profit);
            }
        });
        performance.winRate = performance.winningTrades / performance.totalTrades;
        performance.profitFactor = performance.totalProfit / performance.totalLoss;
        return performance;
    }
}
exports.BaseStrategy = BaseStrategy;
//# sourceMappingURL=base-strategy.js.map