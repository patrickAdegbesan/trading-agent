// Simple test to check what data the database is loading
const fs = require('fs');
const path = require('path');

async function testDatabase() {
    console.log('🔍 Testing database data loading...');
    
    // Check if trades file exists and read it
    const tradesPath = path.join(__dirname, 'trading_data', 'trades.json');
    console.log(`📂 Looking for trades at: ${tradesPath}`);
    
    if (fs.existsSync(tradesPath)) {
        const tradesData = fs.readFileSync(tradesPath, 'utf8');
        const trades = JSON.parse(tradesData);
        
        console.log(`✅ Found ${Object.keys(trades).length} trades in file:`);
        Object.values(trades).forEach((trade, index) => {
            console.log(`  ${index + 1}. ${trade.symbol} ${trade.side} ${trade.quantity} @ $${trade.price} - ${trade.status} (${new Date(trade.timestamp).toLocaleString()})`);
        });
        
        // Check performance file too
        const performancePath = path.join(__dirname, 'trading_data', 'performance.json');
        if (fs.existsSync(performancePath)) {
            const perfData = JSON.parse(fs.readFileSync(performancePath, 'utf8'));
            console.log(`\n📊 Performance data points: ${perfData.length}`);
            if (perfData.length > 0) {
                const latest = perfData[perfData.length - 1];
                console.log(`  Latest PnL: $${latest.totalPnL || 0}`);
                console.log(`  Win Rate: ${latest.winRate || 0}%`);
                console.log(`  Total Trades: ${latest.totalTrades || 0}`);
            }
        }
        
    } else {
        console.log('❌ Trades file not found!');
    }
    
    // Test URL endpoint
    console.log('\n🌐 Testing dashboard API...');
    try {
        const response = await fetch('http://localhost:3000/api/trades');
        if (response.ok) {
            const data = await response.json();
            console.log(`📡 API returned ${data.trades ? data.trades.length : 'unknown'} trades`);
        } else {
            console.log(`❌ API error: ${response.status} ${response.statusText}`);
        }
    } catch (error) {
        console.log(`❌ API fetch error: ${error.message}`);
    }
}

testDatabase();