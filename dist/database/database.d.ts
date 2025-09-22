import { EventEmitter } from 'events';
export interface TradeRecord {
    id: string;
    timestamp: number;
    symbol: string;
    side: 'BUY' | 'SELL';
    type: 'MARKET' | 'LIMIT' | 'STOP_LOSS' | 'TAKE_PROFIT';
    quantity: number;
    price: number;
    executedPrice?: number;
    orderId?: string | number;
    status: 'PENDING' | 'FILLED' | 'CANCELLED' | 'FAILED';
    fees?: number;
    commission?: number;
    stopLoss?: number;
    takeProfit?: number;
    confidence: number;
    riskScore: number;
    pnl?: number;
    strategy?: string;
    metadata?: any;
}
export interface PositionRecord {
    id: string;
    symbol: string;
    side: 'LONG' | 'SHORT';
    size: number;
    entryPrice: number;
    currentPrice: number;
    unrealizedPnL: number;
    realizedPnL: number;
    timestamp: number;
    trades: string[];
}
export interface PerformanceMetrics {
    totalTrades: number;
    winningTrades: number;
    losingTrades: number;
    winRate: number;
    totalPnL: number;
    maxDrawdown: number;
    maxDrawdownPercent: number;
    sharpeRatio: number;
    averageWin: number;
    averageLoss: number;
    profitFactor: number;
    timestamp: number;
}
export interface MarketDataRecord {
    id: string;
    symbol: string;
    timestamp: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    indicators?: {
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
}
export declare class Database extends EventEmitter {
    private dbPath;
    private trades;
    private positions;
    private marketData;
    private performanceHistory;
    private isInitialized;
    constructor(dbPath?: string);
    initialize(): Promise<void>;
    private loadData;
    private fileExists;
    saveTrade(trade: TradeRecord): Promise<void>;
    updateTrade(id: string, updates: Partial<TradeRecord>): Promise<void>;
    getTrade(id: string): TradeRecord | undefined;
    getAllTrades(): TradeRecord[];
    getTradesBySymbol(symbol: string): TradeRecord[];
    getTradesInRange(startTime: number, endTime: number): TradeRecord[];
    savePosition(position: PositionRecord): Promise<void>;
    updatePosition(id: string, updates: Partial<PositionRecord>): Promise<void>;
    getPosition(id: string): PositionRecord | undefined;
    getAllPositions(): PositionRecord[];
    getOpenPositions(): PositionRecord[];
    savePerformanceMetrics(metrics: PerformanceMetrics): Promise<void>;
    getLatestPerformance(): PerformanceMetrics | undefined;
    getPerformanceHistory(): PerformanceMetrics[];
    saveMarketData(data: MarketDataRecord): Promise<void>;
    getMarketData(symbol: string, limit?: number): MarketDataRecord[];
    calculateProfitLoss(): {
        totalPnL: number;
        realizedPnL: number;
        unrealizedPnL: number;
    };
    calculateWinRate(): number;
    private persistTrades;
    private persistPositions;
    private persistPerformance;
    private persistMarketData;
    close(): Promise<void>;
}
//# sourceMappingURL=database.d.ts.map