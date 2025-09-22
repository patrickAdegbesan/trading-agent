import { TradingConfig } from '../src/config/settings';

/**
 * Paper Trading Configuration
 * Safe settings for testing without risking real money
 */
export const paperTradingConfig: TradingConfig = {
  // Binance Configuration (Testnet)
  binance: {
    apiKey: process.env.BINANCE_TESTNET_API_KEY || '',
    apiSecret: process.env.BINANCE_TESTNET_SECRET_KEY || '',
    testnet: true // CRITICAL: Use testnet mode
  },

  // Database Configuration
  database: {
    url: process.env.DATABASE_URL || 'sqlite:./paper_trading.db',
    timescaleUrl: process.env.TIMESCALE_DB_URL,
    redisUrl: process.env.REDIS_URL || 'redis://localhost:6379'
  },

  // Trading Configuration - Conservative Settings
  trading: {
    pairs: ['BTCUSDT'], // Start with just Bitcoin
    initialCapital: 10000, // $10k virtual money
    maxPositionSize: 0.05, // Max 5% per trade (conservative)
    maxDailyDrawdown: 0.05, // 5% max daily loss
    leverage: 1, // No leverage for paper trading
    intervalMs: 5000 // 5 second intervals
  },

  // Risk Management - Extra Conservative for Testing
  riskManagement: {
    kellyFraction: 0.1, // Very conservative Kelly sizing
    minTradeSize: 10, // $10 minimum
    maxTradesPerDay: 5, // Limited trading frequency
    circuitBreakerLossPercent: 5 // Stop at 5% daily loss
  },

  // Position Management - Conservative Settings
  positionManagement: {
    maxOrdersPerSymbol: 1, // One order per symbol
    tradeCooldownMinutes: 15, // 15 minute cooldown between trades
    allowMultiplePositions: false, // No multiple positions
    allowHedging: false, // No hedging for simplicity
    minPriceChangePercent: 0.5, // Require 0.5% price change for new signal
    signalDedupMinutes: 5 // Ignore duplicate signals within 5 minutes
  },

  // Machine Learning - Conservative Predictions
  ml: {
    retrainIntervalHours: 24, // Retrain daily
    lookbackPeriods: 100, // 100 periods of historical data
    featureWindowSize: 20, // 20 periods for features
    minTrainingSamples: 1000 // Require substantial training data
  },

  // Logging - Comprehensive for Testing
  logging: {
    level: 'debug', // Maximum detail for paper trading
    filePath: './logs/paper-trading.log'
  },

  // Monitoring
  monitoring: {
    enabled: true,
    port: 3001, // Different port from production
    alertWebhookUrl: process.env.PAPER_TRADING_WEBHOOK_URL
  },

  // Environment
  environment: {
    nodeEnv: 'development',
    port: 3001
  }
};

/**
 * Environment-specific overrides for paper trading
 */
export const getEnvironmentConfig = (): Partial<TradingConfig> => {
  const env = process.env.NODE_ENV || 'development';
  
  switch (env) {
    case 'production':
      return {
        // Even in production, force testnet for safety
        binance: {
          ...paperTradingConfig.binance,
          testnet: true // SAFETY: Force testnet
        },
        logging: {
          level: 'info',
          filePath: './logs/paper-trading-prod.log'
        }
      };
      
    case 'testing':
      return {
        trading: {
          ...paperTradingConfig.trading,
          initialCapital: 1000, // Smaller for tests
          intervalMs: 100 // Faster for testing
        },
        riskManagement: {
          ...paperTradingConfig.riskManagement,
          maxTradesPerDay: 100 // No limits for testing
        }
      };
      
    default: // development
      return paperTradingConfig;
  }
};

/**
 * Validation function to ensure safe paper trading setup
 */
export const validatePaperTradingConfig = (config: TradingConfig): boolean => {
  const errors: string[] = [];
  
  // Critical safety checks
  if (!config.binance.testnet) {
    errors.push('Testnet mode must be enabled for paper trading');
  }
  
  if (config.trading.maxPositionSize > 0.1) {
    errors.push('Position size too large for paper trading (max 10%)');
  }
  
  if (config.riskManagement.maxTradesPerDay > 10) {
    errors.push('Too many trades per day for testing (max 10)');
  }
  
  if (config.riskManagement.circuitBreakerLossPercent > 10) {
    errors.push('Circuit breaker threshold too high (max 10%)');
  }
  
  if (config.trading.leverage > 1) {
    errors.push('Leverage should be 1 for paper trading');
  }
  
  // Environment variable checks
  if (!config.binance.apiKey) {
    errors.push('BINANCE_TESTNET_API_KEY environment variable not set');
  }
  
  if (!config.binance.apiSecret) {
    errors.push('BINANCE_TESTNET_SECRET_KEY environment variable not set');
  }
  
  if (errors.length > 0) {
    console.error('❌ Paper Trading Configuration Errors:');
    errors.forEach(error => console.error(`  - ${error}`));
    return false;
  }
  
  console.log('✅ Paper trading configuration is valid and safe');
  return true;
};