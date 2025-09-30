import { EventEmitter } from 'events';
export interface BybitOrderData {
    symbol: string;
    side: 'Buy' | 'Sell';
    type: 'Market' | 'Limit';
    qty: number;
    price?: number;
    timeInForce?: 'GTC' | 'IOC' | 'FOK';
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
export declare class BybitConnector extends EventEmitter {
    private client;
    private logger;
    private rateLimiter;
    constructor(apiKey: string, apiSecret: string, testnet?: boolean);
    placeOrder(order: BybitOrderData): Promise<import("bybit-api").APIResponseV3WithTime<import("bybit-api").OrderResultV5>>;
    getBalance(): Promise<import("bybit-api").APIResponseV3WithTime<{
        list: import("bybit-api").WalletBalanceV5[];
    }>>;
    getTicker(symbol: string): Promise<{
        symbol: string;
        lastPrice: string;
        volume: string;
    }>;
    getServerTime(): Promise<string>;
    connect(): Promise<boolean>;
    getPositions(): Promise<{
        symbol: any;
        entryPrice: number;
        currentPrice: number;
        size: number;
        side: any;
        unrealizedPnL: number;
    }[]>;
    setLeverage(params: {
        symbol: string;
        leverage: string;
        category: 'linear' | 'inverse';
    }): Promise<import("bybit-api").APIResponseV3WithTime<{}>>;
    setMarginMode(params: {
        symbol: string;
        marginMode: string;
        category: 'linear' | 'inverse';
    }): Promise<import("bybit-api").APIResponseV3WithTime<{}>>;
    cancelOrder(symbol: string, orderId: string): Promise<import("bybit-api").APIResponseV3WithTime<import("bybit-api").OrderResultV5>>;
    getKlines(symbol: string, interval: string, limit?: number): Promise<KlineData[]>;
}
