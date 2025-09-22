import { DataCollector, MarketDataPoint } from '../market-data/data-collector';
import { FeatureVector } from '../market-data/indicators';
export interface CachedMarketData {
    timestamp: number;
    data: MarketDataPoint;
    features?: FeatureVector;
}
export interface CacheConfig {
    marketData: {
        ttl: number;
        prefix: string;
    };
    indicators: {
        ttl: number;
        prefix: string;
    };
    predictions: {
        ttl: number;
        prefix: string;
    };
}
export declare class CachedDataCollector {
    private dataCollector;
    private cacheConfig;
    constructor(dataCollector: DataCollector);
    /**
     * Get market snapshot with caching
     */
    getMarketSnapshot(): Promise<import("../market-data/data-collector").MarketSnapshot>;
    /**
     * Get cached historical data
     */
    getHistoricalData(symbol: string, count?: number): Promise<MarketDataPoint[]>;
    /**
     * Get cached latest data point
     */
    getLatestData(symbol: string): Promise<MarketDataPoint | null>;
    /**
     * Cache technical indicators
     */
    getCachedIndicators(symbol: string, data: MarketDataPoint[]): Promise<FeatureVector | null>;
    /**
     * Set cached indicators
     */
    setCachedIndicators(symbol: string, data: MarketDataPoint[], indicators: FeatureVector): Promise<void>;
    /**
     * Cache ML predictions
     */
    getCachedPrediction(symbol: string, inputHash: string): Promise<any | null>;
    /**
     * Set cached ML prediction
     */
    setCachedPrediction(symbol: string, inputHash: string, prediction: any): Promise<void>;
    /**
     * Invalidate cache for symbol
     */
    invalidateSymbolCache(symbol: string): Promise<void>;
    /**
     * Get cache statistics
     */
    getCacheStats(): import("./redis-service").CacheStats;
    /**
     * Start data collection using underlying collector
     */
    startCollection(): Promise<void>;
    /**
     * Stop data collection using underlying collector
     */
    stopCollection(): Promise<void>;
    /**
     * Get underlying data collector for non-cached operations
     */
    getDataCollector(): DataCollector;
    /**
     * Hash function for creating consistent cache keys
     */
    private createHash;
    /**
     * Create input hash for ML predictions
     */
    createPredictionInputHash(input: any): string;
    /**
     * Warm up cache with initial data
     */
    warmupCache(symbols: string[]): Promise<void>;
}
export default CachedDataCollector;
//# sourceMappingURL=cached-data-collector.d.ts.map