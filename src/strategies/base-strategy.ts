export class BaseStrategy {
    generateSignals(marketData: any): any {
        throw new Error("Method not implemented.");
    }

    evaluatePerformance(trades: any[]): any {
        const performance: {
            totalTrades: number;
            winningTrades: number;
            losingTrades: number;
            totalProfit: number;
            totalLoss: number;
            winRate?: number;
            profitFactor?: number;
        } = {
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
            } else {
                performance.losingTrades++;
                performance.totalLoss += Math.abs(profit);
            }
        });

        performance.winRate = performance.winningTrades / performance.totalTrades;
        performance.profitFactor = performance.totalProfit / performance.totalLoss;

        return performance;
    }
}