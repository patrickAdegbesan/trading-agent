@echo off
echo ========================================
echo  🚀 DEPLOYING CRYPTO BOT TO HEROKU
echo ========================================
echo.

REM Check if Heroku CLI is installed
heroku --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Heroku CLI not found!
    echo Please install from: https://devcenter.heroku.com/articles/heroku-cli
    pause
    exit /b 1
)

echo ✅ Heroku CLI found

REM Login to Heroku
echo.
echo Logging into Heroku...
heroku login

REM Check if git is initialized
if not exist .git (
    echo Initializing Git repository...
    git init
    git add .
    git commit -m "Initial commit for Heroku deployment"
) else (
    echo ✅ Git repository already exists
    git add .
    git commit -m "Deploy to Heroku"
)

REM Create Heroku app
echo.
set /p APP_NAME="Enter your Heroku app name (e.g., my-crypto-bot): "
heroku create %APP_NAME%

REM Set environment variables
echo.
echo Setting environment variables...
heroku config:set BINANCE_API_KEY=g0t4S067V7C13GUyLHswDOkkRVSzQLuf6O0AY4KJsuVJlRqnvm71DwBJe1SEKol4 --app %APP_NAME%
heroku config:set BINANCE_API_SECRET=vTDpmC7kT0fVQGfwrEYM4Pyfh8Lyndfqw09eyws5kqA4T3GgZZkxkQxTdYNOXFa2 --app %APP_NAME%
heroku config:set BINANCE_TESTNET=true --app %APP_NAME%
heroku config:set TRADING_PAIRS=BTCUSDT,ETHUSDT,ADAUSDT,SOLUSDT --app %APP_NAME%
heroku config:set DATABASE_URL=sqlite:./trading.db --app %APP_NAME%
heroku config:set REDIS_URL=redis://localhost:6379 --app %APP_NAME%
heroku config:set MAX_POSITION_SIZE=0.1 --app %APP_NAME%
heroku config:set KELLY_FRACTION=0.25 --app %APP_NAME%
heroku config:set MIN_TRADE_SIZE=10 --app %APP_NAME%
heroku config:set TRADING_INTERVAL_MS=5000 --app %APP_NAME%
heroku config:set TRADE_COOLDOWN_MINUTES=5 --app %APP_NAME%
heroku config:set MIN_PRICE_CHANGE_PERCENT=0.1 --app %APP_NAME%

REM Deploy to Heroku
echo.
echo Deploying to Heroku...
git push heroku main

REM Scale the worker
echo.
echo Starting the worker dyno...
heroku ps:scale worker=1 --app %APP_NAME%

echo.
echo ========================================
echo  🎉 DEPLOYMENT COMPLETE!
echo ========================================
echo.
echo Your bot is now running 24/7 on Heroku!
echo.
echo Useful commands:
echo   heroku logs --tail --app %APP_NAME%    (View live logs)
echo   heroku ps --app %APP_NAME%             (Check status)
echo   heroku restart --app %APP_NAME%        (Restart bot)
echo.
echo Cost: $7/month for Basic plan
echo.
pause