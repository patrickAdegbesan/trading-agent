# Heroku Deployment Guide for Crypto Trading Bot

## Prerequisites
1. Install Heroku CLI: https://devcenter.heroku.com/articles/heroku-cli
2. Create a Heroku account: https://signup.heroku.com/

## Environment Variables for Heroku
Your bot needs these environment variables set in Heroku:

```bash
BINANCE_API_KEY=g0t4S067V7C13GUyLHswDOkkRVSzQLuf6O0AY4KJsuVJlRqnvm71DwBJe1SEKol4
BINANCE_API_SECRET=vTDpmC7kT0fVQGfwrEYM4Pyfh8Lyndfqw09eyws5kqA4T3GgZZkxkQxTdYNOXFa2
BINANCE_TESTNET=true
TRADING_PAIRS=BTCUSDT,ETHUSDT,ADAUSDT,SOLUSDT
DATABASE_URL=sqlite:./trading.db
REDIS_URL=redis://localhost:6379
MAX_POSITION_SIZE=0.1
KELLY_FRACTION=0.25
MIN_TRADE_SIZE=10
TRADING_INTERVAL_MS=5000
TRADE_COOLDOWN_MINUTES=5
MIN_PRICE_CHANGE_PERCENT=0.1
```

## Deployment Steps

1. **Install Heroku CLI and login:**
```bash
# Download from: https://devcenter.heroku.com/articles/heroku-cli
heroku login
```

2. **Initialize Git repository (if not already done):**
```bash
git init
git add .
git commit -m "Initial commit"
```

3. **Create Heroku app:**
```bash
heroku create your-crypto-bot-name
```

4. **Set environment variables:**
```bash
heroku config:set BINANCE_API_KEY=g0t4S067V7C13GUyLHswDOkkRVSzQLuf6O0AY4KJsuVJlRqnvm71DwBJe1SEKol4
heroku config:set BINANCE_API_SECRET=vTDpmC7kT0fVQGfwrEYM4Pyfh8Lyndfqw09eyws5kqA4T3GgZZkxkQxTdYNOXFa2
heroku config:set BINANCE_TESTNET=true
heroku config:set TRADING_PAIRS=BTCUSDT,ETHUSDT,ADAUSDT,SOLUSDT
heroku config:set DATABASE_URL=sqlite:./trading.db
heroku config:set REDIS_URL=redis://localhost:6379
heroku config:set MAX_POSITION_SIZE=0.1
heroku config:set KELLY_FRACTION=0.25
heroku config:set MIN_TRADE_SIZE=10
heroku config:set TRADING_INTERVAL_MS=5000
heroku config:set TRADE_COOLDOWN_MINUTES=5
heroku config:set MIN_PRICE_CHANGE_PERCENT=0.1
```

5. **Deploy to Heroku:**
```bash
git push heroku main
```

6. **Scale the worker dyno:**
```bash
heroku ps:scale worker=1
```

7. **Monitor your bot:**
```bash
heroku logs --tail
```

## Monitoring Commands

```bash
# View live logs
heroku logs --tail

# Check dyno status
heroku ps

# Restart bot
heroku restart

# Stop bot
heroku ps:scale worker=0

# Start bot
heroku ps:scale worker=1

# View config
heroku config
```

## Cost
- **Basic Plan**: $7/month for 24/7 operation
- **Eco Plan**: $5/month but sleeps after 30 min (not suitable for trading)

## Advantages of Heroku
- ✅ True 24/7 uptime
- ✅ Automatic restarts on crashes
- ✅ Easy deployment and monitoring
- ✅ Built-in logging
- ✅ No server management needed
- ✅ Git-based deployments