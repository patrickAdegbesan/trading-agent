#!/usr/bin/env ts-node

import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Load paper trading environment
const envPath = path.join(__dirname, '..', '.env.paper-trading');
if (fs.existsSync(envPath)) {
  const result = dotenv.config({ path: envPath });
  if (result.error) {
    console.error('❌ Error loading .env.paper-trading:', result.error);
  } else {
    console.log('✅ Loaded environment from .env.paper-trading');
    console.log('🔍 API Key loaded:', process.env.BINANCE_TESTNET_API_KEY ? 'YES' : 'NO');
    console.log('🔍 Secret loaded:', process.env.BINANCE_TESTNET_SECRET_KEY ? 'YES' : 'NO');
  }
} else {
  console.error('❌ .env.paper-trading file not found at:', envPath);
}

import { paperTradingConfig, validatePaperTradingConfig } from '../config/paper-trading';

/**
 * Simple Paper Trading Script
 * Demonstrates how to use the trading bot safely
 */
async function runPaperTrading() {
  console.log('🤖 Crypto Trading Bot - Paper Trading Mode');
  console.log('==========================================');
  console.log('⚠️  TESTNET MODE - No real money at risk!\n');

  // Validate configuration
  console.log('🔍 Validating configuration...');
  if (!validatePaperTradingConfig(paperTradingConfig)) {
    console.error('❌ Configuration validation failed');
    process.exit(1);
  }

  console.log('✅ Paper trading configuration is valid!');
  console.log('\n📊 Trading Configuration:');
  console.log(`💰 Initial Capital: $${paperTradingConfig.trading.initialCapital}`);
  console.log(`📈 Trading Pairs: ${paperTradingConfig.trading.pairs.join(', ')}`);
  console.log(`🔒 Max Position Size: ${paperTradingConfig.trading.maxPositionSize * 100}%`);
  console.log(`⚠️  Max Daily Drawdown: ${paperTradingConfig.trading.maxDailyDrawdown * 100}%`);
  console.log(`🔄 Max Trades/Day: ${paperTradingConfig.riskManagement.maxTradesPerDay}`);
  console.log(`🛡️  Kelly Fraction: ${paperTradingConfig.riskManagement.kellyFraction}`);

  console.log('\n🚀 Ready to start paper trading!');
  console.log('\nNext steps:');
  console.log('1. Ensure you have Binance testnet credentials in .env.paper-trading');
  console.log('2. Run: npm run start:paper-trading');
  console.log('3. Monitor logs in the logs/ directory');
  console.log('4. Use the dashboard at http://localhost:3001 (when running)');

  console.log('\n⚡ Quick Start Commands:');
  console.log('npm run setup:paper-trading  # Run setup script');
  console.log('npm run start:paper-trading  # Start the bot');
  console.log('npm run test:paper-trading   # Run tests');

  console.log('\n� Safety Features Enabled:');
  console.log('✅ Testnet mode (no real money)');
  console.log('✅ Conservative position sizing (5% max)');
  console.log('✅ Daily trade limits (5 trades max)');
  console.log('✅ Circuit breaker (5% daily loss limit)');
  console.log('✅ Comprehensive logging');

  console.log('\n📚 For more details, see the documentation in README.md');
}

// Run the script
if (require.main === module) {
  runPaperTrading().catch(console.error);
}