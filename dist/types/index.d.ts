export type Trade = {
    id: string;
    symbol: string;
    quantity: number;
    price: number;
    timestamp: Date;
};
export type MarketData = {
    symbol: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    timestamp: Date;
};
export interface TradingSignal {
    symbol: string;
    side: 'BUY' | 'SELL' | 'CLOSE';
    quantity?: number;
    confidence: number;
    price?: number;
    stopLoss?: number;
    takeProfit?: number;
    expectedReturn?: number;
    winProbability?: number;
    timestamp: number;
    metadata?: {
        technicalConfidence?: number;
        mlAdjustment?: number;
        performanceAdjustment?: number;
        recentAccuracy?: number;
        [key: string]: any;
    };
}
export interface OrderRequest {
    symbol: string;
    side: 'BUY' | 'SELL';
    quantity: number;
    type: 'MARKET' | 'LIMIT' | 'STOP_LOSS' | 'TAKE_PROFIT';
    price?: number;
}
export interface StrategyConfig {
    name: string;
    parameters: Record<string, any>;
}
export interface Portfolio {
    totalValue: number;
    positions: Record<string, number>;
}
export interface RiskManagement {
    maxDrawdown: number;
    positionSizing: (portfolio: Portfolio) => number;
}
export interface TradeResult {
    success: boolean;
    orderId?: string;
    reason?: string;
    error?: Error;
    details?: {
        symbol: string;
        side: 'BUY' | 'SELL';
        quantity: number;
        price: number;
        type: 'MARKET' | 'LIMIT' | 'STOP_LOSS' | 'TAKE_PROFIT';
        timestamp: number;
    };
    positionSize?: number;
    price?: number;
    stopLoss?: number;
    takeProfit?: number;
    riskScore?: number;
    executedPrice?: number;
}
export type OrderType = 'MARKET' | 'LIMIT' | 'STOP_LOSS' | 'TAKE_PROFIT';
export interface Position {
    symbol: string;
    quantity: number;
    entryPrice: number;
    currentPrice: number;
    unrealizedPnL: number;
    timestamp: number;
}
