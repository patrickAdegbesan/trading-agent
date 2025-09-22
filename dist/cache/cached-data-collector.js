"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CachedDataCollector = void 0;
const redis_service_1 = require("./redis-service");
class CachedDataCollector {
    constructor(dataCollector) {
        this.dataCollector = dataCollector;
        // Cache configuration
        this.cacheConfig = {
            marketData: {
                ttl: 30, // Cache market data for 30 seconds
                prefix: 'market'
            },
            indicators: {
                ttl: 60, // Cache indicators for 60 seconds
                prefix: 'indicators'
            },
            predictions: {
                ttl: 30, // Cache predictions for 30 seconds
                prefix: 'predictions'
            }
        };
    }
    /**
     * Get market snapshot with caching
     */
    async getMarketSnapshot() {
        const cacheKey = 'snapshot:latest';
        const options = {
            ttl: this.cacheConfig.marketData.ttl,
            prefix: this.cacheConfig.marketData.prefix
        };
        return await redis_service_1.redisService.getOrSet(cacheKey, async () => {
            return this.dataCollector.getMarketSnapshot();
        }, options);
    }
    /**
     * Get cached historical data
     */
    async getHistoricalData(symbol, count) {
        const cacheKey = `historical:${symbol}:${count || 100}`;
        const options = {
            ttl: this.cacheConfig.marketData.ttl,
            prefix: this.cacheConfig.marketData.prefix
        };
        return await redis_service_1.redisService.getOrSet(cacheKey, async () => {
            return this.dataCollector.getHistoricalData(symbol, count);
        }, options);
    }
    /**
     * Get cached latest data point
     */
    async getLatestData(symbol) {
        const cacheKey = `latest:${symbol}`;
        const options = {
            ttl: 10, // Very short TTL for latest data
            prefix: this.cacheConfig.marketData.prefix
        };
        return await redis_service_1.redisService.getOrSet(cacheKey, async () => {
            return this.dataCollector.getLatestData(symbol) || null;
        }, options);
    }
    /**
     * Cache technical indicators
     */
    async getCachedIndicators(symbol, data) {
        // Create cache key based on latest data timestamp
        const latestTimestamp = data.length > 0 ? data[data.length - 1].timestamp : Date.now();
        const cacheKey = `${symbol}:${latestTimestamp}`;
        const options = {
            ttl: this.cacheConfig.indicators.ttl,
            prefix: this.cacheConfig.indicators.prefix
        };
        return await redis_service_1.redisService.get(cacheKey, options);
    }
    /**
     * Set cached indicators
     */
    async setCachedIndicators(symbol, data, indicators) {
        const latestTimestamp = data.length > 0 ? data[data.length - 1].timestamp : Date.now();
        const cacheKey = `${symbol}:${latestTimestamp}`;
        const options = {
            ttl: this.cacheConfig.indicators.ttl,
            prefix: this.cacheConfig.indicators.prefix
        };
        await redis_service_1.redisService.set(cacheKey, indicators, options);
    }
    /**
     * Cache ML predictions
     */
    async getCachedPrediction(symbol, inputHash) {
        const cacheKey = `${symbol}:${inputHash}`;
        const options = {
            ttl: this.cacheConfig.predictions.ttl,
            prefix: this.cacheConfig.predictions.prefix
        };
        return await redis_service_1.redisService.get(cacheKey, options);
    }
    /**
     * Set cached ML prediction
     */
    async setCachedPrediction(symbol, inputHash, prediction) {
        const cacheKey = `${symbol}:${inputHash}`;
        const options = {
            ttl: this.cacheConfig.predictions.ttl,
            prefix: this.cacheConfig.predictions.prefix
        };
        await redis_service_1.redisService.set(cacheKey, prediction, options);
    }
    /**
     * Invalidate cache for symbol
     */
    async invalidateSymbolCache(symbol) {
        await Promise.all([
            redis_service_1.redisService.clear(`${this.cacheConfig.marketData.prefix}:*${symbol}*`),
            redis_service_1.redisService.clear(`${this.cacheConfig.indicators.prefix}:${symbol}*`),
            redis_service_1.redisService.clear(`${this.cacheConfig.predictions.prefix}:${symbol}*`)
        ]);
    }
    /**
     * Get cache statistics
     */
    getCacheStats() {
        return redis_service_1.redisService.getStats();
    }
    /**
     * Start data collection using underlying collector
     */
    async startCollection() {
        await this.dataCollector.startCollection();
    }
    /**
     * Stop data collection using underlying collector
     */
    async stopCollection() {
        await this.dataCollector.stopCollection();
    }
    /**
     * Get underlying data collector for non-cached operations
     */
    getDataCollector() {
        return this.dataCollector;
    }
    /**
     * Hash function for creating consistent cache keys
     */
    createHash(input) {
        return Buffer.from(JSON.stringify(input)).toString('base64').substring(0, 16);
    }
    /**
     * Create input hash for ML predictions
     */
    createPredictionInputHash(input) {
        // Create a hash based on key input parameters
        const hashInput = {
            symbol: input.symbol,
            currentPrice: input.currentPrice,
            indicators: {
                rsi: input.indicators?.rsi,
                macd: input.indicators?.macd,
                ma20: input.indicators?.ma20,
                ma50: input.indicators?.ma50
            },
            // Include latest few price points for context
            priceContext: input.priceHistory?.slice(-5)
        };
        return this.createHash(hashInput);
    }
    /**
     * Warm up cache with initial data
     */
    async warmupCache(symbols) {
        console.log('🔥 Warming up cache...');
        const warmupPromises = symbols.map(async (symbol) => {
            try {
                // Cache latest data
                await this.getLatestData(symbol);
                // Cache historical data
                await this.getHistoricalData(symbol, 100);
                console.log(`✅ Cache warmed up for ${symbol}`);
            }
            catch (error) {
                console.warn(`⚠️ Failed to warm up cache for ${symbol}:`, error);
            }
        });
        await Promise.all(warmupPromises);
        console.log('🔥 Cache warmup complete');
    }
}
exports.CachedDataCollector = CachedDataCollector;
exports.default = CachedDataCollector;
//# sourceMappingURL=cached-data-collector.js.map