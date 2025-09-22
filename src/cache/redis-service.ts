import Redis from 'ioredis';
import { EventEmitter } from 'events';

export interface CacheOptions {
    ttl?: number; // Time to live in seconds
    prefix?: string; // Key prefix
}

export interface CacheStats {
    hits: number;
    misses: number;
    hitRate: number;
    totalOperations: number;
    connectionStatus: 'connected' | 'disconnected' | 'connecting';
}

export class RedisService extends EventEmitter {
    private client: Redis | null = null;
    private isConnected: boolean = false;
    private stats: CacheStats = {
        hits: 0,
        misses: 0,
        hitRate: 0,
        totalOperations: 0,
        connectionStatus: 'disconnected'
    };

    constructor(redisUrl: string = process.env.REDIS_URL || '') {
        super();
        
        // Check if Redis URL is provided by Heroku or environment
        if (!redisUrl) {
            console.log('🔧 No Redis URL found - running in fallback mode only');
            this.isConnected = false;
            this.client = null;
            return;
        }
        
        // Log the connection attempt (hide credentials)
        const maskedUrl = redisUrl.replace(/\/\/.*@/, '//***@');
        console.log(`🔗 Connecting to Redis: ${maskedUrl}`);
        
        this.client = new Redis(redisUrl, {
            maxRetriesPerRequest: 3,
            lazyConnect: true,
            connectTimeout: 10000,
            enableReadyCheck: true,
            enableOfflineQueue: false,
            // Allow reconnection for Heroku Redis
            reconnectOnError: (err) => {
                const targetError = 'READONLY';
                return err.message.includes(targetError);
            }
        });

        this.setupEventHandlers();
    }

    private setupEventHandlers(): void {
        if (!this.client) return; // Skip if no client initialized
        
        this.client.on('connect', () => {
            this.isConnected = true;
            this.stats.connectionStatus = 'connected';
            console.log('🔗 Redis connected successfully');
            this.emit('connected');
        });

        this.client.on('error', (error) => {
            console.warn('⚠️ Redis connection error (using fallback):', error.message);
            this.isConnected = false;
            this.stats.connectionStatus = 'disconnected';
            
            // Prevent Redis errors from becoming uncaught exceptions
            try {
                this.emit('error', error);
            } catch (err) {
                // Ignore emit errors to prevent cascading failures
            }
        });

        this.client.on('close', () => {
            this.isConnected = false;
            this.stats.connectionStatus = 'disconnected';
            console.log('🔌 Redis connection closed');
            this.emit('disconnected');
        });

        this.client.on('reconnecting', () => {
            this.stats.connectionStatus = 'connecting';
            console.log('🔄 Redis reconnecting...');
        });

        // Attempt initial connection with timeout
        this.connectWithTimeout();
    }

    private async connectWithTimeout(): Promise<void> {
        if (!this.client) return;
        
        try {
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Connection timeout')), 5000);
            });
            
