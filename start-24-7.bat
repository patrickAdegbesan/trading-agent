@echo off
echo Starting Crypto Trading Bot 24/7...
cd /d "C:\Users\seuna\OneDrive - CUL Host\Desktop\pat-proj\Crypto ML Trader\crypto-trading-agent"

REM Stop any existing instance
pm2 stop crypto-trading-bot 2>nul
pm2 delete crypto-trading-bot 2>nul

REM Start the bot with PM2
pm2 start ecosystem.config.js

REM Save PM2 configuration
pm2 save

REM Setup startup script (run once)
pm2 startup

echo.
echo ================================
echo  🚀 CRYPTO BOT IS NOW RUNNING 24/7!
echo ================================
echo.
echo Useful commands:
echo   pm2 status           - Check bot status
echo   pm2 logs crypto-trading-bot  - View live logs
echo   pm2 restart crypto-trading-bot - Restart bot
echo   pm2 stop crypto-trading-bot    - Stop bot
echo   pm2 monit           - Real-time monitoring
echo.
pause