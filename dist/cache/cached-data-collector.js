"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CachedDataCollector = void 0;
const redis_service_1 = require("./redis-service");
const winston_1 = __importDefault(require("winston"));
class CachedDataCollector {
    constructor(dataCollector) {
        this.dataCollector = dataCollector;
        // Initialize logger
        this.logger = winston_1.default.createLogger({
            level: 'info',
            format: winston_1.default.format.combine(winston_1.default.format.timestamp(), winston_1.default.format.json()),
            transports: [
                new winston_1.default.transports.Console(),
                new winston_1.default.transports.File({ filename: 'logs/cached-data-collector.log' })
            ]
        });
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
        this.logger.info('CachedDataCollector initialized', {
            cacheConfig: this.cacheConfig
        });
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
        this.logger.debug('Attempting to get market snapshot from cache', { cacheKey });
        return await redis_service_1.redisService.getOrSet(cacheKey, async () => {
            this.logger.info('Cache miss - fetching market snapshot from data collector');
            const result = await this.dataCollector.getMarketSnapshot();
            this.logger.info('Market snapshot saved to cache', {
                cacheKey,
                symbolCount: result?.symbols?.size || 0,
                ttl: options.ttl
            });
            return result;
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
        this.logger.debug('Attempting to get historical data from cache', {
            symbol,
            count: count || 100,
            cacheKey
        });
        return await redis_service_1.redisService.getOrSet(cacheKey, async () => {
            this.logger.info('Cache miss - fetching historical data from data collector', {
                symbol,
                count: count || 100
            });
            const result = await this.dataCollector.getHistoricalData(symbol, count);
            this.logger.info('Historical data saved to cache', {
                symbol,
                cacheKey,
                dataPoints: result?.length || 0,
                ttl: options.ttl
            });
            return result;
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
        this.logger.debug('Attempting to get latest data from cache', { symbol, cacheKey });
        return await redis_service_1.redisService.getOrSet(cacheKey, async () => {
            this.logger.info('Cache miss - fetching latest data from data collector', { symbol });
            const result = await this.dataCollector.getLatestData(symbol) || null;
            this.logger.info('Latest data saved to cache', {
                symbol,
                cacheKey,
                hasData: !!result,
                price: result?.close,
                ttl: options.ttl
            });
            return result;
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
        this.logger.debug('Attempting to get cached indicators', {
            symbol,
            cacheKey,
            dataPoints: data.length,
            latestTimestamp
        });
        const result = await redis_service_1.redisService.get(cacheKey, options);
        if (result) {
            this.logger.debug('Cache hit - indicators found', { symbol, cacheKey });
        }
        else {
            this.logger.debug('Cache miss - indicators not found', { symbol, cacheKey });
        }
        return result;
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
        this.logger.info('Saving indicators to cache', {
            symbol,
            cacheKey,
            indicatorKeys: Object.keys(indicators),
            dataPoints: data.length,
            ttl: options.ttl
        });
        await redis_service_1.redisService.set(cacheKey, indicators, options);
        this.logger.debug('Indicators successfully saved to cache', { symbol, cacheKey });
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
        this.logger.debug('Attempting to get cached prediction', {
            symbol,
            inputHash: inputHash.substring(0, 8) + '...',
            cacheKey
        });
        const result = await redis_service_1.redisService.get(cacheKey, options);
        if (result) {
            this.logger.info('Cache hit - prediction found', {
                symbol,
                inputHash: inputHash.substring(0, 8) + '...',
                predictionType: typeof result
            });
        }
        else {
            this.logger.debug('Cache miss - prediction not found', { symbol, inputHash: inputHash.substring(0, 8) + '...' });
        }
        return result;
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
        this.logger.info('Saving prediction to cache', {
            symbol,
            inputHash: inputHash.substring(0, 8) + '...',
            cacheKey,
            predictionKeys: typeof prediction === 'object' ? Object.keys(prediction) : 'primitive',
            ttl: options.ttl
        });
        await redis_service_1.redisService.set(cacheKey, prediction, options);
        this.logger.debug('Prediction successfully saved to cache', {
            symbol,
            inputHash: inputHash.substring(0, 8) + '...'
        });
    }
    /**
     * Invalidate cache for symbol
     */
    async invalidateSymbolCache(symbol) {
        this.logger.info('Invalidating cache for symbol', { symbol });
        try {
            await Promise.all([
                redis_service_1.redisService.clear(`${this.cacheConfig.marketData.prefix}:*${symbol}*`),
                redis_service_1.redisService.clear(`${this.cacheConfig.indicators.prefix}:${symbol}*`),
                redis_service_1.redisService.clear(`${this.cacheConfig.predictions.prefix}:${symbol}*`)
            ]);
            this.logger.info('Successfully invalidated cache for symbol', { symbol });
        }
        catch (error) {
            this.logger.error('Failed to invalidate cache for symbol', { symbol, error });
            throw error;
        }
    }
    /**
     * Get cache statistics
     */
    getCacheStats() {
        const stats = redis_service_1.redisService.getStats();
        this.logger.info('Cache statistics requested', { stats });
        return stats;
    }
    /**
     * Log current cache configuration
     */
    logCacheConfig() {
        this.logger.info('Current cache configuration', {
            config: this.cacheConfig,
            timestamp: new Date().toISOString()
        });
    }
    /**
     * Start data collection using underlying collector
     */
    async startCollection() {
        this.logger.info('Starting cached data collection');
        try {
            await this.dataCollector.startCollection();
            this.logger.info('Cached data collection started successfully');
        }
        catch (error) {
            this.logger.error('Failed to start cached data collection', { error });
            throw error;
        }
    }
    /**
     * Stop data collection using underlying collector
     */
    async stopCollection() {
        this.logger.info('Stopping cached data collection');
        try {
            await this.dataCollector.stopCollection();
            this.logger.info('Cached data collection stopped successfully');
        }
        catch (error) {
            this.logger.error('Failed to stop cached data collection', { error });
            throw error;
        }
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
        this.logger.info('Starting cache warmup', { symbols, symbolCount: symbols.length });
        const startTime = Date.now();
        let successCount = 0;
        let failureCount = 0;
        const warmupPromises = symbols.map(async (symbol) => {
            try {
                const symbolStartTime = Date.now();
                // Cache latest data
                await this.getLatestData(symbol);
                // Cache historical data
                await this.getHistoricalData(symbol, 100);
                const symbolDuration = Date.now() - symbolStartTime;
                this.logger.info('Cache warmed up for symbol', {
                    symbol,
                    duration: symbolDuration + 'ms'
                });
                successCount++;
            }
            catch (error) {
                this.logger.warn('Failed to warm up cache for symbol', { symbol, error });
                failureCount++;
            }
        });
        await Promise.all(warmupPromises);
        const totalDuration = Date.now() - startTime;
        this.logger.info('Cache warmup complete', {
            totalSymbols: symbols.length,
            successful: successCount,
            failed: failureCount,
            duration: totalDuration + 'ms'
        });
    }
}
exports.CachedDataCollector = CachedDataCollector;
exports.default = CachedDataCollector;
//# sourceMappingURL=cached-data-collector.js.map