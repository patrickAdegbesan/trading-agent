import { PredictionEngine } from '../ml/prediction-engine';
import { PortfolioManager } from '../portfolio/portfolio-manager';
import { OrderManager } from '../exchanges/order-manager';
import { RiskManager } from '../portfolio/risk-manager';
import { TradingSignal, TradeResult, OrderRequest, OrderType } from '../types';
import { settings } from '../config/settings';
import { EventEmitter } from 'events';

export class TradingAgent extends EventEmitter {
    private predictionEngine: PredictionEngine;
    private portfolioManager: PortfolioManager;
    private orderManager: OrderManager;
    private riskManager: RiskManager;
    private isActive: boolean = false;
    private lastTradeTime: Map<string, number> = new Map(); // Track last trade time per symbol
    private lastSignalCache: Map<string, { signal: TradingSignal; timestamp: number; price: number }> = new Map(); // Cache last signals
    private readonly TRADE_COOLDOWN_MS: number;
    private readonly MAX_ORDERS_PER_SYMBOL: number;
    private readonly MIN_PRICE_CHANGE_PERCENT: number;
    private readonly SIGNAL_DEDUP_MS: number;

    /**
     * Set trading agent active state
     */
    public setActive(active: boolean): void {
        this.isActive = active;
        console.log(`Trading agent ${active ? 'activated' : 'deactivated'}`);
    }

    /**
     * Check if signal should be processed (deduplication logic)
     */
    private shouldProcessSignal(signal: TradingSignal): { shouldProcess: boolean; reason?: string } {
        const now = Date.now();
        const lastSignalData = this.lastSignalCache.get(signal.symbol);

        // Ensure we have a valid price
        if (!signal.price || signal.price <= 0) {
            return { shouldProcess: false, reason: 'Invalid signal price' };
        }

        // If no previous signal, always process
        if (!lastSignalData) {
            this.lastSignalCache.set(signal.symbol, {
                signal,
                timestamp: now,
                price: signal.price
            });
            return { shouldProcess: true };
        }

        // Check if enough time has passed since last signal
        const timeSinceLastSignal = now - lastSignalData.timestamp;
        if (timeSinceLastSignal < this.SIGNAL_DEDUP_MS) {
            // Check if signal is significantly different
            const priceDiff = Math.abs(signal.price - lastSignalData.price) / lastSignalData.price * 100;
            const sameSide = signal.side === lastSignalData.signal.side;
            
            if (sameSide && priceDiff < this.MIN_PRICE_CHANGE_PERCENT) {
                return { 
                    shouldProcess: false, 
                    reason: `Duplicate signal: same side (${signal.side}), price change ${priceDiff.toFixed(2)}% < ${this.MIN_PRICE_CHANGE_PERCENT}%` 
                };
            }
        }

        // Update cache with new signal
        this.lastSignalCache.set(signal.symbol, {
            signal,
            timestamp: now,
            price: signal.price
        });

        return { shouldProcess: true };
    }

    constructor(
        predictionEngine: PredictionEngine,
        portfolioManager: PortfolioManager,
        orderManager: OrderManager,
        riskManager: RiskManager
    ) {
        super();
        this.predictionEngine = predictionEngine;
        this.portfolioManager = portfolioManager;
        this.orderManager = orderManager;
        this.riskManager = riskManager;
        
        // Initialize configurable settings
        this.TRADE_COOLDOWN_MS = settings.positionManagement.tradeCooldownMinutes * 60 * 1000;
        this.MAX_ORDERS_PER_SYMBOL = settings.positionManagement.maxOrdersPerSymbol;
        this.MIN_PRICE_CHANGE_PERCENT = settings.positionManagement.minPriceChangePercent;
        this.SIGNAL_DEDUP_MS = settings.positionManagement.signalDedupMinutes * 60 * 1000;
    }

    /**
     * Execute a trade based on ML prediction signal
     */
    private readonly MIN_CONFIDENCE = parseFloat(process.env.MIN_CONFIDENCE || '45') / 100; // Use env var, default 45%

