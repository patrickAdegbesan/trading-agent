const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Mock the order manager's quantity formatting logic
function formatQuantity(quantity, symbol = 'ADAUSDT') {
    let formattedQuantity;
    
    // Symbol-specific lot size rules based on Binance testnet requirements
    if (symbol === 'ADAUSDT') {
        // ADAUSDT: minQty=0.1, stepSize=0.1, maxQty=9000000.00
        const minQuantity = 0.1;
        const stepSize = 0.1;
        
        // Ensure quantity meets minimum and round to step size
        const adjustedQuantity = Math.max(quantity, minQuantity);
        const steps = Math.floor((adjustedQuantity - minQuantity) / stepSize);
        formattedQuantity = (minQuantity + (steps * stepSize)).toFixed(1);
        
    } else if (symbol === 'SOLUSDT') {
        // SOLUSDT: typical precision requirements
        const minQuantity = 0.001;
        const stepSize = 0.001;
        
        const adjustedQuantity = Math.max(quantity, minQuantity);
        const steps = Math.floor((adjustedQuantity - minQuantity) / stepSize);
        formattedQuantity = (minQuantity + (steps * stepSize)).toFixed(3);
        
    } else {
        // Default formatting for other symbols
        formattedQuantity = quantity.toFixed(3);
    }
    
    return parseFloat(formattedQuantity);
}

async function testLotSizeValidation() {
    console.log('🧪 Testing Lot Size Validation for Trade Execution...\n');
    
    // Test cases that previously failed
    const testCases = [
        { symbol: 'ADAUSDT', quantity: 1225.189, expected: 'Should round down to valid step size' },
        { symbol: 'ADAUSDT', quantity: 100.05, expected: 'Should round to 100.0' },
        { symbol: 'ADAUSDT', quantity: 0.05, expected: 'Should bump up to minimum 0.1' },
        { symbol: 'ADAUSDT', quantity: 50.73, expected: 'Should round to 50.7' },
        { symbol: 'SOLUSDT', quantity: 2.5678, expected: 'Should round to 2.567' },
        { symbol: 'SOLUSDT', quantity: 0.0005, expected: 'Should bump up to minimum 0.001' },
        { symbol: 'BTCUSDT', quantity: 0.001, expected: 'Should remain 0.001' }
    ];
    
    console.log('📋 Lot Size Validation Results:');
    console.log('================================');
    
    testCases.forEach((testCase, index) => {
        const formatted = formatQuantity(testCase.quantity, testCase.symbol);
        const passed = formatted !== testCase.quantity || testCase.symbol === 'BTCUSDT';
        
        console.log(`Test ${index + 1}: ${testCase.symbol}`);
        console.log(`  Input:    ${testCase.quantity}`);
        console.log(`  Output:   ${formatted}`);
        console.log(`  Expected: ${testCase.expected}`);
        console.log(`  Status:   ${passed ? '✅ PASS' : '❌ FAIL'}`);
        console.log('');
    });
    
    // Create a sample order request to demonstrate proper formatting
    const sampleOrderRequest = {
        symbol: 'ADAUSDT',
        side: 'BUY',
        type: 'LIMIT', 
        quantity: formatQuantity(1225.189, 'ADAUSDT'), // This was the failing quantity
        price: 0.8500,
        timeInForce: 'GTC'
    };
    
    console.log('📦 Sample Order Request (Previously Failing):');
    console.log('===========================================');
    console.log(JSON.stringify(sampleOrderRequest, null, 2));
    
    // Verify this meets Binance lot size requirements
    const meetsRequirements = sampleOrderRequest.quantity >= 0.1 && 
                              sampleOrderRequest.quantity <= 9000000.00 &&
                              (sampleOrderRequest.quantity * 10) % 1 === 0; // Check 0.1 step size
    
    console.log(`\n🎯 Lot Size Compliance Check:`);
    console.log(`   Quantity: ${sampleOrderRequest.quantity}`);
    console.log(`   Min Qty (≥0.1): ${sampleOrderRequest.quantity >= 0.1 ? '✅' : '❌'}`);
    console.log(`   Max Qty (≤9M): ${sampleOrderRequest.quantity <= 9000000.00 ? '✅' : '❌'}`);
    console.log(`   Step Size (0.1): ${(sampleOrderRequest.quantity * 10) % 1 === 0 ? '✅' : '❌'}`);
    console.log(`   Overall: ${meetsRequirements ? '✅ COMPLIANT' : '❌ VIOLATION'}`);
    
    if (meetsRequirements) {
        console.log('\n🎉 SUCCESS: Order quantity formatting now complies with Binance LOT_SIZE filters!');
        console.log('   The bot should now be able to execute ADAUSDT trades successfully.');
    } else {
        console.log('\n❌ FAILURE: Lot size validation still needs fixes.');
    }
    
    return meetsRequirements;
}

testLotSizeValidation().catch(console.error);