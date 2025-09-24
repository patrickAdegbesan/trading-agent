import { redisService, CacheOptions } from './redis-service';
import { DataCollector, MarketDataPoint } from '../market-data/data-collector';
import { FeatureVector } from '../market-data/indicators';
import winston from 'winston';

export interface CachedMarketData {
    timestamp: number;
    data: MarketDataPoint;
    features?: FeatureVector;
}

export interface CacheConfig {
    marketData: {
        ttl: number; // seconds
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

export class CachedDataCollector {
    private dataCollector: DataCollector;
    private cacheConfig: CacheConfig;
    private logger: winston.Logger;

    constructor(dataCollector: DataCollector) {
        this.dataCollector = dataCollector;
        
        // Initialize logger
        this.logger = winston.createLogger({
            level: 'info',
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json()
            ),
            transports: [
                new winston.transports.Console(),
                new winston.transports.File({ filename: 'logs/cached-data-collector.log' })
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
        const options: CacheOptions = {
            ttl: this.cacheConfig.marketData.ttl,
            prefix: this.cacheConfig.marketData.prefix
        };

        this.logger.debug('Attempting to get market snapshot from cache', { cacheKey });

        return await redisService.getOrSet(
            cacheKey,
            async () => {
                this.logger.info('Cache miss - fetching market snapshot from data collector');
                const result = await this.dataCollector.getMarketSnapshot();
                this.logger.info('Market snapshot saved to cache', { 
                    cacheKey, 
                    symbolCount: result?.symbols?.size || 0,
                    ttl: options.ttl 
                });
                return result;
            },
            options
        );
    }

    /**
     * Get cached historical data
     */
    async getHistoricalData(symbol: string, count?: number): Promise<MarketDataPoint[]> {
        const cacheKey = `historical:${symbol}:${count || 100}`;
        const options: CacheOptions = {
            ttl: this.cacheConfig.marketData.ttl,
            prefix: this.cacheConfig.marketData.prefix
        };

        this.logger.debug('Attempting to get historical data from cache', { 
            symbol, 
            count: count || 100, 
            cacheKey 
        });

        return await redisService.getOrSet(
            cacheKey,
            async () => {
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
            },
            options
        );
    }

    /**
     * Get cached latest data point
     */
    async getLatestData(symbol: string): Promise<MarketDataPoint | null> {
        const cacheKey = `latest:${symbol}`;
        const options: CacheOptions = {
            ttl: 10, // Very short TTL for latest data
            prefix: this.cacheConfig.marketData.prefix
        };

        this.logger.debug('Attempting to get latest data from cache', { symbol, cacheKey });

        return await redisService.getOrSet(
            cacheKey,
            async () => {
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
            },
            options
        );
    }

    /**
     * Cache technical indicators
     */
    async getCachedIndicators(symbol: string, data: MarketDataPoint[]): Promise<FeatureVector | null> {
        // Create cache key based on latest data timestamp
        const latestTimestamp = data.length > 0 ? data[data.length - 1].timestamp : Date.now();
        const cacheKey = `${symbol}:${latestTimestamp}`;
        const options: CacheOptions = {
            ttl: this.cacheConfig.indicators.ttl,
            prefix: this.cacheConfig.indicators.prefix
        };

        this.logger.debug('Attempting to get cached indicators', { 
            symbol, 
            cacheKey, 
            dataPoints: data.length,
            latestTimestamp 
        });

        const result = await redisService.get<FeatureVector>(cacheKey, options);
        
        if (result) {
            this.logger.debug('Cache hit - indicators found', { symbol, cacheKey });
        } else {
            this.logger.debug('Cache miss - indicators not found', { symbol, cacheKey });
        }

        return result;
    }

    /**
     * Set cached indicators
     */
    async setCachedIndicators(symbol: string, data: MarketDataPoint[], indicators: FeatureVector): Promise<void> {
        const latestTimestamp = data.length > 0 ? data[data.length - 1].timestamp : Date.now();
        const cacheKey = `${symbol}:${latestTimestamp}`;
        const options: CacheOptions = {
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

        await redisService.set(cacheKey, indicators, options);
        
        this.logger.debug('Indicators successfully saved to cache', { symbol, cacheKey });
    }

    /**
     * Cache ML predictions
     */
    async getCachedPrediction(symbol: string, inputHash: string): Promise<any | null> {
        const cacheKey = `${symbol}:${inputHash}`;
        const options: CacheOptions = {
            ttl: this.cacheConfig.predictions.ttl,
            prefix: this.cacheConfig.predictions.prefix
        };

        this.logger.debug('Attempting to get cached prediction', { 
            symbol, 
            inputHash: inputHash.substring(0, 8) + '...', 
            cacheKey 
        });

        const result = await redisService.get(cacheKey, options);
        
        if (result) {
            this.logger.info('Cache hit - prediction found', { 
                symbol, 
                inputHash: inputHash.substring(0, 8) + '...',
                predictionType: typeof result 
            });
        } else {
            this.logger.debug('Cache miss - prediction not found', { symbol, inputHash: inputHash.substring(0, 8) + '...' });
        }

        return result;
    }

    /**
     * Set cached ML prediction
     */
    async setCachedPrediction(symbol: string, inputHash: string, prediction: any): Promise<void> {
        const cacheKey = `${symbol}:${inputHash}`;
        const options: CacheOptions = {
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

        await redisService.set(cacheKey, prediction, options);
        
        this.logger.debug('Prediction successfully saved to cache', { 
            symbol, 
            inputHash: inputHash.substring(0, 8) + '...' 
        });
    }

    /**
     * Invalidate cache for symbol
     */
    async invalidateSymbolCache(symbol: string): Promise<void> {
        this.logger.info('Invalidating cache for symbol', { symbol });
        
        try {
            await Promise.all([
                redisService.clear(`${this.cacheConfig.marketData.prefix}:*${symbol}*`),
                redisService.clear(`${this.cacheConfig.indicators.prefix}:${symbol}*`),
                redisService.clear(`${this.cacheConfig.predictions.prefix}:${symbol}*`)
            ]);
            
            this.logger.info('Successfully invalidated cache for symbol', { symbol });
        } catch (error) {
            this.logger.error('Failed to invalidate cache for symbol', { symbol, error });
            throw error;
        }
    }

    /**
     * Get cache statistics
     */
    getCacheStats() {
        const stats = redisService.getStats();
        this.logger.info('Cache statistics requested', { stats });
        return stats;
    }

    /**
     * Log current cache configuration
     */
    logCacheConfig(): void {
        this.logger.info('Current cache configuration', {
            config: this.cacheConfig,
            timestamp: new Date().toISOString()
        });
    }

    /**
     * Start data collection using underlying collector
     */
    async startCollection(): Promise<void> {
        this.logger.info('Starting cached data collection');
        try {
            await this.dataCollector.startCollection();
            this.logger.info('Cached data collection started successfully');
        } catch (error) {
            this.logger.error('Failed to start cached data collection', { error });
            throw error;
        }
    }

    /**
     * Stop data collection using underlying collector
     */
    async stopCollection(): Promise<void> {
        this.logger.info('Stopping cached data collection');
        try {
            await this.dataCollector.stopCollection();
            this.logger.info('Cached data collection stopped successfully');
        } catch (error) {
            this.logger.error('Failed to stop cached data collection', { error });
            throw error;
        }
    }

    /**
     * Get underlying data collector for non-cached operations
     */
    getDataCollector(): DataCollector {
        return this.dataCollector;
    }

    /**
     * Hash function for creating consistent cache keys
     */
    private createHash(input: any): string {
        return Buffer.from(JSON.stringify(input)).toString('base64').substring(0, 16);
    }

    /**
     * Create input hash for ML predictions
     */
    createPredictionInputHash(input: any): string {
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
    async warmupCache(symbols: string[]): Promise<void> {
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
            } catch (error) {
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

export default CachedDataCollector;