            await Promise.race([this.client.connect(), timeoutPromise]);
            console.log('✅ Redis connected successfully');
        } catch (error: any) {
            console.warn('⚠️ Redis connection failed, using fallback mode:', error.message);
            this.isConnected = false;
        }
    }

    /**
     * Health check for Redis connection
     */
    async healthCheck(): Promise<{ connected: boolean; latency?: number; error?: string }> {
        if (!this.client || !this.isConnected) {
            return { connected: false, error: 'Redis not configured or connected' };
        }

        try {
            const start = Date.now();
            await this.client.ping();
            const latency = Date.now() - start;
            
            return { 
                connected: true, 
                latency 
            };
        } catch (error: any) {
            console.warn('Redis health check failed:', error.message);
            this.isConnected = false;
            return { 
                connected: false, 
                error: error.message 
            };
        }
    }

    /**
     * Force reconnection attempt
     */
    async reconnect(): Promise<boolean> {
        if (!this.client) {
            console.log('🔧 Redis not configured - skipping reconnection');
            return false;
        }
        
        try {
            console.log('🔄 Attempting Redis reconnection...');
            await this.client.disconnect();
            await this.connectWithTimeout();
            return this.isConnected;
        } catch (error: any) {
            console.warn('⚠️ Redis reconnection failed:', error.message);
            return false;
        }
    }

    async connect(): Promise<void> {
        if (!this.client) return;
        
        try {
            await this.client.connect();
        } catch (error) {
            console.warn('⚠️ Redis server not available, running without cache:', error);
        }
    }

    async disconnect(): Promise<void> {
        if (this.client) {
            await this.client.disconnect();
        }
    }

    /**
     * Get value from cache with automatic fallback
     */
    async get<T>(key: string, options?: CacheOptions): Promise<T | null> {
        if (!this.client || !this.isConnected) {
            this.updateStats('miss');
            return null;
        }

        try {
            const fullKey = this.buildKey(key, options?.prefix);
            const value = await this.client.get(fullKey);
            
            if (value) {
                this.updateStats('hit');
                return JSON.parse(value);
            } else {
                this.updateStats('miss');
                return null;
            }
        } catch (error) {
            console.warn(`Cache GET error for key ${key}:`, error);
            this.updateStats('miss');
            return null;
        }
    }

    /**
     * Set value in cache with TTL
     */
    async set<T>(key: string, value: T, options?: CacheOptions): Promise<boolean> {
        if (!this.client || !this.isConnected) {
            return false;
        }

        try {
            const fullKey = this.buildKey(key, options?.prefix);
            const serializedValue = JSON.stringify(value);
            
            if (options?.ttl) {
                await this.client.setex(fullKey, options.ttl, serializedValue);
            } else {
                await this.client.set(fullKey, serializedValue);
            }
            
            return true;
        } catch (error) {
            console.warn(`Cache SET error for key ${key}:`, error);
            return false;
        }
    }

    /**
     * Get or compute value with caching
     */
    async getOrSet<T>(
        key: string, 
        computeFn: () => Promise<T>, 
        options?: CacheOptions
    ): Promise<T> {
        // Try to get from cache first
        const cached = await this.get<T>(key, options);
        if (cached !== null) {
            return cached;
        }

        // Compute the value
        const computed = await computeFn();
        
        // Cache the computed value
        await this.set(key, computed, options);
        
        return computed;
    }

    /**
     * Delete key from cache
     */
    async delete(key: string, options?: CacheOptions): Promise<boolean> {
        if (!this.client || !this.isConnected) {
            return false;
        }

        try {
            const fullKey = this.buildKey(key, options?.prefix);
            const result = await this.client.del(fullKey);
            return result > 0;
        } catch (error) {
            console.warn(`Cache DELETE error for key ${key}:`, error);
            return false;
        }
    }

    /**
     * Clear all keys with prefix
     */
    async clear(prefix?: string): Promise<number> {
        if (!this.client || !this.isConnected) {
            return 0;
        }

        try {
            const pattern = prefix ? `${prefix}:*` : '*';
            const keys = await this.client.keys(pattern);
            
            if (keys.length === 0) {
                return 0;
            }
            
            const result = await this.client.del(...keys);
            return result;
        } catch (error) {
            console.warn(`Cache CLEAR error:`, error);
            return 0;
        }
    }

    /**
     * Check if key exists
     */
    async exists(key: string, options?: CacheOptions): Promise<boolean> {
        if (!this.client || !this.isConnected) {
            return false;
        }

        try {
            const fullKey = this.buildKey(key, options?.prefix);
            const result = await this.client.exists(fullKey);
            return result === 1;
        } catch (error) {
            console.warn(`Cache EXISTS error for key ${key}:`, error);
            return false;
        }
    }

    /**
     * Get cache statistics
     */
    getStats(): CacheStats {
        return { ...this.stats };
    }

    /**
     * Reset cache statistics
     */
    resetStats(): void {
        this.stats = {
            hits: 0,
            misses: 0,
            hitRate: 0,
            totalOperations: 0,
            connectionStatus: this.stats.connectionStatus
        };
    }

    /**
     * Check if Redis is connected
     */
    isRedisConnected(): boolean {
        return this.isConnected;
    }

    private buildKey(key: string, prefix?: string): string {
        return prefix ? `${prefix}:${key}` : key;
    }

    private updateStats(type: 'hit' | 'miss'): void {
        if (type === 'hit') {
            this.stats.hits++;
        } else {
            this.stats.misses++;
        }
        
        this.stats.totalOperations++;
        this.stats.hitRate = this.stats.totalOperations > 0 
            ? this.stats.hits / this.stats.totalOperations 
            : 0;
    }
}

// Singleton instance
export const redisService = new RedisService();