type EndpointType = 'general' | 'placeOrder' | 'position' | 'trading' | 'futures';
type SourceType = 'ip' | 'apiKey';
export declare class BybitRateLimiter {
    private buckets;
    private logger;
    constructor();
    private createBucket;
    private cleanupBuckets;
    /**
     * Check if a request can be made and update the rate limit counter
     */
    checkRateLimit(type: EndpointType, source: SourceType, weight?: number): Promise<boolean>;
    /**
     * Get current rate limit status
     */
    getRateLimitStatus(): {
        [key: string]: {
            used: number;
            remaining: number;
            resetIn: number;
        };
    };
    /**
     * Check remaining rate limit capacity
     */
    getRemainingRequests(type: EndpointType, source: SourceType): number;
}
export {};
