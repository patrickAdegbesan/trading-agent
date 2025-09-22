import { BaseStrategy } from '../strategies/base-strategy';
import { RiskManager } from '../portfolio/risk-manager';
import { ExchangeConnector } from '../exchanges/exchange-connector';
export interface BacktestConfig {
    startDate: string;
    endDate: string;
    initialCapital: number;
    symbols: string[];
    walkForwardPeriod: number;
    trainingPeriod: number;
    commission: number;
    slippage: number;
}
export interface BacktestResult {
    totalReturn: number;
    sharpeRatio: number;
    maxDrawdown: number;
    winRate: number;
    totalTrades: number;
    avgTradeReturn: number;
    profitFactor: number;
    calmarRatio: number;
    trades: Trade[];
    equityCurve: EquityPoint[];
    monthlyReturns: MonthlyReturn[];
}
export interface Trade {
    symbol: string;
    entryTime: number;
    exitTime: number;
    entryPrice: number;
    exitPrice: number;
    quantity: number;
    side: 'BUY' | 'SELL';
    pnl: number;
    commission: number;
    slippage: number;
    duration: number;
    maxFavorableExcursion: number;
    maxAdverseExcursion: number;
}
export interface EquityPoint {
    timestamp: number;
    equity: number;
    drawdown: number;
}
export interface MonthlyReturn {
    year: number;
    month: number;
    return: number;
}
export declare class BacktestEngine {
    private strategy;
    private indicators;
    private riskManager;
    private config;
    constructor(strategy: BaseStrategy, config: BacktestConfig, riskManager?: RiskManager);
    /**
     * Run walk-forward backtest
     */
    runBacktest(exchangeConnector: ExchangeConnector): Promise<BacktestResult>;
    private getHistoricalData;
    private runWalkForwardAnalysis;
    private openPosition;
    private closePosition;
    private calculateUnrealizedPnL;
    private combineResults;
    private calculateFinalMetrics;
    /**
     * Generate detailed backtest report
     */
    generateReport(results: BacktestResult): string;
    private generateInsights;
}
//# sourceMappingURL=backtest-engine.d.ts.map