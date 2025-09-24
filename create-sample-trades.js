const fs = require('fs');
const path = require('path');

async function createSampleTrades() {
    console.log('🔧 Creating sample trades with varied PnL...');
    
    const tradesPath = path.join(__dirname, 'trading_data', 'trades.json');
    const performancePath = path.join(__dirname, 'trading_data', 'performance.json');
    
    // Sample trades with realistic price differences to show PnL
    const sampleTrades = {
        // Winning BTC trade (bought low, sold high)
        "trade_win_btc_001": {
            id: "trade_win_btc_001",
            timestamp: Date.now() - 3600000, // 1 hour ago
            symbol: "BTCUSDT", 
            side: "BUY",
            type: "LIMIT",
            quantity: 0.001,
            price: 95000,      // Entry price
            executedPrice: 95000,
            orderId: "order_win_btc_001",
            status: "FILLED",
            confidence: 0.75,
            riskScore: 35,
            strategy: "ml_prediction"
        },
        
        // Corresponding sell (profit)
        "trade_win_btc_002": {
            id: "trade_win_btc_002",
            timestamp: Date.now() - 1800000, // 30 mins ago
            symbol: "BTCUSDT",
            side: "SELL", 
            type: "LIMIT",
            quantity: 0.001,
            price: 96500,      // Exit price (+$1500 profit)
            executedPrice: 96500,
            orderId: "order_win_btc_002", 
            status: "FILLED",
            confidence: 0.65,
            riskScore: 25,
            strategy: "ml_prediction"
        },
        
        // Losing ETH trade (bought high, sold low)
        "trade_loss_eth_001": {
            id: "trade_loss_eth_001",
            timestamp: Date.now() - 7200000, // 2 hours ago
            symbol: "ETHUSDT",
            side: "BUY",
            type: "LIMIT", 
            quantity: 0.5,
            price: 3400,       // Entry price
            executedPrice: 3400,
            orderId: "order_loss_eth_001",
            status: "FILLED",
            confidence: 0.60,
            riskScore: 45,
            strategy: "moving_average_crossover"
        },
        
        "trade_loss_eth_002": {
            id: "trade_loss_eth_002",
            timestamp: Date.now() - 3600000, // 1 hour ago
            symbol: "ETHUSDT",
            side: "SELL",
            type: "LIMIT",
            quantity: 0.5,
            price: 3250,       // Exit price (-$75 loss)
            executedPrice: 3250,
            orderId: "order_loss_eth_002",
            status: "FILLED", 
            confidence: 0.55,
            riskScore: 55,
            strategy: "stop_loss"
        },
        
        // Winning ADA trade
        "trade_win_ada_001": {
            id: "trade_win_ada_001", 
            timestamp: Date.now() - 5400000, // 1.5 hours ago
            symbol: "ADAUSDT",
            side: "BUY",
            type: "LIMIT",
            quantity: 100.0,
            price: 0.8000,     // Entry price
            executedPrice: 0.8000,
            orderId: "order_win_ada_001",
            status: "FILLED",
            confidence: 0.70,
            riskScore: 30,
            strategy: "adaptive_strategy"
        },
        
        "trade_win_ada_002": {
            id: "trade_win_ada_002",
            timestamp: Date.now() - 1200000, // 20 mins ago  
            symbol: "ADAUSDT",
            side: "SELL", 
            type: "LIMIT",
            quantity: 100.0,
            price: 0.8350,     // Exit price (+$3.50 profit)
            executedPrice: 0.8350,
            orderId: "order_win_ada_002",
            status: "FILLED",
            confidence: 0.65,
            riskScore: 25,
            strategy: "adaptive_strategy"
        },
        
        // Recent SOL trade (still open position)
        "trade_sol_open_001": {
            id: "trade_sol_open_001",
            timestamp: Date.now() - 600000, // 10 mins ago
            symbol: "SOLUSDT", 
            side: "BUY",
            type: "LIMIT",
            quantity: 2.5,
            price: 210.00,     // Entry price
            executedPrice: 210.00,
            orderId: "order_sol_open_001",
            status: "FILLED",
            confidence: 0.80,
            riskScore: 20,
            strategy: "ml_prediction"
        }
    };
    
    // Write sample trades
    fs.writeFileSync(tradesPath, JSON.stringify(sampleTrades, null, 2));
    console.log(`✅ Created ${Object.keys(sampleTrades).length} sample trades in ${tradesPath}`);
    
    // Create updated performance data
    const currentTime = Date.now();
    const performanceData = [];
    
    // Calculate cumulative PnL over time
    let cumulativePnL = 0;
    let totalTrades = 0;
    let winningTrades = 0;
    
    // BTC win: +$1.50
    cumulativePnL += 1.50;
    totalTrades += 2;  
    winningTrades += 1;
    performanceData.push({
        totalTrades: totalTrades,
        winningTrades: winningTrades,
        losingTrades: totalTrades - winningTrades,
        winRate: (winningTrades / totalTrades) * 100,
        totalPnL: cumulativePnL,
        maxDrawdown: 0,
        maxDrawdownPercent: 0,
        sharpeRatio: 1.25,
        averageWin: 1.50,
        averageLoss: 0,
        profitFactor: 0,
        timestamp: currentTime - 1800000
    });
    
    // ETH loss: -$75
    cumulativePnL -= 75.00;
    totalTrades += 2;
    performanceData.push({
        totalTrades: totalTrades,
        winningTrades: winningTrades,
        losingTrades: totalTrades - winningTrades,
        winRate: (winningTrades / totalTrades) * 100,
        totalPnL: cumulativePnL,
        maxDrawdown: 75.00,
        maxDrawdownPercent: 98.0,
        sharpeRatio: -0.85,
        averageWin: 1.50,
        averageLoss: 75.00,
        profitFactor: 0.02,
        timestamp: currentTime - 3600000
    });
    
    // ADA win: +$35.00
    cumulativePnL += 35.00;
    totalTrades += 2;
    winningTrades += 1;
    performanceData.push({
        totalTrades: totalTrades,
        winningTrades: winningTrades,
        losingTrades: totalTrades - winningTrades,
        winRate: (winningTrades / totalTrades) * 100,
        totalPnL: cumulativePnL,
        maxDrawdown: 75.00,
        maxDrawdownPercent: 49.2,
        sharpeRatio: 0.45,
        averageWin: 18.25,
        averageLoss: 75.00,
        profitFactor: 0.49,
        timestamp: currentTime - 1200000
    });
    
    // Current position
    performanceData.push({
        totalTrades: totalTrades + 1, // SOL entry
        winningTrades: winningTrades,
        losingTrades: totalTrades - winningTrades,
        winRate: (winningTrades / (totalTrades + 1)) * 100,
        totalPnL: cumulativePnL, // Unrealized position
        maxDrawdown: 75.00,
        maxDrawdownPercent: 49.2,
        sharpeRatio: 0.45,
        averageWin: 18.25,
        averageLoss: 75.00,
        profitFactor: 0.49,
        timestamp: currentTime
    });
    
    // Write performance data
    fs.writeFileSync(performancePath, JSON.stringify(performanceData, null, 2));
    console.log(`✅ Updated performance data with ${performanceData.length} records`);
    
    console.log('💰 Sample Trade Summary:');
    console.log('- BTC: +$1.50 profit (0.001 BTC @ $95K → $96.5K)');
    console.log('- ETH: -$75.00 loss (0.5 ETH @ $3400 → $3250)');
    console.log('- ADA: +$35.00 profit (100 ADA @ $0.80 → $0.835)');
    console.log('- SOL: Open position (2.5 SOL @ $210.00)');
    console.log(`- Net PnL: $${cumulativePnL.toFixed(2)}`);
    console.log(`- Win Rate: ${((winningTrades / totalTrades) * 100).toFixed(1)}%`);
    
}

createSampleTrades().catch(console.error);