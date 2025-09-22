import { EventEmitter } from 'events';
import { TradingConfig } from '../config/settings';
import { Portfolio } from '../types';
export interface PositionInfo {
    symbol: string;
    size: number;
    entryPrice: number;
    currentPrice: number;
    unrealizedPnL: number;
    side: 'LONG' | 'SHORT';
    timestamp: number;
}
export interface PortfolioMetrics {
    totalValue: number;
    totalPnL: number;
    dailyPnL: number;
    maxDrawdown: number;
    currentDrawdown: number;
    sharpeRatio: number;
    winRate: number;
    totalTrades: number;
    openPositions: number;
}
export interface RiskLimits {
    maxPositionSize: number;
    maxDailyDrawdown: number;
    maxTotalDrawdown: number;
    maxCorrelation: number;
    maxLeverage: number;
    maxTradesPerDay: number;
    kellyFraction: number;
}
export interface TradeSignal {
    symbol: string;
    side: 'BUY' | 'SELL';
    confidence: number;
    stopLoss?: number;
    takeProfit?: number;
    expectedReturn?: number;
    winProbability?: number;
    timestamp: number;
}
export interface RiskAssessment {
    approved: boolean;
    positionSize: number;
    reason?: string;
    adjustedSignal?: TradeSignal;
    riskScore: number;
}
export declare class RiskManager extends EventEmitter {
    private positions;
    private tradeHistory;
    private dailyTrades;
    private dailyPnL;
    private startOfDayTimestamp;
    private portfolioValue;
    private initialValue;
    private maxPortfolioValue;
    private circuitBreakerTriggered;
    private correlationMatrix;
    private readonly limits;
    constructor(initialCapital: number, config?: TradingConfig);
    /**
     * Evaluate position size based on risk parameters
     */
    evaluatePosition(params: {
        symbol: string;
        confidence: number;
        portfolio: Portfolio;
    }): Promise<number>;
    /**
     * Main risk assessment method - analyzes trade signal and returns risk decision
     */
    assessTradeRisk(signal: TradeSignal, currentPrice: number): RiskAssessment;
    /**
     * Kelly Criterion position sizing with robust error handling
     */
    private calculateKellyPositionSize;
    /**
     * Fallback position sizing when Kelly calculation fails
     */
    private calculateFallbackPositionSize;
    private performBasicRiskChecks;
    private checkPortfolioConcentration;
    private checkCorrelationRisk;
    private calculateRiskScore;
    getPortfolioValue(): number;
    getPositions(): Map<string, PositionInfo>;
    isCircuitBreakerActive(): boolean;
    getTradeHistory(): any[];
    getRiskLimits(): RiskLimits;
    private estimateWinProbability;
    private getHistoricalAvgWin;
    private getHistoricalAvgLoss;
    private calculateStopLoss;
    private calculateTakeProfit;
    private getHighlyCorrelatedPositions;
    private triggerCircuitBreaker;
    /**
     * Manually reset the circuit breaker
     * Should only be used after resolving the underlying issue
     */
    resetCircuitBreaker(): void;
    private checkAndResetDaily;
    private getStartOfDay;
}
