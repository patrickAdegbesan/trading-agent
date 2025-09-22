"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.redisService = exports.RedisService = void 0;
const ioredis_1 = __importDefault(require("ioredis"));
const events_1 = require("events");
class RedisService extends events_1.EventEmitter {
    constructor(redisUrl = 'redis://localhost:6379') {
        super();
        this.isConnected = false;
        this.stats = {
            hits: 0,
            misses: 0,
            hitRate: 0,
            totalOperations: 0,
            connectionStatus: 'disconnected'
        };
        this.client = new ioredis_1.default(redisUrl, {
            maxRetriesPerRequest: 1,
            lazyConnect: true,
            enableAutoPipelining: true,
            connectTimeout: 2000,
            reconnectOnError: () => false, // Disable reconnection
        });
        this.setupEventHandlers();
    }
    setupEventHandlers() {
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
            this.emit('error', error);
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
    }
    async connect() {
        try {
            await this.client.connect();
        }
        catch (error) {
            console.warn('⚠️ Redis server not available, running without cache:', error);
        }
    }
    async disconnect() {
        if (this.client) {
            await this.client.disconnect();
        }
    }
    /**
     * Get value from cache with automatic fallback
     */
    async get(key, options) {
        if (!this.isConnected) {
            this.updateStats('miss');
            return null;
        }
        try {
            const fullKey = this.buildKey(key, options?.prefix);
            const value = await this.client.get(fullKey);
            if (value) {
                this.updateStats('hit');
                return JSON.parse(value);
            }
            else {
                this.updateStats('miss');
                return null;
            }
        }
        catch (error) {
            console.warn(`Cache GET error for key ${key}:`, error);
            this.updateStats('miss');
            return null;
        }
    }
    /**
     * Set value in cache with TTL
     */
    async set(key, value, options) {
        if (!this.isConnected) {
            return false;
        }
        try {
            const fullKey = this.buildKey(key, options?.prefix);
            const serializedValue = JSON.stringify(value);
            if (options?.ttl) {
                await this.client.setex(fullKey, options.ttl, serializedValue);
            }
            else {
                await this.client.set(fullKey, serializedValue);
            }
            return true;
        }
        catch (error) {
            console.warn(`Cache SET error for key ${key}:`, error);
            return false;
        }
    }
    /**
     * Get or compute value with caching
     */
    async getOrSet(key, computeFn, options) {
        // Try to get from cache first
        const cached = await this.get(key, options);
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
    async delete(key, options) {
        if (!this.isConnected) {
            return false;
        }
        try {
            const fullKey = this.buildKey(key, options?.prefix);
            const result = await this.client.del(fullKey);
            return result > 0;
        }
        catch (error) {
            console.warn(`Cache DELETE error for key ${key}:`, error);
            return false;
        }
    }
    /**
     * Clear all keys with prefix
     */
    async clear(prefix) {
        if (!this.isConnected) {
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
        }
        catch (error) {
            console.warn(`Cache CLEAR error:`, error);
            return 0;
        }
    }
    /**
     * Check if key exists
     */
    async exists(key, options) {
        if (!this.isConnected) {
            return false;
        }
        try {
            const fullKey = this.buildKey(key, options?.prefix);
            const result = await this.client.exists(fullKey);
            return result === 1;
        }
        catch (error) {
            console.warn(`Cache EXISTS error for key ${key}:`, error);
            return false;
        }
    }
    /**
     * Get cache statistics
     */
    getStats() {
        return { ...this.stats };
    }
    /**
     * Reset cache statistics
     */
    resetStats() {
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
    isRedisConnected() {
        return this.isConnected;
    }
    buildKey(key, prefix) {
        return prefix ? `${prefix}:${key}` : key;
    }
    updateStats(type) {
        if (type === 'hit') {
            this.stats.hits++;
        }
        else {
            this.stats.misses++;
        }
        this.stats.totalOperations++;
        this.stats.hitRate = this.stats.totalOperations > 0
            ? this.stats.hits / this.stats.totalOperations
            : 0;
    }
}
exports.RedisService = RedisService;
// Singleton instance
exports.redisService = new RedisService();
//# sourceMappingURL=redis-service.js.map