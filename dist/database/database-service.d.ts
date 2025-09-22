import { TradeRecord, PositionRecord, PerformanceMetrics, MarketDataRecord } from './database';
import { EventEmitter } from 'events';
export interface TradeExecutionResult {
    orderId: string | number;
    symbol: string;
    side: 'BUY' | 'SELL';
    size: number;
    price: number;
    executedPrice?: number;
    stopLoss?: number;
    takeProfit?: number;
    confidence: number;
    riskScore: number;
    status: 'FILLED' | 'FAILED' | 'CANCELLED';
    error?: string;
}
export declare class DatabaseService extends EventEmitter {
    private db;
    private isConnected;
    constructor(dbPath?: string);
    initialize(): Promise<void>;
    close(): Promise<void>;
    recordTradeExecution(result: TradeExecutionResult): Promise<string>;
    updateTradeStatus(tradeId: string, status: 'FILLED' | 'CANCELLED' | 'FAILED', pnl?: number): Promise<void>;
    updatePosition(symbol: string, currentPrice: number, trades: string[]): Promise<void>;
    saveMarketData(symbol: string, klineData: any): Promise<void>;
    calculateAndSavePerformanceMetrics(): Promise<PerformanceMetrics>;
    private calculateMaxDrawdown;
    private calculateMaxDrawdownPercent;
    private calculateSharpeRatio;
    private calculateProfitFactor;
    getTradeHistory(symbol?: string, limit?: number): TradeRecord[];
    getPositionHistory(): PositionRecord[];
    getPerformanceHistory(): PerformanceMetrics[];
    getMarketDataForTraining(symbol: string, limit?: number): MarketDataRecord[];
    isHealthy(): boolean;
    getTrades(symbol?: string, limit?: number): Promise<TradeRecord[]>;
    getPerformance(): Promise<PerformanceMetrics[]>;
    getStatistics(): {
        totalTrades: number;
        activeTrades: number;
        filledTrades: number;
        failedTrades: number;
        totalPositions: number;
        openPositions: number;
        totalPnL: number;
        realizedPnL: number;
        unrealizedPnL: number;
        winRate: number;
        lastPerformanceUpdate: number | undefined;
    };
}
