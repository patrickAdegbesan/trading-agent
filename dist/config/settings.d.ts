export interface TradingConfig {
    exchange: 'binance' | 'bybit';
    binance: {
        apiKey: string;
        apiSecret: string;
        testnet: boolean;
    };
    bybit: {
        apiKey: string;
        apiSecret: string;
    };
    database: {
        url: string;
        timescaleUrl?: string;
        redisEnabled: boolean;
        redisUrl: string;
    };
    trading: {
        pairs: string[];
        initialCapital: number;
        maxPositionSize: number;
        maxDailyDrawdown: number;
        leverage: number;
        intervalMs: number;
    };
    riskManagement: {
        kellyFraction: number;
        minTradeSize: number;
        maxTradesPerDay: number;
        circuitBreakerLossPercent: number;
    };
    positionManagement: {
        maxOrdersPerSymbol: number;
        tradeCooldownMinutes: number;
        allowMultiplePositions: boolean;
        allowHedging: boolean;
        minPriceChangePercent: number;
        signalDedupMinutes: number;
    };
    ml: {
        retrainIntervalHours: number;
        lookbackPeriods: number;
        featureWindowSize: number;
        minTrainingSamples: number;
    };
    logging: {
        level: string;
        filePath: string;
    };
    monitoring: {
        enabled: boolean;
        port: number;
        alertWebhookUrl?: string;
    };
    environment: {
        nodeEnv: string;
        port: number;
    };
}
export declare const settings: TradingConfig;