    async executeTrade(signal: TradingSignal): Promise<TradeResult> {
        try {
            // Log received signal
            console.log(`[TradingAgent] Received signal:`, JSON.stringify(signal));

            // 🔍 SIGNAL DEDUPLICATION CHECK
            const dedupCheck = this.shouldProcessSignal(signal);
            if (!dedupCheck.shouldProcess) {
                console.log(`🔄 Skipping duplicate signal for ${signal.symbol}: ${dedupCheck.reason}`);
                return {
                    success: false,
                    reason: dedupCheck.reason || 'Duplicate signal filtered'
                };
            }

            // Check confidence threshold
            if (!signal.confidence || signal.confidence < this.MIN_CONFIDENCE) {
                const result = {
                    success: false,
                    reason: 'Insufficient confidence level'
                };
                this.emit('error', { error: new Error(result.reason), signal, timestamp: Date.now() });
                return result;
            }

            // 🔒 DUPLICATE TRADE PREVENTION
            // Check if there are already active orders for this symbol
            const activeOrders = this.orderManager.getActiveOrdersForSymbol(signal.symbol);
            if (activeOrders.length >= this.MAX_ORDERS_PER_SYMBOL) {
                console.log(`⚠️ Skipping trade for ${signal.symbol} - ${activeOrders.length} active orders already exist (max: ${this.MAX_ORDERS_PER_SYMBOL})`);
                return {
                    success: false,
                    reason: `Maximum orders per symbol reached (${activeOrders.length}/${this.MAX_ORDERS_PER_SYMBOL})`
                };
            }

            // Check trade cooldown (prevent spam trading)
            const lastTradeTime = this.lastTradeTime.get(signal.symbol) || 0;
            const timeSinceLastTrade = Date.now() - lastTradeTime;
            if (timeSinceLastTrade < this.TRADE_COOLDOWN_MS) {
                const remainingCooldown = Math.ceil((this.TRADE_COOLDOWN_MS - timeSinceLastTrade) / 1000);
                console.log(`⏰ Trade cooldown active for ${signal.symbol} - ${remainingCooldown}s remaining`);
                return {
                    success: false,
                    reason: `Trade cooldown active (${remainingCooldown}s remaining)`
                };
            }
            
            // Skip CLOSE signals for now - we'll handle position closing separately
            if (signal.side === 'CLOSE') {
                console.log(`[TradingAgent] CLOSE signal received for ${signal.symbol}, skipping order execution.`);
                return {
                    success: false,
                    reason: 'CLOSE signals not yet implemented'
                };
            }

            // Get current portfolio status
            const portfolio = await this.portfolioManager.getPortfolio();
            
            // Convert TradingSignal to TradeSignal for risk assessment
            const tradeSignal = {
                symbol: signal.symbol,
                side: signal.side as 'BUY' | 'SELL', // Cast to compatible type
                confidence: signal.confidence,
                timestamp: signal.timestamp,
                winProbability: signal.winProbability,
                expectedReturn: signal.expectedReturn
            };
            
            // Calculate risk-adjusted position size using proper risk assessment
            const riskAssessment = this.riskManager.assessTradeRisk(tradeSignal, signal.price || 0);
            
            if (!riskAssessment.approved) {
                console.log(`⚠️ Trade rejected by risk manager: ${riskAssessment.reason}`);
                return {
                    success: false,
                    reason: riskAssessment.reason
                };
            }

            const positionSize = riskAssessment.positionSize;
            if (!positionSize || positionSize <= 0) {
                return {
                    success: false,
                    reason: 'Invalid position size calculated'
                };
            }

            // Prepare order request
            const orderRequest: OrderRequest = {
                symbol: signal.symbol,
                side: signal.side as 'BUY' | 'SELL',
                type: 'LIMIT' as OrderType,
                quantity: positionSize,
                price: signal.price
            };

            // Execute the trade through order manager
            const result = await this.orderManager.submitOrder(orderRequest);
            
            // Update portfolio if trade was successful
            if (result.success && result.details) {
                // Record trade time for cooldown tracking
                this.lastTradeTime.set(signal.symbol, Date.now());
                
                await this.portfolioManager.updateAfterTrade({
                    symbol: result.details.symbol,
                    quantity: result.details.quantity,
                    price: result.details.price,
                    timestamp: result.details.timestamp
                });
                
                // Log successful trade with complete details
                console.log(`🎯 ML-DRIVEN TRADE EXECUTED for ${signal.symbol}:`, {
                    orderId: result.orderId,
                    size: result.details.quantity,
                    price: result.details.price,
                    side: signal.side,
                    stopLoss: signal.stopLoss,
                    takeProfit: signal.takeProfit,
                    confidence: signal.confidence
                });
                
                this.emit('trade', { signal, result, timestamp: Date.now() });
            }

            return result;
        } catch (error: any) {
            console.error('Trade execution failed:', error);
            return {
                success: false,
                reason: error?.message || 'Unknown error during trade execution',
                error
            };
        }
    }

