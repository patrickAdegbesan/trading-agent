import { EventEmitter } from 'events';
import { ExchangeConnector } from './exchange-connector';
export interface Position {
    symbol: string;
    size: number;
    entryPrice: number;
    lastUpdateTime: number;
    unrealizedPnl: number;
    marginUsed: number;
    leverage: number;
    liquidationPrice?: number;
    markPrice: number;
    isIsolated: boolean;
    isolatedMargin?: number;
}
export declare class PositionTracker extends EventEmitter {
    private positions;
    private exchangeConnector;
    private updateInterval;
    private logger;
    private readonly UPDATE_INTERVAL_MS;
    constructor(exchangeConnector: ExchangeConnector);
    private startTracking;
    stopTracking(): void;
    private updatePositions;
    getPosition(symbol: string): Position | undefined;
    getAllPositions(): Position[];
    getOpenPositions(): Position[];
    setLeverage(symbol: string, leverage: number): Promise<boolean>;
    setMarginType(symbol: string, isolated: boolean): Promise<boolean>;
    getPositionValue(symbol: string): number;
    getUnrealizedPnl(symbol?: string): number;
    getTotalMarginUsed(): number;
    getPositionMetrics(symbol: string): {
        size: number;
        value: number;
        unrealizedPnl: number;
        marginUsed: number;
        leverage: number;
        markPrice: number;
        entryPrice: number;
        liquidationDistance?: number;
    } | undefined;
}
//# sourceMappingURL=position-tracker.d.ts.map