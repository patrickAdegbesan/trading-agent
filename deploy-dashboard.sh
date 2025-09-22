#!/bin/bash

# Deploy Dashboard Update Script
echo "🚀 Deploying Trading Bot Dashboard..."

# Add all files
git add .

# Commit changes
git commit -m "Add comprehensive trading dashboard with real-time monitoring

Features:
- Express.js API server with 8 endpoints
- Real-time dashboard with Chart.js visualizations
- Mobile-responsive design with dark theme
- Live trading data, ML predictions, portfolio tracking
- WebSocket-ready for real-time updates
- Professional UI with notifications system"

# Push to Heroku
git push heroku main

echo "✅ Dashboard deployment initiated!"
echo "📊 Dashboard will be available at: https://crypto-trading-bot-eu.herokuapp.com"
echo ""
echo "Available Endpoints:"
echo "🌐 Web Dashboard: /"
echo "📊 API Status: /api/status"
echo "📈 Trading Stats: /api/stats"
echo "💹 Live Data: /api/live-data"
echo "🤖 ML Predictions: /api/ml-predictions"
echo "💰 Portfolio: /api/portfolio"
echo "📋 Trades: /api/trades"
echo "📊 Performance: /api/performance"