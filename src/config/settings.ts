import dotenv from 'dotenv';
import Joi from 'joi';
import { resolve } from 'path';

// Load environment variables
dotenv.config();

// Environment validation schema
const envSchema = Joi.object({
  // Binance API
  BINANCE_API_KEY: Joi.string().required(),
  BINANCE_API_SECRET: Joi.string().required(),
  BINANCE_TESTNET: Joi.boolean().default(true),

  // Database
  DATABASE_URL: Joi.string().required(),
  TIMESCALE_DB_URL: Joi.string().optional(),
  REDIS_URL: Joi.string().default('redis://localhost:6379'),

  // Trading
  TRADING_PAIRS: Joi.string().default('BTCUSDT,ETHUSDT'),
  INITIAL_CAPITAL: Joi.number().positive().default(10000),
  MAX_POSITION_SIZE: Joi.number().min(0).max(1).default(0.1),
  MAX_DAILY_DRAWDOWN: Joi.number().min(0).max(1).default(0.05),
  LEVERAGE: Joi.number().min(1).max(10).default(1),
  TRADING_INTERVAL_MS: Joi.number().positive().default(5000),

  // Risk Management
  KELLY_FRACTION: Joi.number().min(0).max(1).default(0.25),
  MIN_TRADE_SIZE: Joi.number().positive().default(10),
  MAX_TRADES_PER_DAY: Joi.number().positive().default(100),
  CIRCUIT_BREAKER_LOSS_PERCENT: Joi.number().min(0).max(1).default(0.1),

  // Position Management
  MAX_ORDERS_PER_SYMBOL: Joi.number().positive().default(1),
  TRADE_COOLDOWN_MINUTES: Joi.number().positive().default(15), // Increased from 1 to 15 minutes
  ALLOW_MULTIPLE_POSITIONS: Joi.boolean().default(false),
  ALLOW_HEDGING: Joi.boolean().default(false),
  
  // Signal Filtering
  MIN_PRICE_CHANGE_PERCENT: Joi.number().min(0).default(0.5), // Minimum 0.5% price change for new signal
  SIGNAL_DEDUP_MINUTES: Joi.number().positive().default(5), // Ignore identical signals within 5 minutes

  // ML Configuration
  MODEL_RETRAIN_INTERVAL_HOURS: Joi.number().positive().default(24),
  LOOKBACK_PERIODS: Joi.number().positive().default(200),
  FEATURE_WINDOW_SIZE: Joi.number().positive().default(50),
  MIN_TRAINING_SAMPLES: Joi.number().positive().default(1000),

  // Logging
  LOG_LEVEL: Joi.string().valid('error', 'warn', 'info', 'debug').default('info'),
  LOG_FILE_PATH: Joi.string().default('./logs/trading.log'),

  // Monitoring
  ENABLE_METRICS: Joi.boolean().default(true),
  METRICS_PORT: Joi.number().port().default(3000),
  ALERT_WEBHOOK_URL: Joi.string().uri().optional(),

  // Environment
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  PORT: Joi.number().port().default(8080)
}).unknown(true);

// Validate environment variables
const { error, value: env } = envSchema.validate(process.env);
if (error) {
  throw new Error(`Environment validation error: ${error.message}`);
}

export interface TradingConfig {
  binance: {
    apiKey: string;
    apiSecret: string;
    testnet: boolean;
  };
  database: {
    url: string;
    timescaleUrl?: string;
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

export const settings: TradingConfig = {
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
    pairs: env.TRADING_PAIRS.split(',').map((pair: string) => pair.trim()),
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
    filePath: resolve(env.LOG_FILE_PATH),
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