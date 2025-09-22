import { EventEmitter } from 'events';
import { ExchangeConnector } from '../exchanges/exchange-connector';
import { FeatureVector } from './indicators';
export interface MarketDataPoint {
    symbol: string;
    timestamp: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    features?: FeatureVector;
}
export interface DataBuffer {
    symbol: string;
    data: MarketDataPoint[];
    maxSize: number;
    lastUpdate: number;
}
export interface MarketSnapshot {
    timestamp: number;
    symbols: Map<string, MarketDataPoint>;
    features: Map<string, FeatureVector>;
}
export declare class DataCollector extends EventEmitter {
    private exchangeConnector;
    private indicators;
    private dataBuffers;
    private currentPrices;
    private isCollecting;
    private logger;
    private symbols;
    private intervals;
    private reconnectAttempts;
    private maxReconnectAttempts;
    private reconnectDelay;
    private healthCheckInterval?;
    private dataValidationErrors;
    private maxValidationErrors;
    private lastHealthCheckTime;
    private lastReconnectTime;
    constructor(exchangeConnector: ExchangeConnector, symbols?: string[]);
    private initializeBuffers;
    private setupEventHandlers;
    /**
     * Start collecting market data for all configured symbols
     */
    startCollection(): Promise<void>;
    /**
     * Stop collecting market data
     */
    stopCollection(): Promise<void>;
    private loadInitialData;
    private subscribeToRealTimeData;
    private startFallbackPolling;
    private processKlineData;
    private processTickerData;
    private addToBuffer;
    private validateKlineData;
    private handleReconnection;
    private startHealthCheck;
    private performHealthCheck;
    /**
     * Get latest market data for a symbol
     */
    getLatestData(symbol: string): MarketDataPoint | undefined;
    /**
     * Get historical data for a symbol
     */
    getHistoricalData(symbol: string, count?: number): MarketDataPoint[];
    /**
     * Get current market snapshot for all symbols
     */
    getMarketSnapshot(): MarketSnapshot;
    /**
     * Get current price for a symbol
     */
    getCurrentPrice(symbol: string): number | undefined;
    /**
     * Get current prices for all symbols
     */
    getAllCurrentPrices(): Map<string, number>;
    /**
     * Check if data collection is active
     */
    isCollectingData(): boolean;
    /**
     * Get buffer statistics
     */
    getBufferStats(): Map<string, {
        size: number;
        lastUpdate: number;
    }>;
    /**
     * Clear all data buffers
     */
    clearBuffers(): void;
}
//# sourceMappingURL=data-collector.d.ts.map