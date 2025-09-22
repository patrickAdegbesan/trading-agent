# 🚀 HEROKU DEPLOYMENT - STEP BY STEP

## 📋 Prerequisites
1. **Install Heroku CLI**: https://devcenter.heroku.com/articles/heroku-cli
2. **Create Heroku Account**: https://signup.heroku.com/

## ⚡ QUICK DEPLOYMENT

### Step 1: Install Heroku CLI
Download and install from: https://devcenter.heroku.com/articles/heroku-cli

### Step 2: Open PowerShell and navigate to your bot
```powershell
cd "C:\Users\seuna\OneDrive - CUL Host\Desktop\pat-proj\Crypto ML Trader\crypto-trading-agent"
```

### Step 3: Run the automated deployment script
```powershell
.\deploy-to-heroku.bat
```

## 🔧 Manual Deployment (if script fails)

```powershell
# 1. Login to Heroku
heroku login

# 2. Initialize Git (if needed)
git init
git add .
git commit -m "Initial commit"

# 3. Create Heroku app
heroku create your-crypto-bot-name

# 4. Set environment variables
heroku config:set BINANCE_API_KEY=g0t4S067V7C13GUyLHswDOkkRVSzQLuf6O0AY4KJsuVJlRqnvm71DwBJe1SEKol4
heroku config:set BINANCE_API_SECRET=vTDpmC7kT0fVQGfwrEYM4Pyfh8Lyndfqw09eyws5kqA4T3GgZZkxkQxTdYNOXFa2
heroku config:set BINANCE_TESTNET=true
heroku config:set TRADING_PAIRS=BTCUSDT,ETHUSDT,ADAUSDT,SOLUSDT
heroku config:set MIN_PRICE_CHANGE_PERCENT=0.1

# 5. Deploy
git push heroku main

# 6. Start the bot
heroku ps:scale worker=1
```

## 📊 Monitor Your Bot

```powershell
# View live logs
heroku logs --tail

# Check status
heroku ps

# Restart bot
heroku restart
```

## 💰 Pricing
- **Basic Plan**: $7/month for 24/7 operation
- **Free tier available** but sleeps after 30min (not suitable for trading)

## ✅ What's Included in Your Deployment
- ✅ Procfile configured for worker process
- ✅ All environment variables set
- ✅ Package.json with correct Node.js version
- ✅ GitIgnore file to exclude sensitive data
- ✅ Automated restart on crashes

## 🎯 Next Steps After Deployment
1. Run `heroku logs --tail` to see your bot starting
2. Your bot will be trading 24/7 on all 4 pairs
3. Monitor performance through Heroku dashboard
4. Bot will automatically restart if it crashes

## 🚨 Important Notes
- Bot runs on **Binance Testnet** (safe, no real money)
- All trades are logged and tracked
- Lower price change threshold (0.1%) for more active trading
- 45% confidence threshold for aggressive strategy