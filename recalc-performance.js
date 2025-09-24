const DatabaseService = require('../src/database/database-service').DatabaseService;

async function recalculatePerformance() {
    console.log('🔄 Forcing performance recalculation with sample trades...');
    
    const db = new DatabaseService();
    
    try {
        // First, let's see what trades we have
        const trades = await db.getTrades();
        console.log(`📊 Found ${trades.length} trades in database`);
        
        if (trades.length > 0) {
            console.log('Sample trades:');
            trades.slice(0, 3).forEach(trade => {
                console.log(`- ${trade.symbol} ${trade.side} ${trade.quantity} @ $${trade.price} (${new Date(trade.timestamp).toLocaleString()})`);
            });
        }
        
        // Force performance calculation
        await db.calculateAndSavePerformanceMetrics();
        console.log('✅ Performance metrics recalculated');
        
        // Check the new performance data
        const performance = await db.getPerformance();
        console.log(`📈 Performance data points: ${performance.length}`);
        
        if (performance.length > 0) {
            console.log('Latest performance metrics:');
            const latest = performance[performance.length - 1];
            console.log(`- Total PnL: $${latest.totalPnL || 0}`);
            console.log(`- Win Rate: ${latest.winRate || 0}%`);
            console.log(`- Total Trades: ${latest.totalTrades || 0}`);
            console.log(`- Timestamp: ${new Date(latest.timestamp).toLocaleString()}`);
        }
        
    } catch (error) {
        console.error('❌ Error:', error);
    }
}

recalculatePerformance();