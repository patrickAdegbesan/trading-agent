import { RedisService, CacheOptions, CacheStats } from './redis-service';
export declare class DevRedisService extends RedisService {
    private storage;
    private enabled;
    constructor();
    connect(): Promise<void>;
    get<T>(key: string): Promise<T | null>;
    set<T>(key: string, value: T, options?: CacheOptions): Promise<boolean>;
    delete(key: string, options?: CacheOptions): Promise<boolean>;
    clear(): Promise<number>;
    isRedisConnected(): boolean;
    setEnabled(enabled: boolean): void;
    getStats(): CacheStats;
}
export declare const devRedisService: DevRedisService;
//# sourceMappingURL=dev-redis-service.d.ts.map