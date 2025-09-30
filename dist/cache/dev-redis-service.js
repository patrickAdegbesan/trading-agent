"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.devRedisService = exports.DevRedisService = void 0;
const redis_service_1 = require("./redis-service");
class DevRedisService extends redis_service_1.RedisService {
    constructor() {
        super(''); // Initialize with empty URL
        this.storage = new Map();
        this.enabled = false;
        console.log('ℹ️ Development mode: Using in-memory cache service');
    }
    // Override methods to work with in-memory storage
    async connect() {
        // In-memory storage is always connected
        return Promise.resolve();
    }
    async get(key) {
        if (!this.enabled)
            return null;
        const entry = this.storage.get(key);
        if (!entry)
            return null;
        // Check expiry
        if (entry.expiry && entry.expiry < Date.now()) {
            this.storage.delete(key);
            return null;
        }
        try {
            return JSON.parse(entry.value);
        }
        catch {
            return null;
        }
    }
    async set(key, value, options) {
        if (!this.enabled)
            return true;
        try {
            this.storage.set(key, {
                value: JSON.stringify(value),
                expiry: options?.ttl ? Date.now() + (options.ttl * 1000) : undefined
            });
            return true;
        }
        catch {
            return false;
        }
    }
    async delete(key, options) {
        if (!this.enabled)
            return true;
        const fullKey = options?.prefix ? `${options.prefix}:${key}` : key;
        return this.storage.delete(fullKey);
    }
    async clear() {
        if (!this.enabled)
            return 0;
        const size = this.storage.size;
        this.storage.clear();
        return size;
    }
    isRedisConnected() {
        return this.enabled; // Return enabled state for compatibility
    }
    setEnabled(enabled) {
        this.enabled = enabled;
        if (!enabled) {
            this.storage.clear(); // Clear storage when disabled
        }
        console.log(`Development Redis service ${enabled ? 'enabled' : 'disabled'}`);
    }
    getStats() {
        return {
            hits: 0,
            misses: 0,
            hitRate: 0,
            totalOperations: this.storage.size,
            connectionStatus: this.enabled ? 'connected' : 'disconnected'
        };
    }
}
exports.DevRedisService = DevRedisService;
// Export a singleton instance for development mode
exports.devRedisService = new DevRedisService();
//# sourceMappingURL=dev-redis-service.js.map