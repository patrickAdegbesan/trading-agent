# ==========================================
# 24/7 CRYPTO TRADING BOT HOSTING GUIDE
# ==========================================

## 🏠 LOCAL HOSTING (Your Current PC)

### Windows Auto-Restart (Simplest)
1. Double-click `run-forever.bat` 
2. Bot will restart automatically if it crashes
3. To stop: Close the command window

### Windows Service (Advanced)
1. Install PM2: `npm install -g pm2`
2. Run: `pm2 start ecosystem.config.js`
3. Save: `pm2 save`
4. Setup startup: `pm2 startup` (follow instructions)

## ☁️ CLOUD HOSTING (Recommended for 24/7)

### DigitalOcean ($6/month)
```bash
# Create Ubuntu droplet
# SSH into server
ssh root@your-server-ip

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
apt-get install -y nodejs git

# Clone your project
git clone <your-repo-url>
cd crypto-trading-agent

# Install dependencies
npm install

# Install PM2
npm install -g pm2

# Start bot
pm2 start ecosystem.config.js
pm2 startup
pm2 save
```

### Railway (Free tier available)
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login and deploy
railway login
railway init
railway up
```

### Heroku ($7/month)
```bash
# Create Procfile
echo "worker: npm run start:paper-trading" > Procfile

# Deploy
heroku create your-bot-name
git push heroku main
heroku ps:scale worker=1
```

## 🔧 CONFIGURATION FOR 24/7 OPERATION

Your bot is now configured with:
- ✅ Lower duplicate signal threshold (0.1% vs 0.5%)
- ✅ 4 trading pairs (BTC, ETH, ADA, SOL)
- ✅ 45% confidence threshold (more aggressive)
- ✅ Auto-restart on crashes
- ✅ Professional logging

## 📊 MONITORING COMMANDS

```bash
# Check status
pm2 status

# View live logs
pm2 logs crypto-trading-bot

# Restart bot
pm2 restart crypto-trading-bot

# Stop bot
pm2 stop crypto-trading-bot

# Real-time monitoring
pm2 monit
```

## 💡 RECOMMENDED: DigitalOcean VPS

Benefits:
- $6/month for reliable hosting
- 24/7 uptime
- Better internet connection
- No dependency on your PC being on
- Easy to manage remotely

## 🚨 IMPORTANT NOTES

1. **Testnet**: Currently using Binance testnet (safe)
2. **Backups**: Bot data saved in database
3. **Monitoring**: Dashboard at http://localhost:3000
4. **Security**: Keep API keys secure
5. **Updates**: Pull latest code regularly

## 🎯 IMMEDIATE NEXT STEPS

1. **For Local 24/7**: Double-click `run-forever.bat`
2. **For Cloud**: Create DigitalOcean account and follow guide
3. **Monitor**: Check dashboard regularly
4. **Test**: Let it run for a few hours first