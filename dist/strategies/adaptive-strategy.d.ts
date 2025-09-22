import { BaseStrategy } from './base-strategy';
export declare class AdaptiveStrategy extends BaseStrategy {
    private marketConditions;
    constructor();
    generateSignals(marketData: any): any;
    evaluatePerformance(trades: any[]): any;
    private updateMarketConditions;
    private calculateVolatility;
    private detectTrend;
    private dynamicSignalGeneration;
}
//# sourceMappingURL=adaptive-strategy.d.ts.map