import { PredictionEngine, PredictionInput } from '../ml/prediction-engine';
import { TradingSignal } from '../types';
import { CachedDataCollector } from './cached-data-collector';
export interface CachedPredictionMetrics {
    cacheHits: number;
    cacheMisses: number;
    avgResponseTime: number;
    totalPredictions: number;
}
export declare class CachedPredictionEngine {
    private predictionEngine;
    private cachedDataCollector;
    private metrics;
    constructor(predictionEngine: PredictionEngine, cachedDataCollector: CachedDataCollector);
    /**
     * Generate signal with caching
     */
    generateSignal(input: PredictionInput): Promise<TradingSignal | null>;
    /**
     * Get performance statistics from underlying prediction engine
     */
    getPerformanceStats(): {
        [symbol: string]: any;
    };
    /**
     * Get caching metrics
     */
    getCacheMetrics(): CachedPredictionMetrics;
    /**
     * Get combined performance metrics
     */
    getDetailedMetrics(): {
        cache: {
            hitRate: number;
            redisStats: import("./redis-service").CacheStats;
            cacheHits: number;
            cacheMisses: number;
            avgResponseTime: number;
            totalPredictions: number;
        };
        performance: {
            [symbol: string]: any;
        };
    };
    /**
     * Clear prediction cache for a symbol
     */
    clearSymbolCache(symbol: string): Promise<void>;
    /**
     * Clear all prediction cache
     */
    clearAllCache(): Promise<void>;
    /**
     * Precompute and cache predictions for multiple inputs
     */
    precomputePredictions(inputs: PredictionInput[]): Promise<void>;
    /**
     * Create a hash for the prediction input to use as cache key
     */
    private createInputHash;
    /**
     * Update caching metrics
     */
    private updateMetrics;
    /**
     * Get the underlying prediction engine for direct access
     */
    getPredictionEngine(): PredictionEngine;
}
export default CachedPredictionEngine;
//# sourceMappingURL=cached-prediction-engine.d.ts.map