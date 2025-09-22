import { BaseStrategy } from './base-strategy';
import { FeatureVector } from '../market-data/indicators';
import { TradeSignal } from '../portfolio/risk-manager';
export interface MovingAverageConfig {
    fastPeriod: number;
    slowPeriod: number;
    confirmationPeriod: number;
    minConfidence: number;
}
export declare class MovingAverageCrossoverStrategy extends BaseStrategy {
    private config;
    private lastSignal;
    private signalCount;
    constructor(config?: MovingAverageConfig);
    /**
     * Generate trading signals based on moving average crossover
     */
    generateSignals(features: FeatureVector[]): TradeSignal[];
    private calculateConfidence;
    private calculateStopLoss;
    private calculateTakeProfit;
    private estimateExpectedReturn;
    private estimateWinProbability;
    evaluatePerformance(trades: any[]): any;
}
//# sourceMappingURL=moving-average-crossover.d.ts.map