@echo off
:RESTART
echo [%DATE% %TIME%] Starting Crypto Trading Bot...
cd /d "C:\Users\seuna\OneDrive - CUL Host\Desktop\pat-proj\Crypto ML Trader\crypto-trading-agent"
npm run start:paper-trading
echo [%DATE% %TIME%] Bot crashed, restarting in 10 seconds...
timeout /t 10
goto RESTART