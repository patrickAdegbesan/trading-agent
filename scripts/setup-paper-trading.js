#!/usr/bin/env node

/**
 * Paper Trading Setup Script
 * Helps users configure their environment for safe paper trading
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('🤖 Crypto Trading Bot - Paper Trading Setup');
console.log('===========================================\n');

console.log('This script will help you set up paper trading with Binance Testnet.');
console.log('Paper trading allows you to test strategies without risking real money.\n');

// Environment template for paper trading
const envTemplate = `# Paper Trading Environment Configuration
# IMPORTANT: These are TESTNET credentials - no real money involved

# Binance Testnet API Credentials
# Get these from: https://testnet.binance.vision/
BINANCE_TESTNET_API_KEY=your_testnet_api_key_here
BINANCE_TESTNET_SECRET_KEY=your_testnet_secret_key_here

# Force testnet mode (CRITICAL for safety)
BINANCE_TESTNET=true

# Database Configuration
DATABASE_URL=sqlite:./paper_trading.db
REDIS_URL=redis://localhost:6379

# Trading Configuration
TRADING_PAIRS=BTCUSDT
INITIAL_CAPITAL=10000
MAX_POSITION_SIZE=0.05
MAX_DAILY_DRAWDOWN=0.05
LEVERAGE=1

# Risk Management
KELLY_FRACTION=0.1
MIN_TRADE_SIZE=10
MAX_TRADES_PER_DAY=5
CIRCUIT_BREAKER_LOSS_PERCENT=5

# Machine Learning
RETRAIN_INTERVAL_HOURS=24
LOOKBACK_PERIODS=100
MIN_TRAINING_SAMPLES=1000

# Logging
LOG_LEVEL=debug
LOG_FILE_PATH=./logs/paper-trading.log

# Monitoring (optional)
MONITORING_ENABLED=true
MONITORING_PORT=3001
PAPER_TRADING_WEBHOOK_URL=your_webhook_url_here

# Environment
NODE_ENV=development
PORT=3001
`;

const setupSteps = [
  {
    title: '1. Create Binance Testnet Account',
    description: 'Visit https://testnet.binance.vision/ and create a testnet account',
    action: async () => {
      console.log('\n📝 Step 1: Binance Testnet Setup');
      console.log('================================');
      console.log('1. Go to: https://testnet.binance.vision/');
      console.log('2. Create a new testnet account (or login with your GitHub)');
      console.log('3. Generate API Keys:');
      console.log('   - Click "Generate HMAC_SHA256 Key"');
      console.log('   - Save your API Key and Secret Key');
      console.log('   - Enable Spot & Margin Trading permissions');
      console.log('\n⚠️  IMPORTANT: These are TEST credentials - no real money involved!');
      
      return new Promise((resolve) => {
        rl.question('\nPress Enter when you have your testnet API credentials ready... ', () => {
          resolve();
        });
      });
    }
  },
  
  {
    title: '2. Configure Environment Variables',
    description: 'Set up your .env file with testnet credentials',
    action: async () => {
      console.log('\n🔧 Step 2: Environment Configuration');
      console.log('===================================');
      
      const envPath = path.join(process.cwd(), '.env.paper-trading');
      
      // Create .env file
      fs.writeFileSync(envPath, envTemplate);
      console.log(`✅ Created ${envPath}`);
      
      return new Promise((resolve) => {
        rl.question('\nEnter your Binance Testnet API Key: ', (apiKey) => {
          rl.question('Enter your Binance Testnet Secret Key: ', (secretKey) => {
            
            // Update .env file with user credentials
            let envContent = fs.readFileSync(envPath, 'utf8');
            envContent = envContent.replace('your_testnet_api_key_here', apiKey);
            envContent = envContent.replace('your_testnet_secret_key_here', secretKey);
            fs.writeFileSync(envPath, envContent);
            
            console.log('✅ Environment file updated with your credentials');
            console.log(`📁 Location: ${envPath}`);
            resolve();
          });
        });
      });
    }
  },
  
  {
    title: '3. Install Dependencies',
    description: 'Install required packages for paper trading',
    action: async () => {
      console.log('\n📦 Step 3: Dependencies');
      console.log('======================');
      
      const { spawn } = require('child_process');
      
      return new Promise((resolve, reject) => {
        console.log('Installing dependencies...');
        const npm = spawn('npm', ['install'], { stdio: 'inherit' });
        
        npm.on('close', (code) => {
          if (code === 0) {
            console.log('✅ Dependencies installed successfully');
            resolve();
          } else {
            console.log('❌ Failed to install dependencies');
            reject(new Error('npm install failed'));
          }
        });
      });
    }
  },
  
  {
    title: '4. Create Logs Directory',
    description: 'Set up logging directories',
    action: async () => {
      console.log('\n📁 Step 4: Logging Setup');
      console.log('========================');
      
      const logsDir = path.join(process.cwd(), 'logs');
      if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true });
        console.log('✅ Created logs directory');
      } else {
        console.log('✅ Logs directory already exists');
      }
      
      return Promise.resolve();
    }
  },
  
  {
    title: '5. Validate Configuration',
    description: 'Test your paper trading setup',
    action: async () => {
      console.log('\n🔍 Step 5: Configuration Validation');
      console.log('===================================');
      
      try {
        // Load environment variables
        require('dotenv').config({ path: '.env.paper-trading' });
        
        // Import and validate config
        const { paperTradingConfig, validatePaperTradingConfig } = require('../config/paper-trading');
        
        const isValid = validatePaperTradingConfig(paperTradingConfig);
        
        if (isValid) {
          console.log('✅ Paper trading configuration is valid!');
        } else {
          console.log('❌ Configuration validation failed');
          console.log('Please check your environment variables and try again.');
        }
        
      } catch (error) {
        console.log('❌ Validation error:', error.message);
      }
      
      return Promise.resolve();
    }
  }
];

async function runSetup() {
  console.log('🚀 Starting paper trading setup...\n');
  
  try {
    for (const step of setupSteps) {
      console.log(`\n${step.title}`);
      console.log(step.description);
      await step.action();
    }
    
    console.log('\n🎉 Paper Trading Setup Complete!');
    console.log('================================');
    console.log('\nNext steps:');
    console.log('1. Run: npm run paper-trade');
    console.log('2. Monitor logs: tail -f logs/paper-trading.log');
    console.log('3. Check performance: http://localhost:3001/dashboard');
    console.log('\n📚 Documentation: See README.md for more details');
    console.log('\n⚠️  Remember: This is paper trading - no real money is at risk!');
    
  } catch (error) {
    console.error('\n❌ Setup failed:', error.message);
    console.log('\nPlease fix the error and run the setup again.');
  } finally {
    rl.close();
  }
}

// Safety check - prevent running in production
if (process.env.NODE_ENV === 'production') {
  console.error('❌ Paper trading setup should not be run in production!');
  process.exit(1);
}

// Run setup
runSetup().catch(console.error);