"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CachedPredictionEngine = void 0;
const redis_service_1 = require("./redis-service");
const crypto_1 = __importDefault(require("crypto"));
class CachedPredictionEngine {
    constructor(predictionEngine, cachedDataCollector) {
        this.metrics = {
            cacheHits: 0,
            cacheMisses: 0,
            avgResponseTime: 0,
            totalPredictions: 0
        };
        this.predictionEngine = predictionEngine;
        this.cachedDataCollector = cachedDataCollector;
    }
    /**
     * Generate signal with caching
     */
    async generateSignal(input) {
        const startTime = Date.now();
        try {
            // Create cache key based on input parameters
            const inputHash = this.createInputHash(input);
            const cacheKey = `signal:${input.symbol}:${inputHash}`;
            const cacheOptions = {
                ttl: 30, // Cache signals for 30 seconds
                prefix: 'predictions'
            };
            // Try to get from cache first
            const cachedSignal = await redis_service_1.redisService.get(cacheKey, cacheOptions);
            if (cachedSignal) {
                this.updateMetrics('hit', Date.now() - startTime);
                console.log(`🎯 Cache HIT for prediction ${input.symbol} (${inputHash})`);
                return cachedSignal;
            }
            // Cache miss - generate new prediction
            console.log(`🔄 Cache MISS for prediction ${input.symbol} - generating new signal`);
            const signal = this.predictionEngine.generateSignal(input);
            if (signal) {
                // Cache the result
                await redis_service_1.redisService.set(cacheKey, signal, cacheOptions);
            }
            this.updateMetrics('miss', Date.now() - startTime);
            return signal;
        }
        catch (error) {
            console.error('Error in cached prediction:', error);
            this.updateMetrics('miss', Date.now() - startTime);
            // Fallback to direct prediction
            return this.predictionEngine.generateSignal(input);
        }
    }
    /**
     * Get performance statistics from underlying prediction engine
     */
    getPerformanceStats() {
        return this.predictionEngine.getPerformanceStats();
    }
    /**
     * Get caching metrics
     */
    getCacheMetrics() {
        return { ...this.metrics };
    }
    /**
     * Get combined performance metrics
     */
    getDetailedMetrics() {
        const cacheStats = redis_service_1.redisService.getStats();
        const performanceStats = this.predictionEngine.getPerformanceStats();
        return {
            cache: {
                ...this.metrics,
                hitRate: this.metrics.totalPredictions > 0
                    ? (this.metrics.cacheHits / this.metrics.totalPredictions) * 100
                    : 0,
                redisStats: cacheStats
            },
            performance: performanceStats
        };
    }
    /**
     * Clear prediction cache for a symbol
     */
    async clearSymbolCache(symbol) {
        await redis_service_1.redisService.clear(`predictions:signal:${symbol}:*`);
        console.log(`🗑️ Cleared prediction cache for ${symbol}`);
    }
    /**
     * Clear all prediction cache
     */
    async clearAllCache() {
        await redis_service_1.redisService.clear('predictions:*');
        console.log('🗑️ Cleared all prediction cache');
    }
    /**
     * Precompute and cache predictions for multiple inputs
     */
    async precomputePredictions(inputs) {
        console.log(`🔄 Precomputing ${inputs.length} predictions...`);
        const promises = inputs.map(async (input) => {
            try {
                await this.generateSignal(input);
            }
            catch (error) {
                console.warn(`Failed to precompute prediction for ${input.symbol}:`, error);
            }
        });
        await Promise.all(promises);
        console.log('✅ Prediction precomputation complete');
    }
    /**
     * Create a hash for the prediction input to use as cache key
     */
    createInputHash(input) {
        // Create a consistent hash based on key input parameters
        const hashInput = {
            currentPrice: Math.round(input.currentPrice * 100) / 100, // Round to 2 decimals
            volume: Math.round(input.volume),
            indicators: {
                rsi: input.indicators.rsi ? Math.round(input.indicators.rsi * 100) / 100 : null,
                macd: input.indicators.macd ? {
                    macd: Math.round(input.indicators.macd.macd * 10000) / 10000,
                    signal: Math.round(input.indicators.macd.signal * 10000) / 10000,
                    histogram: Math.round(input.indicators.macd.histogram * 10000) / 10000
                } : null,
                ma20: input.indicators.ma20 ? Math.round(input.indicators.ma20 * 100) / 100 : null,
                ma50: input.indicators.ma50 ? Math.round(input.indicators.ma50 * 100) / 100 : null
            },
            // Use recent price trend instead of full history for consistency
            priceContext: input.priceHistory.slice(-5).map(p => Math.round(p * 100) / 100)
        };
        return crypto_1.default.createHash('md5')
            .update(JSON.stringify(hashInput))
            .digest('hex')
            .substring(0, 12);
    }
    /**
     * Update caching metrics
     */
    updateMetrics(type, responseTime) {
        this.metrics.totalPredictions++;
        if (type === 'hit') {
            this.metrics.cacheHits++;
        }
        else {
            this.metrics.cacheMisses++;
        }
        // Update average response time
        this.metrics.avgResponseTime = ((this.metrics.avgResponseTime * (this.metrics.totalPredictions - 1)) + responseTime) / this.metrics.totalPredictions;
    }
    /**
     * Get the underlying prediction engine for direct access
     */
    getPredictionEngine() {
        return this.predictionEngine;
    }
}
exports.CachedPredictionEngine = CachedPredictionEngine;
exports.default = CachedPredictionEngine;
//# sourceMappingURL=cached-prediction-engine.js.map