    /**
     * Check for filled orders and update PnL
     */
    private async checkForFilledOrders(): Promise<void> {
        try {
            const activeOrders = this.orderManager.getActiveOrders();
            
            for (const order of activeOrders) {
                try {
                    // TODO: Query exchange for order status
                    // For now, we'll add logging to track order lifecycle
                    const timeSinceOrder = Date.now() - order.timestamp.getTime();
                    
                    // Log orders that have been pending for more than 5 minutes
                    if (timeSinceOrder > 5 * 60 * 1000) {
                        console.log(`📋 Order ${order.id} (${order.symbol}) pending for ${Math.round(timeSinceOrder / 60000)} minutes`);
                    }
                } catch (error) {
                    console.error(`Error checking order ${order.id}:`, error);
                }
            }
        } catch (error) {
            console.error('Error checking filled orders:', error);
        }
    }

    /**
     * Emergency stop all trading activity
     */
    /**
     * Emergency stop all trading activity
     */
    public async emergencyStop(): Promise<void> {
        try {
            console.log('🛑 EMERGENCY STOP ACTIVATED');
            this.isActive = false;
            
            // Cancel all active orders
            const activeOrders = await this.orderManager.getActiveOrders();
            
            const cancelPromises = activeOrders.map(async (order) => {
                try {
                    await this.orderManager.cancelOrder(order.id, order.symbol);
                    console.log(`❌ Cancelled order ${order.id}`);
                } catch (error) {
                    console.error(`Failed to cancel order ${order.id}:`, error);
                }
            });
            
            await Promise.all(cancelPromises);
            
            // Close all open positions
            await this.portfolioManager.closeAllPositions();
            
            this.emit('emergencyStop', { timestamp: Date.now() });
            console.log('✅ Emergency stop completed');
        } catch (error) {
            console.error('Emergency stop failed:', error);
            throw error;
        }
    }

    /**
     * Start the trading agent
     */
    async run(): Promise<void> {
        console.log('🤖 Starting autonomous trading agent...');
        this.isActive = true;
        
        while (this.isActive) {
            try {
                // Get market data and generate prediction
                const signal = await this.predictionEngine.generateSignal({
                    symbol: 'BTCUSDT', // Default to BTC - this should come from config
                    currentPrice: 0,
                    priceHistory: [],
                    volume: 0,
                    indicators: {},
                    marketData: []
                });
                
                // Process the trading signal if generated
                if (signal) {
                    if (!this.isActive) break;
                    
                    try {
                        const result = await this.executeTrade(signal);
                        this.emit('trade', { signal, result, timestamp: Date.now() });
                    } catch (error) {
                        console.error(`Failed to execute trade for ${signal.symbol}:`, error);
                        this.emit('error', { error, signal, timestamp: Date.now() });
                    }
                }
                
                // Check for filled orders and update tracking
                await this.checkForFilledOrders();
                
                // Update performance metrics
                await this.portfolioManager.updateMetrics();
                
                // Wait before next iteration
                await new Promise(resolve => setTimeout(resolve, 30000)); // 30 second wait
            } catch (error) {
                console.error('Trading loop error:', error);
                this.emit('error', { error, timestamp: Date.now() });
                await new Promise(resolve => setTimeout(resolve, 5000)); // Wait longer on error
            }
        }
        
        console.log('Trading agent stopped');
    }
    
    /**
     * Stop the trading agent gracefully
     */
    async stop(): Promise<void> {
        console.log('Stopping trading agent...');
        this.isActive = false;
    }

    /**
     * Get the latest ML predictions for dashboard display
     */
    public getLatestPredictions(): { [symbol: string]: any } {
        const predictions: { [symbol: string]: any } = {};
        
        for (const [symbol, signalData] of this.lastSignalCache) {
            predictions[symbol] = {
                side: signalData.signal.side,
                confidence: signalData.signal.confidence,
                timestamp: signalData.timestamp,
                price: signalData.price,
                winProbability: signalData.signal.winProbability,
                expectedReturn: signalData.signal.expectedReturn
            };
        }
        
        return predictions;
    }
}