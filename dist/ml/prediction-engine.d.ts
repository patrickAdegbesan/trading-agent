import { DatabaseService } from '../database/database-service';
import { TradingSignal } from '../types';
import { MarketDataPoint } from '../market-data/data-collector';
export interface PredictionInput {
    symbol: string;
    currentPrice: number;
    priceHistory: number[];
    volume: number;
    indicators: {
        rsi?: number;
        macd?: {
            macd: number;
            signal: number;
            histogram: number;
        };
        bollinger?: {
            upper: number;
            middle: number;
            lower: number;
        };
        ma20?: number;
        ma50?: number;
    };
    marketData: MarketDataPoint[];
}
export interface MLModelPerformance {
    accuracy: number;
    precision: number;
    recall: number;
    f1Score: number;
    lastUpdated: number;
    trainingDataSize: number;
}
export declare class PredictionEngine {
    private databaseService?;
    private modelPerformance;
    private confidenceAdjustment;
    private recentPredictionAccuracy;
    constructor(databaseService?: DatabaseService);
    private initializeConfidenceTracking;
    /**
     * Generate intelligent trading signals using ML-enhanced predictions
     */
    generateSignal(input: PredictionInput): TradingSignal | null;
    /**
     * Calculate technical indicators-based trading signal
     */
    private calculateTechnicalSignal;
    /**
     * Apply ML-enhanced confidence scoring based on historical performance
     */
    private calculateMLConfidence;
    /**
     * Apply performance-based adjustments to confidence
     */
    private applyPerformanceAdjustment;
    /**
     * Estimate expected return based on historical data and market conditions
     */
    private estimateExpectedReturn;
    /**
     * Estimate win probability based on historical performance
     */
    private estimateWinProbability;
    /**
     * Calculate dynamic stop loss based on volatility and recent performance
     */
    private calculateDynamicStopLoss;
    /**
     * Calculate dynamic take profit based on risk-reward ratio and confidence
     */
    private calculateDynamicTakeProfit;
    /**
     * Update model performance based on actual trade results
     */
    updatePerformanceMetrics(symbol: string, predictedSuccess: boolean, actualSuccess: boolean): void;
    /**
     * Get recent prediction accuracy for a symbol
     */
    private getRecentAccuracy;
    /**
     * Log prediction for later evaluation
     */
    private logPrediction;
    /**
     * Set database service for historical data access
     */
    setDatabaseService(databaseService: DatabaseService): void;
    /**
     * Get model performance statistics
     */
    getPerformanceStats(): {
        [symbol: string]: any;
    };
}
//# sourceMappingURL=prediction-engine.d.ts.map