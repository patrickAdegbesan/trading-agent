import { PredictionEngine } from '../ml/prediction-engine';
import { PortfolioManager } from '../portfolio/portfolio-manager';
import { OrderManager } from '../exchanges/order-manager';
import { RiskManager } from '../portfolio/risk-manager';
import { TradingSignal, TradeResult, OrderRequest, OrderType } from '../types';
import { settings } from '../config/settings';
import { EventEmitter } from 'events';
import winston from 'winston';

export class TradingAgent extends EventEmitter {
    private predictionEngine: PredictionEngine;
    private portfolioManager: PortfolioManager;
    private orderManager: OrderManager;
    private riskManager: RiskManager;
    private logger: winston.Logger;
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
        
        // Initialize logger for rejected signals tracking
        this.logger = winston.createLogger({
            level: 'info',
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json()
            ),
            transports: [
                new winston.transports.Console(),
                new winston.transports.File({ filename: 'logs/trading-agent.log' }),
                new winston.transports.File({ 
                    filename: 'logs/rejected-signals.log',
                    level: 'warn' // Only rejected signals go to this file
                })
            ]
        });
        
        // Initialize configurable settings
        this.TRADE_COOLDOWN_MS = settings.positionManagement.tradeCooldownMinutes * 60 * 1000;
        this.MAX_ORDERS_PER_SYMBOL = settings.positionManagement.maxOrdersPerSymbol;
        this.MIN_PRICE_CHANGE_PERCENT = settings.positionManagement.minPriceChangePercent;
        this.SIGNAL_DEDUP_MS = settings.positionManagement.signalDedupMinutes * 60 * 1000;

        this.logger.info('TradingAgent initialized', {
            tradeCooldownMs: this.TRADE_COOLDOWN_MS,
            maxOrdersPerSymbol: this.MAX_ORDERS_PER_SYMBOL,
            minPriceChangePercent: this.MIN_PRICE_CHANGE_PERCENT,
            signalDedupMs: this.SIGNAL_DEDUP_MS
        });
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
                // Log rejected signal with full details
                this.logger.warn('Signal rejected - Duplicate', {
                    rejectionType: 'DUPLICATE_SIGNAL',
                    symbol: signal.symbol,
                    side: signal.side,
                    price: signal.price,
                    confidence: signal.confidence,
                    expectedReturn: signal.expectedReturn,
                    winProbability: signal.winProbability,
                    reason: dedupCheck.reason,
                    timestamp: signal.timestamp || Date.now(),
                    marketData: {
                        currentPrice: signal.price,
                        lastSignalTime: this.lastSignalCache.get(signal.symbol)?.timestamp
                    }
                });

                console.log(`🔄 Skipping duplicate signal for ${signal.symbol}: ${dedupCheck.reason}`);
                return {
                    success: false,
                    reason: dedupCheck.reason || 'Duplicate signal filtered'
                };
            }

            // Check confidence threshold
            if (!signal.confidence || signal.confidence < this.MIN_CONFIDENCE) {
                // Log rejected signal with full details
                this.logger.warn('Signal rejected - Low confidence', {
                    rejectionType: 'LOW_CONFIDENCE',
                    symbol: signal.symbol,
                    side: signal.side,
                    price: signal.price,
                    confidence: signal.confidence,
                    requiredConfidence: this.MIN_CONFIDENCE,
                    expectedReturn: signal.expectedReturn,
                    winProbability: signal.winProbability,
                    reason: `Confidence ${(signal.confidence || 0) * 100}% < required ${this.MIN_CONFIDENCE * 100}%`,
                    timestamp: signal.timestamp || Date.now(),
                    potentialMissedGain: signal.expectedReturn || 0
                });

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
                // Log rejected signal with active orders details
                this.logger.warn('Signal rejected - Too many active orders', {
                    rejectionType: 'MAX_ORDERS_EXCEEDED',
                    symbol: signal.symbol,
                    side: signal.side,
                    price: signal.price,
                    confidence: signal.confidence,
                    expectedReturn: signal.expectedReturn,
                    winProbability: signal.winProbability,
                    activeOrdersCount: activeOrders.length,
                    maxAllowedOrders: this.MAX_ORDERS_PER_SYMBOL,
                    activeOrders: activeOrders.map(order => ({
                        id: order.id,
                        side: order.side,
                        price: order.price,
                        quantity: order.quantity,
                        status: order.status
                    })),
                    reason: `${activeOrders.length} active orders >= ${this.MAX_ORDERS_PER_SYMBOL} limit`,
                    timestamp: signal.timestamp || Date.now(),
                    potentialMissedGain: signal.expectedReturn || 0
                });

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
                
                // Log rejected signal with cooldown details
                this.logger.warn('Signal rejected - Trade cooldown active', {
                    rejectionType: 'TRADE_COOLDOWN',
                    symbol: signal.symbol,
                    side: signal.side,
                    price: signal.price,
                    confidence: signal.confidence,
                    expectedReturn: signal.expectedReturn,
                    winProbability: signal.winProbability,
                    lastTradeTime: new Date(lastTradeTime).toISOString(),
                    timeSinceLastTradeMs: timeSinceLastTrade,
                    requiredCooldownMs: this.TRADE_COOLDOWN_MS,
                    remainingCooldownSec: remainingCooldown,
                    reason: `Cooldown ${remainingCooldown}s remaining of ${this.TRADE_COOLDOWN_MS/1000}s required`,
                    timestamp: signal.timestamp || Date.now(),
                    potentialMissedGain: signal.expectedReturn || 0
                });

                console.log(`⏰ Trade cooldown active for ${signal.symbol} - ${remainingCooldown}s remaining`);
                return {
                    success: false,
                    reason: `Trade cooldown active (${remainingCooldown}s remaining)`
                };
            }
            
            // Skip CLOSE signals for now - we'll handle position closing separately
            if (signal.side === 'CLOSE') {
                // Log rejected CLOSE signal
                this.logger.warn('Signal rejected - CLOSE signals not implemented', {
                    rejectionType: 'CLOSE_NOT_IMPLEMENTED',
                    symbol: signal.symbol,
                    side: signal.side,
                    price: signal.price,
                    confidence: signal.confidence,
                    expectedReturn: signal.expectedReturn,
                    winProbability: signal.winProbability,
                    reason: 'CLOSE signal functionality not yet implemented',
                    timestamp: signal.timestamp || Date.now(),
                    note: 'Position closing handled separately from trading signals'
                });

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
                // Log rejected signal with risk assessment details
                this.logger.warn('Signal rejected - Risk manager denial', {
                    rejectionType: 'RISK_MANAGER_DENIAL',
                    symbol: signal.symbol,
                    side: signal.side,
                    price: signal.price,
                    confidence: signal.confidence,
                    expectedReturn: signal.expectedReturn,
                    winProbability: signal.winProbability,
                    riskAssessment: {
                        approved: riskAssessment.approved,
                        reason: riskAssessment.reason,
                        positionSize: riskAssessment.positionSize,
                        riskScore: riskAssessment.riskScore,
                        adjustedSignal: riskAssessment.adjustedSignal
                    },
                    reason: `Risk manager rejection: ${riskAssessment.reason}`,
                    timestamp: signal.timestamp || Date.now(),
                    potentialMissedGain: signal.expectedReturn || 0,
                    riskMitigated: true
                });

                console.log(`⚠️ Trade rejected by risk manager: ${riskAssessment.reason}`);
                return {
                    success: false,
                    reason: riskAssessment.reason
                };
            }

            const positionSize = riskAssessment.positionSize;
            if (!positionSize || positionSize <= 0) {
                // Log rejected signal with position size details
                this.logger.warn('Signal rejected - Invalid position size', {
                    rejectionType: 'INVALID_POSITION_SIZE',
                    symbol: signal.symbol,
                    side: signal.side,
                    price: signal.price,
                    confidence: signal.confidence,
                    expectedReturn: signal.expectedReturn,
                    winProbability: signal.winProbability,
                    calculatedPositionSize: positionSize,
                    riskAssessment: {
                        approved: riskAssessment.approved,
                        riskScore: riskAssessment.riskScore
                    },
                    reason: `Invalid position size: ${positionSize}`,
                    timestamp: signal.timestamp || Date.now(),
                    potentialMissedGain: signal.expectedReturn || 0
                });

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

            // Log signal acceptance before execution
            this.logger.info('Signal accepted - Executing trade', {
                signalStatus: 'ACCEPTED',
                symbol: signal.symbol,
                side: signal.side,
                price: signal.price,
                confidence: signal.confidence,
                expectedReturn: signal.expectedReturn,
                winProbability: signal.winProbability,
                positionSize: positionSize,
                riskScore: riskAssessment.riskScore,
                orderRequest: orderRequest,
                timestamp: signal.timestamp || Date.now()
            });

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

                // Log successful trade execution
                this.logger.info('Trade executed successfully', {
                    executionStatus: 'SUCCESS',
                    symbol: signal.symbol,
                    orderId: result.orderId,
                    executedPrice: result.details.price,
                    executedQuantity: result.details.quantity,
                    side: signal.side,
                    originalSignal: {
                        confidence: signal.confidence,
                        expectedReturn: signal.expectedReturn,
                        winProbability: signal.winProbability
                    },
                    executionTime: result.details.timestamp,
                    totalValue: result.details.price * result.details.quantity
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

    /**
     * Get rejected signal statistics from logs
     */
    async getRejectedSignalStats(): Promise<{
        rejectionReasons: { [key: string]: number };
        totalRejected: number;
        potentialMissedGains: number;
        rejectionsBySymbol: { [key: string]: number };
        lastHourRejections: number;
    }> {
        // This is a placeholder - in a real implementation, you'd parse the log file
        // For now, we'll return empty stats structure
        const stats = {
            rejectionReasons: {
                'DUPLICATE_SIGNAL': 0,
                'LOW_CONFIDENCE': 0,
                'MAX_ORDERS_EXCEEDED': 0,
                'TRADE_COOLDOWN': 0,
                'RISK_MANAGER_DENIAL': 0,
                'INVALID_POSITION_SIZE': 0,
                'CLOSE_NOT_IMPLEMENTED': 0
            },
            totalRejected: 0,
            potentialMissedGains: 0,
            rejectionsBySymbol: {},
            lastHourRejections: 0
        };

        this.logger.info('Rejected signal statistics requested', { stats });
        return stats;
    }

    /**
     * Log current trading agent configuration
     */
    logConfiguration(): void {
        this.logger.info('Trading agent configuration', {
            isActive: this.isActive,
            minConfidence: this.MIN_CONFIDENCE,
            tradeCooldownMs: this.TRADE_COOLDOWN_MS,
            maxOrdersPerSymbol: this.MAX_ORDERS_PER_SYMBOL,
            minPriceChangePercent: this.MIN_PRICE_CHANGE_PERCENT,
            signalDedupMs: this.SIGNAL_DEDUP_MS,
            cachedSignalsCount: this.lastSignalCache.size,
            lastTradeTimesCount: this.lastTradeTime.size
        });
    }
}