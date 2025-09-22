"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.settings = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
const joi_1 = __importDefault(require("joi"));
const path_1 = require("path");
// Load environment variables
dotenv_1.default.config();
// Environment validation schema
const envSchema = joi_1.default.object({
    // Binance API
    BINANCE_API_KEY: joi_1.default.string().required(),
    BINANCE_API_SECRET: joi_1.default.string().required(),
    BINANCE_TESTNET: joi_1.default.boolean().default(true),
    // Database
    DATABASE_URL: joi_1.default.string().required(),
    TIMESCALE_DB_URL: joi_1.default.string().optional(),
    REDIS_URL: joi_1.default.string().default('redis://localhost:6379'),
    // Trading
    TRADING_PAIRS: joi_1.default.string().default('BTCUSDT,ETHUSDT'),
    INITIAL_CAPITAL: joi_1.default.number().positive().default(10000),
    MAX_POSITION_SIZE: joi_1.default.number().min(0).max(1).default(0.1),
    MAX_DAILY_DRAWDOWN: joi_1.default.number().min(0).max(1).default(0.05),
    LEVERAGE: joi_1.default.number().min(1).max(10).default(1),
    TRADING_INTERVAL_MS: joi_1.default.number().positive().default(5000),
    // Risk Management
    KELLY_FRACTION: joi_1.default.number().min(0).max(1).default(0.25),
    MIN_TRADE_SIZE: joi_1.default.number().positive().default(10),
    MAX_TRADES_PER_DAY: joi_1.default.number().positive().default(100),
    CIRCUIT_BREAKER_LOSS_PERCENT: joi_1.default.number().min(0).max(1).default(0.1),
    // Position Management
    MAX_ORDERS_PER_SYMBOL: joi_1.default.number().positive().default(1),
    TRADE_COOLDOWN_MINUTES: joi_1.default.number().positive().default(15), // Increased from 1 to 15 minutes
    ALLOW_MULTIPLE_POSITIONS: joi_1.default.boolean().default(false),
    ALLOW_HEDGING: joi_1.default.boolean().default(false),
    // Signal Filtering
    MIN_PRICE_CHANGE_PERCENT: joi_1.default.number().min(0).default(0.5), // Minimum 0.5% price change for new signal
    SIGNAL_DEDUP_MINUTES: joi_1.default.number().positive().default(5), // Ignore identical signals within 5 minutes
    // ML Configuration
    MODEL_RETRAIN_INTERVAL_HOURS: joi_1.default.number().positive().default(24),
    LOOKBACK_PERIODS: joi_1.default.number().positive().default(200),
    FEATURE_WINDOW_SIZE: joi_1.default.number().positive().default(50),
    MIN_TRAINING_SAMPLES: joi_1.default.number().positive().default(1000),
    // Logging
    LOG_LEVEL: joi_1.default.string().valid('error', 'warn', 'info', 'debug').default('info'),
    LOG_FILE_PATH: joi_1.default.string().default('./logs/trading.log'),
    // Monitoring
    ENABLE_METRICS: joi_1.default.boolean().default(true),
    METRICS_PORT: joi_1.default.number().port().default(3000),
    ALERT_WEBHOOK_URL: joi_1.default.string().uri().optional(),
    // Environment
    NODE_ENV: joi_1.default.string().valid('development', 'production', 'test').default('development'),
    PORT: joi_1.default.number().port().default(8080)
}).unknown(true);
// Validate environment variables
const { error, value: env } = envSchema.validate(process.env);
if (error) {
    throw new Error(`Environment validation error: ${error.message}`);
}
exports.settings = {
    binance: {
        apiKey: env.BINANCE_API_KEY,
        apiSecret: env.BINANCE_API_SECRET,
        testnet: env.BINANCE_TESTNET,
    },
    database: {
        url: env.DATABASE_URL,
        timescaleUrl: env.TIMESCALE_DB_URL,
        redisUrl: env.REDIS_URL,
    },
    trading: {
        pairs: env.TRADING_PAIRS.split(',').map((pair) => pair.trim()),
        initialCapital: env.INITIAL_CAPITAL,
        maxPositionSize: env.MAX_POSITION_SIZE,
        maxDailyDrawdown: env.MAX_DAILY_DRAWDOWN,
        leverage: env.LEVERAGE,
        intervalMs: env.TRADING_INTERVAL_MS,
    },
    riskManagement: {
        kellyFraction: env.KELLY_FRACTION,
        minTradeSize: env.MIN_TRADE_SIZE,
        maxTradesPerDay: env.MAX_TRADES_PER_DAY,
        circuitBreakerLossPercent: env.CIRCUIT_BREAKER_LOSS_PERCENT,
    },
    positionManagement: {
        maxOrdersPerSymbol: env.MAX_ORDERS_PER_SYMBOL,
        tradeCooldownMinutes: env.TRADE_COOLDOWN_MINUTES,
        allowMultiplePositions: env.ALLOW_MULTIPLE_POSITIONS,
        allowHedging: env.ALLOW_HEDGING,
        minPriceChangePercent: env.MIN_PRICE_CHANGE_PERCENT,
        signalDedupMinutes: env.SIGNAL_DEDUP_MINUTES,
    },
    ml: {
        retrainIntervalHours: env.MODEL_RETRAIN_INTERVAL_HOURS,
        lookbackPeriods: env.LOOKBACK_PERIODS,
        featureWindowSize: env.FEATURE_WINDOW_SIZE,
        minTrainingSamples: env.MIN_TRAINING_SAMPLES,
    },
    logging: {
        level: env.LOG_LEVEL,
        filePath: (0, path_1.resolve)(env.LOG_FILE_PATH),
    },
    monitoring: {
        enabled: env.ENABLE_METRICS,
        port: env.METRICS_PORT,
        alertWebhookUrl: env.ALERT_WEBHOOK_URL,
    },
    environment: {
        nodeEnv: env.NODE_ENV,
        port: env.PORT,
    },
};
//# sourceMappingURL=settings.js.map