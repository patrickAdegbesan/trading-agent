import { EventEmitter } from 'events';
export interface OrderData {
    symbol: string;
    side: 'BUY' | 'SELL';
    type: 'MARKET' | 'LIMIT' | 'STOP_LOSS' | 'STOP_LOSS_LIMIT' | 'TAKE_PROFIT' | 'OCO';
    quantity: string;
    price?: string;
    stopPrice?: string;
    timeInForce?: 'GTC' | 'IOC' | 'FOK';
    reduceOnly?: boolean;
    closeOnTrigger?: boolean;
    triggerPrice?: string;
    triggerDirection?: 'ABOVE' | 'BELOW';
    category?: 'spot' | 'linear' | 'inverse';
}
export interface PositionData {
    symbol: string;
    positionAmt: string;
    entryPrice: string;
    markPrice: string;
    unRealizedProfit: string;
    percentage: string;
    leverage: number;
    marginType: string;
    isolatedMargin?: string;
    liquidationPrice?: string;
}
export interface TickerData {
    symbol: string;
    price?: string;
    lastPrice?: string;
    change: string;
    changePercent: string;
    volume: string;
    quoteVolume?: string;
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
    private bybitConnector?;
    private readonly isUsingBybit;
    private priceCache;
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
    getBalance(): Promise<any>;
    getPositions(): Promise<PositionData[]>;
    setLeverage(symbol: string, leverage: number): Promise<void>;
    setMarginType(symbol: string, marginType: 'ISOLATED' | 'CROSSED'): Promise<void>;
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
    getCurrentPrice(symbol: string): number;
}
