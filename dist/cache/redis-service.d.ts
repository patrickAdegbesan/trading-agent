import { EventEmitter } from 'events';
export interface CacheOptions {
    ttl?: number;
    prefix?: string;
}
export interface CacheStats {
    hits: number;
    misses: number;
    hitRate: number;
    totalOperations: number;
    connectionStatus: 'connected' | 'disconnected' | 'connecting';
}
export declare class RedisService extends EventEmitter {
    private client;
    private isConnected;
    private stats;
    constructor(redisUrl?: string);
    private setupEventHandlers;
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    /**
     * Get value from cache with automatic fallback
     */
    get<T>(key: string, options?: CacheOptions): Promise<T | null>;
    /**
     * Set value in cache with TTL
     */
    set<T>(key: string, value: T, options?: CacheOptions): Promise<boolean>;
    /**
     * Get or compute value with caching
     */
    getOrSet<T>(key: string, computeFn: () => Promise<T>, options?: CacheOptions): Promise<T>;
    /**
     * Delete key from cache
     */
    delete(key: string, options?: CacheOptions): Promise<boolean>;
    /**
     * Clear all keys with prefix
     */
    clear(prefix?: string): Promise<number>;
    /**
     * Check if key exists
     */
    exists(key: string, options?: CacheOptions): Promise<boolean>;
    /**
     * Get cache statistics
     */
    getStats(): CacheStats;
    /**
     * Reset cache statistics
     */
    resetStats(): void;
    /**
     * Check if Redis is connected
     */
    isRedisConnected(): boolean;
    private buildKey;
    private updateStats;
}
export declare const redisService: RedisService;
//# sourceMappingURL=redis-service.d.ts.map