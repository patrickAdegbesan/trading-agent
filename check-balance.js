const Binance = require('binance-api-node').default;
const fs = require('fs');
const path = require('path');

// Load environment variables manually
const envFile = path.join(__dirname, '.env.paper-trading');
if (fs.existsSync(envFile)) {
    const envContent = fs.readFileSync(envFile, 'utf8');
    envContent.split('\n').forEach(line => {
        line = line.trim();
        if (line && !line.startsWith('#') && line.includes('=')) {
            const equalIndex = line.indexOf('=');
            const key = line.substring(0, equalIndex).trim();
            const value = line.substring(equalIndex + 1).trim();
            if (key && value) {
                process.env[key] = value;
                console.log(`📝 Loaded: ${key} = ${value.substring(0, 10)}...`);
            }
        }
    });
    console.log('✅ Environment file loaded');
    console.log('🔍 Checking immediately after load:');
    console.log('- BINANCE_TESTNET_API_KEY:', process.env.BINANCE_TESTNET_API_KEY ? 'Present' : 'Missing');
} else {
    console.log('❌ Environment file not found');
}

async function checkBalance() {
    try {
        // Use the testnet credentials directly
        const apiKey = 'g0t4S067V7C13GUyLHswDOkkRVSzQLuf6O0AY4KJsuVJlRqnvm71DwBJe1SEKol4';
        const apiSecret = 'vTDpmC7kT0fVQGfwrEYM4Pyfh8Lyndfqw09eyws5kqA4T3GgZZkxkQxTdYNOXFa2';
        
        console.log('🔑 Using testnet credentials');
        console.log('🔑 API Key:', apiKey.substring(0, 10) + '...');
        console.log('🔑 API Secret:', apiSecret.substring(0, 10) + '...');
        
        const client = Binance({
            apiKey: apiKey,
            apiSecret: apiSecret,
            useServerTime: true,
            httpBase: 'https://testnet.binance.vision',
        });

        console.log('🔍 Checking Binance Testnet Balance...\n');
        
        const accountInfo = await client.accountInfo();
        console.log('📊 Account Info:');
        console.log(`- Account Type: ${accountInfo.accountType}`);
        console.log(`- Can Trade: ${accountInfo.canTrade}`);
        console.log(`- Can Withdraw: ${accountInfo.canWithdraw}`);
        console.log(`- Can Deposit: ${accountInfo.canDeposit}\n`);

        console.log('💰 Balances:');
        const balances = accountInfo.balances.filter(balance => parseFloat(balance.free) > 0 || parseFloat(balance.locked) > 0);
        
        if (balances.length === 0) {
            console.log('❌ No funds found in testnet account!');
            console.log('\n🎯 To get testnet funds:');
            console.log('1. Visit: https://testnet.binance.vision/');
            console.log('2. Login with your testnet account');
            console.log('3. Go to "Wallet" -> "Faucet"');
            console.log('4. Claim free BTC, ETH, BNB, USDT');
        } else {
            balances.forEach(balance => {
                const free = parseFloat(balance.free);
                const locked = parseFloat(balance.locked);
                const total = free + locked;
                console.log(`- ${balance.asset}: ${total.toFixed(8)} (Free: ${free.toFixed(8)}, Locked: ${locked.toFixed(8)})`);
            });
        }

        console.log('\n🔍 Checking Symbol Info for Lot Sizes...\n');
        const exchangeInfo = await client.exchangeInfo();
        
        const symbols = ['BTCUSDT', 'ETHUSDT', 'ADAUSDT', 'SOLUSDT'];
        symbols.forEach(symbol => {
            const symbolInfo = exchangeInfo.symbols.find(s => s.symbol === symbol);
            if (symbolInfo) {
                const lotSizeFilter = symbolInfo.filters.find(f => f.filterType === 'LOT_SIZE');
                const minNotionalFilter = symbolInfo.filters.find(f => f.filterType === 'MIN_NOTIONAL');
                
                console.log(`📈 ${symbol}:`);
                console.log(`  - Min Quantity: ${lotSizeFilter?.minQty}`);
                console.log(`  - Max Quantity: ${lotSizeFilter?.maxQty}`);
                console.log(`  - Step Size: ${lotSizeFilter?.stepSize}`);
                console.log(`  - Min Notional: ${minNotionalFilter?.minNotional || 'N/A'}`);
                console.log('');
            }
        });

    } catch (error) {
        console.error('❌ Error checking balance:', error.message);
        if (error.code === -2015) {
            console.log('\n🔑 Invalid API credentials. Please check:');
            console.log('1. BINANCE_API_KEY in .env.paper-trading');
            console.log('2. BINANCE_API_SECRET in .env.paper-trading');
            console.log('3. Make sure they are testnet API keys');
        }
    }
}

checkBalance();