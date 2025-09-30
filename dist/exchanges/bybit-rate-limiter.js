"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BybitRateLimiter = void 0;
const winston_1 = __importDefault(require("winston"));
const RATE_LIMITS = {
    // IP rate limits
    ip: {
        general: { maxRequests: 120, windowMs: 60000 }, // 120 requests per minute
        placeOrder: { maxRequests: 60, windowMs: 60000 }, // 60 orders per minute
        position: { maxRequests: 120, windowMs: 60000 }, // 120 position queries per minute
        trading: { maxRequests: 600, windowMs: 60000 }, // 600 trading endpoints per minute
        futures: { maxRequests: 600, windowMs: 60000 } // 600 futures endpoints per minute
    },
    // API key rate limits
    apiKey: {
        general: { maxRequests: 120, windowMs: 60000 }, // 120 requests per minute
        placeOrder: { maxRequests: 60, windowMs: 60000 }, // 60 orders per minute
        position: { maxRequests: 120, windowMs: 60000 }, // 120 position queries per minute
        trading: { maxRequests: 600, windowMs: 60000 }, // 600 trading endpoints per minute
        futures: { maxRequests: 600, windowMs: 60000 } // 600 futures endpoints per minute
    }
};
class BybitRateLimiter {
    constructor() {
        this.buckets = new Map();
        this.logger = winston_1.default.createLogger({
            level: 'info',
            format: winston_1.default.format.combine(winston_1.default.format.timestamp(), winston_1.default.format.json()),
            transports: [
                new winston_1.default.transports.Console(),
                new winston_1.default.transports.File({ filename: 'logs/rate-limiter.log' })
            ]
        });
        // Initialize buckets for each rate limit type
        Object.entries(RATE_LIMITS).forEach(([source, types]) => {
            Object.keys(types).forEach(type => {
                this.buckets.set(`${source}_${type}`, this.createBucket());
            });
        });
        // Start bucket cleanup
        setInterval(() => this.cleanupBuckets(), 60000);
    }
    createBucket() {
        return {
            requests: 0,
            lastReset: Date.now(),
            weights: [],
            timestamps: []
        };
    }
    cleanupBuckets() {
        const now = Date.now();
        for (const [key, bucket] of this.buckets.entries()) {
            // Remove timestamps older than the largest window
            const oldestAllowed = now - Math.max(...Object.values(RATE_LIMITS.ip).map(l => l.windowMs), ...Object.values(RATE_LIMITS.apiKey).map(l => l.windowMs));
            let i = 0;
            while (i < bucket.timestamps.length && bucket.timestamps[i] < oldestAllowed) {
                bucket.requests--;
                bucket.weights.shift();
                bucket.timestamps.shift();
                i++;
            }
            if (i > 0) {
                this.logger.debug(`Cleaned up ${i} old requests from bucket ${key}`);
            }
        }
    }
    /**
     * Check if a request can be made and update the rate limit counter
     */
    async checkRateLimit(type, source, weight = 1) {
        const bucketKey = `${source}_${type}`;
        const bucket = this.buckets.get(bucketKey) || this.createBucket();
        const limit = RATE_LIMITS[source][type];
        const now = Date.now();
        // Reset bucket if window has passed
        if (now - bucket.lastReset >= limit.windowMs) {
            bucket.requests = 0;
            bucket.weights = [];
            bucket.timestamps = [];
            bucket.lastReset = now;
        }
        // Calculate current usage
        const currentRequests = bucket.weights.reduce((sum, w) => sum + w, 0);
        // Check if adding this request would exceed the limit
        if (currentRequests + weight > limit.maxRequests) {
            const oldestTimestamp = bucket.timestamps[0] || now;
            const waitTime = Math.max(0, (limit.windowMs - (now - oldestTimestamp)));
            this.logger.warn(`Rate limit would be exceeded for ${bucketKey}`, {
                currentRequests,
                weight,
                limit: limit.maxRequests,
                waitTimeMs: waitTime
            });
            // Wait if we're close to the limit
            if (waitTime > 0) {
                this.logger.info(`Waiting ${waitTime}ms for rate limit window to reset`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
                return this.checkRateLimit(type, source, weight);
            }
            return false;
        }
        // Update bucket
        bucket.requests++;
        bucket.weights.push(weight);
        bucket.timestamps.push(now);
        this.buckets.set(bucketKey, bucket);
        return true;
    }
    /**
     * Get current rate limit status
     */
    getRateLimitStatus() {
        const now = Date.now();
        const status = {};
        for (const [key, bucket] of this.buckets.entries()) {
            const [source, type] = key.split('_');
            const limit = RATE_LIMITS[source][type];
            // Calculate total weight of requests in current window
            const validRequests = bucket.weights.filter((_, i) => now - bucket.timestamps[i] < limit.windowMs);
            const used = validRequests.reduce((sum, w) => sum + w, 0);
            status[key] = {
                used,
                remaining: limit.maxRequests - used,
                resetIn: Math.max(0, limit.windowMs - (now - bucket.lastReset))
            };
        }
        return status;
    }
    /**
     * Check remaining rate limit capacity
     */
    getRemainingRequests(type, source) {
        const bucketKey = `${source}_${type}`;
        const bucket = this.buckets.get(bucketKey);
        const limit = RATE_LIMITS[source][type];
        if (!bucket)
            return limit.maxRequests;
        const now = Date.now();
        const validRequests = bucket.weights.filter((_, i) => now - bucket.timestamps[i] < limit.windowMs);
        const used = validRequests.reduce((sum, w) => sum + w, 0);
        return Math.max(0, limit.maxRequests - used);
    }
}
exports.BybitRateLimiter = BybitRateLimiter;
//# sourceMappingURL=bybit-rate-limiter.js.map