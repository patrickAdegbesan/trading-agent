@echo off
echo 🌙 Starting Overnight Trading Session...
echo.
echo ⏰ Session Start Time: %date% %time%
echo 📊 Logs will be saved to: logs\
echo 🔗 Dashboard will be available at: http://localhost:3000
echo.
echo 🚨 LIVE TRADING ENABLED - Real trades on Binance Testnet!
echo.
pause

echo.
echo 🚀 Launching trading bot with monitoring...
echo.

REM Start the trading bot
cd /d "%~dp0"
npm run start:paper-trading

echo.
echo 🛑 Trading session ended at: %date% %time%
echo 📈 Check logs\ folder for detailed session reports
echo.
pause