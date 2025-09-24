import { EventEmitter } from 'events';
export interface OrderData {
    symbol: string;
    side: 'BUY' | 'SELL';
    type: 'MARKET' | 'LIMIT' | 'STOP_LOSS' | 'STOP_LOSS_LIMIT' | 'TAKE_PROFIT' | 'OCO';
    quantity: string;
    price?: string;
    stopPrice?: string;
    timeInForce?: 'GTC' | 'IOC' | 'FOK';
}
export interface PositionData {
    symbol: string;
    positionAmt: string;
    entryPrice: string;
    markPrice: string;
    unRealizedProfit: string;
    percentage: string;
}
export interface TickerData {
    symbol: string;
    price: string;
    change: string;
    changePercent: string;
    volume: string;
    quoteVolume: string;
}
export interface KlineData {
    symbol: string;
    openTime: number;
    closeTime: number;
    open: string;
    high: string;
    low: string;
    close: string;
    volume: string;
    trades: number;
}
export declare class ExchangeConnector extends EventEmitter {
    private client;
    private futuresClient;
    private wsConnections;
    private logger;
    private isConnected;
    private apiKey;
    private apiSecret;
    private testnet;
    private rateLimitCount;
    private rateLimitReset;
    constructor(apiKey: string, apiSecret: string, testnet?: boolean);
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    isConnectedToExchange(): boolean;
    getTickerPrice(symbol: string): Promise<TickerData>;
    getKlines(symbol: string, interval: string, limit?: number): Promise<KlineData[]>;
    getTickerData(symbol: string): Promise<TickerData | null>;
    placeOrder(orderData: OrderData): Promise<any>;
    placeOCOOrder(symbol: string, side: 'BUY' | 'SELL', quantity: string, price: string, stopPrice: string, stopLimitPrice: string): Promise<any>;
    cancelOrder(symbol: string, orderId: number): Promise<any>;
    getOpenOrders(symbol?: string): Promise<any[]>;
    getAccountInfo(): Promise<any>;
    subscribeToTicker(symbol: string): void;
    subscribeToKlines(symbol: string, interval: string): void;
    private subscribeToStream;
    /**
     * Get order status from exchange
     */
    getOrder(symbol: string, orderId: string | number): Promise<any>;
    private checkRateLimit;
    healthCheck(): Promise<{
        status: string;
        latency: number;
    }>;
}
