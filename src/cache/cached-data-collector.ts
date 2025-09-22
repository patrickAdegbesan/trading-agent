import { redisService, CacheOptions } from './redis-service';
import { DataCollector, MarketDataPoint } from '../market-data/data-collector';
import { FeatureVector } from '../market-data/indicators';

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

    constructor(dataCollector: DataCollector) {
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
        const options: CacheOptions = {
            ttl: this.cacheConfig.marketData.ttl,
            prefix: this.cacheConfig.marketData.prefix
        };

        return await redisService.getOrSet(
            cacheKey,
            async () => {
                return this.dataCollector.getMarketSnapshot();
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

        return await redisService.getOrSet(
            cacheKey,
            async () => {
                return this.dataCollector.getHistoricalData(symbol, count);
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

        return await redisService.getOrSet(
            cacheKey,
            async () => {
                return this.dataCollector.getLatestData(symbol) || null;
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

        return await redisService.get<FeatureVector>(cacheKey, options);
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

        await redisService.set(cacheKey, indicators, options);
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

        return await redisService.get(cacheKey, options);
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

        await redisService.set(cacheKey, prediction, options);
    }

    /**
     * Invalidate cache for symbol
     */
    async invalidateSymbolCache(symbol: string): Promise<void> {
        await Promise.all([
            redisService.clear(`${this.cacheConfig.marketData.prefix}:*${symbol}*`),
            redisService.clear(`${this.cacheConfig.indicators.prefix}:${symbol}*`),
            redisService.clear(`${this.cacheConfig.predictions.prefix}:${symbol}*`)
        ]);
    }

    /**
     * Get cache statistics
     */
    getCacheStats() {
        return redisService.getStats();
    }

    /**
     * Start data collection using underlying collector
     */
    async startCollection(): Promise<void> {
        await this.dataCollector.startCollection();
    }

    /**
     * Stop data collection using underlying collector
     */
    async stopCollection(): Promise<void> {
        await this.dataCollector.stopCollection();
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
        console.log('🔥 Warming up cache...');
        
        const warmupPromises = symbols.map(async (symbol) => {
            try {
                // Cache latest data
                await this.getLatestData(symbol);
                // Cache historical data
                await this.getHistoricalData(symbol, 100);
                console.log(`✅ Cache warmed up for ${symbol}`);
            } catch (error) {
                console.warn(`⚠️ Failed to warm up cache for ${symbol}:`, error);
            }
        });

        await Promise.all(warmupPromises);
        console.log('🔥 Cache warmup complete');
    }
}

export default CachedDataCollector;