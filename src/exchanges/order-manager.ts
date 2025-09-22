import { OrderRequest } from '../types';
import { ExchangeConnector, OrderData } from './exchange-connector';
import { RiskManager, TradeSignal, RiskAssessment } from '../portfolio/risk-manager';
import { EventEmitter } from 'events';

export interface TradeResult {
    success: boolean;
    orderId?: string;
    reason?: string;
    error?: Error;
    details?: {
        symbol: string;
        side: 'BUY' | 'SELL';
        quantity: number;
        price: number;
        type: 'MARKET' | 'LIMIT' | 'STOP_LOSS' | 'TAKE_PROFIT';
        timestamp: number;
    };
    positionSize?: number;
    price?: number;
    stopLoss?: number;
    takeProfit?: number;
    riskScore?: number;
    executedPrice?: number;
    quantity?: number;
    orderData?: {
        orderId: string | number;
        quantity: number;
        executedPrice?: number;
    };
}

export interface OrderInfo {
    id: string;
    symbol: string;
    side: 'BUY' | 'SELL';
    type: 'MARKET' | 'LIMIT' | 'STOP_LOSS' | 'STOP_LOSS_LIMIT' | 'TAKE_PROFIT';
    quantity: number;
    price?: number;
    status: 'SUBMITTED' | 'FILLED' | 'CANCELLED' | 'REJECTED' | 'PENDING';
    timestamp: Date;
    exchangeOrderId?: number;
    stopLoss?: number;
    takeProfit?: number;
    riskAssessment?: RiskAssessment;
}

export class OrderManager extends EventEmitter {
    private orders: Map<string, OrderInfo>;
    private exchangeConnector: ExchangeConnector;
    private riskManager: RiskManager;
    private isTradeExecutionEnabled: boolean = true;

    constructor(exchangeConnector: ExchangeConnector, riskManager: RiskManager) {
        super();
        this.orders = new Map();
        this.exchangeConnector = exchangeConnector;
        this.riskManager = riskManager;
    }

    /**
     * Execute a trade based on trading signal with full risk management
     */
    public async executeTradeSignal(signal: TradeSignal, currentPrice: number): Promise<TradeResult> {
        try {
            if (!this.isTradeExecutionEnabled) {
                return {
                    success: false,
                    reason: 'Trade execution is disabled'
                };
            }

            // Risk assessment
            const riskAssessment = this.riskManager.assessTradeRisk(signal, currentPrice);
            
            console.log(`🔍 Risk Assessment for ${signal.symbol}:`, {
                approved: riskAssessment.approved,
                positionSize: riskAssessment.positionSize,
                riskScore: riskAssessment.riskScore,
                reason: riskAssessment.reason || 'Approved'
            });
            
            if (!riskAssessment.approved) {
                console.warn(`⚠️ Trade rejected: ${riskAssessment.reason}`);
                return {
                    success: false,
                    reason: riskAssessment.reason,
                    positionSize: 0
                };
            }

            // Execute the main trade
            const mainOrderResult = await this.placeMarketOrder(
                signal.symbol,
                signal.side,
                riskAssessment.positionSize,
                riskAssessment
            );

            if (!mainOrderResult.success) {
                return mainOrderResult;
            }

            // Place protective orders (stop loss and take profit) if specified
            const protectiveOrders = await this.placeProtectiveOrders(
                signal.symbol,
                signal.side,
                riskAssessment.positionSize,
                currentPrice,
                riskAssessment.adjustedSignal?.stopLoss,
                riskAssessment.adjustedSignal?.takeProfit
            );

            console.log(`✅ Trade executed successfully:`, {
                symbol: signal.symbol,
                side: signal.side,
                size: riskAssessment.positionSize,
                price: currentPrice,
                confidence: signal.confidence,
                stopLoss: riskAssessment.adjustedSignal?.stopLoss,
                takeProfit: riskAssessment.adjustedSignal?.takeProfit,
                riskScore: riskAssessment.riskScore
            });

            this.emit('tradeExecuted', {
                signal,
                riskAssessment,
                mainOrder: mainOrderResult,
                protectiveOrders
            });

            return {
                success: true,
                orderId: mainOrderResult.orderId,
                positionSize: riskAssessment.positionSize,
                price: currentPrice,
                stopLoss: riskAssessment.adjustedSignal?.stopLoss,
                takeProfit: riskAssessment.adjustedSignal?.takeProfit,
                riskScore: riskAssessment.riskScore,
                executedPrice: currentPrice, // Use current price as executed price for market orders
                quantity: riskAssessment.positionSize,
                orderData: {
                    orderId: mainOrderResult.orderId || 'unknown',
                    quantity: riskAssessment.positionSize,
                    executedPrice: currentPrice
                }
            };

        } catch (error: any) {
            console.error('❌ Failed to execute trade:', error);
            return {
                success: false,
                reason: `Execution error: ${error.message}`
            };
        }
    }

    /**
     * Place a market order with risk management
     */
    private async placeMarketOrder(
        symbol: string, 
        side: 'BUY' | 'SELL', 
        quantity: number,
        riskAssessment: RiskAssessment
    ): Promise<TradeResult> {
        try {
            const orderId = this.generateOrderId();
            
            // Format quantity to appropriate precision
            const formattedQuantity = this.formatQuantity(symbol, quantity);
            
            const orderData: OrderData = {
                symbol: symbol,
                side: side,
                type: 'MARKET',
                quantity: formattedQuantity
                // Note: timeInForce not allowed for MARKET orders
            };

            // Place order via exchange
            const result = await this.exchangeConnector.placeOrder(orderData);

            // Store order info
            const orderInfo: OrderInfo = {
                id: orderId,
                symbol: symbol,
                side: side,
                type: 'MARKET',
                quantity: quantity,
                status: 'SUBMITTED',
                timestamp: new Date(),
                exchangeOrderId: result.orderId,
                riskAssessment: riskAssessment
            };

            this.orders.set(orderId, orderInfo);

            return {
                success: true,
                orderId: orderId,
                positionSize: quantity
            };

        } catch (error: any) {
            console.error(`❌ Failed to place market order:`, error);
            
            // Handle specific Binance errors
            if (error.message?.includes('LOT_SIZE') || error.message?.includes('Filter failure: LOT_SIZE')) {
                console.error(`🚫 LOT_SIZE filter violation for ${symbol}:`, error.message);
                console.log(`Original quantity: ${quantity}, formatted: ${this.formatQuantity(symbol, quantity)}`);
                
                return {
                    success: false,
                    reason: `LOT_SIZE filter violation: Quantity ${quantity} invalid for ${symbol}. Check minimum order size requirements.`
                };
            }
            
            if (error.message?.includes('NOTIONAL') || error.message?.includes('MIN_NOTIONAL')) {
                return {
                    success: false,
                    reason: `Order value too small: Minimum notional value not met for ${symbol}`
                };
            }
            
            return {
                success: false,
                reason: `Market order failed: ${error.message}`
            };
        }
    }

    /**
     * Place protective stop-loss and take-profit orders
     */
    private async placeProtectiveOrders(
        symbol: string,
        side: 'BUY' | 'SELL',
        quantity: number,
        currentPrice: number,
        stopLoss?: number,
        takeProfit?: number
    ): Promise<{ stopLossOrder?: TradeResult; takeProfitOrder?: TradeResult }> {
        const results: { stopLossOrder?: TradeResult; takeProfitOrder?: TradeResult } = {};

        // Place stop-loss order
        if (stopLoss) {
            try {
                const stopLossOrderId = this.generateOrderId();
                const stopLossSide = side === 'BUY' ? 'SELL' : 'BUY';
                
                const orderData: OrderData = {
                    symbol: symbol,
                    side: stopLossSide,
                    type: 'STOP_LOSS_LIMIT',
                    quantity: this.formatQuantity(symbol, quantity),
                    stopPrice: stopLoss.toString(),
                    price: (stopLoss * 0.999).toString(), // Slight adjustment for limit price
                    timeInForce: 'GTC'
                };

                const result = await this.exchangeConnector.placeOrder(orderData);
                
                const orderInfo: OrderInfo = {
                    id: stopLossOrderId,
                    symbol: symbol,
                    side: stopLossSide,
                    type: 'STOP_LOSS',
                    quantity: quantity,
                    price: stopLoss,
                    status: 'SUBMITTED',
                    timestamp: new Date(),
                    exchangeOrderId: result.orderId
                };

                this.orders.set(stopLossOrderId, orderInfo);
                results.stopLossOrder = { success: true, orderId: stopLossOrderId };

            } catch (error: any) {
                console.warn(`⚠️ Failed to place stop-loss order:`, error.message);
                results.stopLossOrder = { success: false, reason: error.message };
            }
        }

        // Place take-profit order
        if (takeProfit) {
            try {
                const takeProfitOrderId = this.generateOrderId();
                const takeProfitSide = side === 'BUY' ? 'SELL' : 'BUY';
                
                const orderData: OrderData = {
                    symbol: symbol,
                    side: takeProfitSide,
                    type: 'LIMIT',
                    quantity: this.formatQuantity(symbol, quantity),
                    price: takeProfit.toString(),
                    timeInForce: 'GTC'
                };

                const result = await this.exchangeConnector.placeOrder(orderData);
                
                const orderInfo: OrderInfo = {
                    id: takeProfitOrderId,
                    symbol: symbol,
                    side: takeProfitSide,
                    type: 'TAKE_PROFIT',
                    quantity: quantity,
                    price: takeProfit,
                    status: 'SUBMITTED',
                    timestamp: new Date(),
                    exchangeOrderId: result.orderId
                };

                this.orders.set(takeProfitOrderId, orderInfo);
                results.takeProfitOrder = { success: true, orderId: takeProfitOrderId };

            } catch (error: any) {
                console.warn(`⚠️ Failed to place take-profit order:`, error.message);
                results.takeProfitOrder = { success: false, reason: error.message };
            }
        }

        return results;
    }

    /**
     * Submit an order and return TradeResult
     */
    public async submitOrder(orderRequest: OrderRequest): Promise<TradeResult> {
        try {
            const orderId = this.generateOrderId();
            
            // Convert OrderRequest to OrderData format
            // Format quantity with proper precision for Binance
            const formattedQuantity = this.formatQuantity(orderRequest.symbol, orderRequest.quantity);
            
            const orderData: OrderData = {
                symbol: orderRequest.symbol,
                side: orderRequest.side,
                type: orderRequest.type,
                quantity: formattedQuantity,
                price: orderRequest.price?.toString(),
                timeInForce: 'GTC'
            };

            // Place order via exchange
            const result = await this.exchangeConnector.placeOrder(orderData);

            // Store order locally
            const orderInfo: OrderInfo = {
                id: orderId,
                symbol: orderRequest.symbol,
                side: orderRequest.side,
                type: orderRequest.type,
                quantity: orderRequest.quantity,
                price: orderRequest.price,
                status: 'SUBMITTED',
                timestamp: new Date(),
                exchangeOrderId: result.orderId
            };

            this.orders.set(orderId, orderInfo);

            return {
                success: true,
                orderId,
                details: {
                    symbol: orderRequest.symbol,
                    side: orderRequest.side,
                    quantity: orderRequest.quantity,
                    price: orderRequest.price || 0,
                    type: orderRequest.type,
                    timestamp: Date.now()
                }
            };
            
        } catch (error: any) {
            console.error('Failed to submit order:', error);
            return {
                success: false,
                reason: error.message || 'Unknown error during order submission'
            };
        }
    }

    /**
     * Cancel an order
     */
    public async cancelOrder(orderId: string, symbol: string): Promise<void> {
        if (this.orders.has(orderId)) {
            const order = this.orders.get(orderId);
            if (order && order.exchangeOrderId) {
                // Cancel via exchange
                await this.exchangeConnector.cancelOrder(symbol, order.exchangeOrderId);
                
                // Update local status
                order.status = 'CANCELLED';
                console.log(`📝 Order ${orderId} cancelled`);
            }
        }
    }

    /**
     * Get order information
     */
    public getOrder(orderId: string): OrderInfo | undefined {
        return this.orders.get(orderId);
    }

    /**
     * List all orders
     */
    public listOrders(): Array<OrderInfo> {
        return Array.from(this.orders.values());
    }

    /**
     * Get active orders (not filled or cancelled)
     */
    public getActiveOrders(): Array<OrderInfo> {
        return Array.from(this.orders.values()).filter(
            order => order.status === 'SUBMITTED' || order.status === 'PENDING'
        );
    }

    /**
     * Check if there are active orders for a specific symbol
     */
    public hasActiveOrdersForSymbol(symbol: string): boolean {
        return this.getActiveOrders().some(order => order.symbol === symbol);
    }

    /**
     * Get active orders for a specific symbol
     */
    public getActiveOrdersForSymbol(symbol: string): Array<OrderInfo> {
        return this.getActiveOrders().filter(order => order.symbol === symbol);
    }

    /**
     * Enable or disable trade execution
     */
    public setTradeExecutionEnabled(enabled: boolean): void {
        this.isTradeExecutionEnabled = enabled;
        console.log(`🎛️ Trade execution ${enabled ? 'enabled' : 'disabled'}`);
    }

    /**
     * Generate unique order ID
     */
    private generateOrderId(): string {
        return `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Format quantity to appropriate precision for the symbol with validation
     */
    private formatQuantity(symbol: string, quantity: number): string {
        // Validate input
        if (!isFinite(quantity) || quantity <= 0) {
            console.error(`Invalid quantity received: ${quantity} for ${symbol}`);
            throw new Error(`Invalid quantity: ${quantity}. Must be a positive finite number.`);
        }

        // Enhanced lot size validation based on Binance requirements
        let formattedQuantity: string;
        let minQuantity: number;
        let stepSize: number;
        
        // Symbol-specific lot size rules (based on actual Binance filters)
        if (symbol === 'BTCUSDT') {
            minQuantity = 0.00001; // Minimum quantity: 0.00001 BTC
            stepSize = 0.00001;    // Step size: 0.00001 BTC
            formattedQuantity = this.roundToStepSize(quantity, minQuantity, stepSize).toFixed(5);
        } else if (symbol === 'ETHUSDT') {
            minQuantity = 0.0001;  // Minimum quantity: 0.0001 ETH
            stepSize = 0.0001;     // Step size: 0.0001 ETH
            formattedQuantity = this.roundToStepSize(quantity, minQuantity, stepSize).toFixed(4);
        } else if (symbol.includes('USDT')) {
            minQuantity = 0.001;   // Default for USDT pairs
            stepSize = 0.001;
            formattedQuantity = this.roundToStepSize(quantity, minQuantity, stepSize).toFixed(3);
        } else {
            minQuantity = 0.001;   // Conservative default
            stepSize = 0.001;
            formattedQuantity = this.roundToStepSize(quantity, minQuantity, stepSize).toFixed(3);
        }

        // Final validation - ensure we don't have NaN in the formatted string
        if (formattedQuantity === 'NaN' || formattedQuantity.includes('NaN')) {
            console.error(`Formatted quantity is NaN for ${symbol}, original: ${quantity}`);
            throw new Error(`Cannot format quantity ${quantity} - resulted in NaN`);
        }

        // Validate against minimum order requirements
        const numericValue = parseFloat(formattedQuantity);
        if (numericValue < minQuantity) {
            console.warn(`Quantity ${formattedQuantity} below minimum ${minQuantity} for ${symbol}, adjusting`);
            formattedQuantity = minQuantity.toFixed(symbol === 'BTCUSDT' ? 5 : symbol === 'ETHUSDT' ? 4 : 3);
        }

        console.log(`📊 Formatted quantity for ${symbol}: ${quantity} → ${formattedQuantity}`);
        return formattedQuantity;
    }

    /**
     * Round quantity to valid step size (LOT_SIZE filter compliance)
     */
    private roundToStepSize(quantity: number, minQuantity: number, stepSize: number): number {
        // Ensure quantity meets minimum requirement
        if (quantity < minQuantity) {
            return minQuantity;
        }
        
        // Round to nearest valid step
        const steps = Math.floor((quantity - minQuantity) / stepSize);
        return minQuantity + (steps * stepSize);
    }

    /**
     * Get statistics about trading activity
     */
    public getTradingStats(): {
        totalOrders: number;
        activeOrders: number;
        filledOrders: number;
        cancelledOrders: number;
        successRate: number;
    } {
        const orders = Array.from(this.orders.values());
        const totalOrders = orders.length;
        const activeOrders = orders.filter(o => o.status === 'SUBMITTED' || o.status === 'PENDING').length;
        const filledOrders = orders.filter(o => o.status === 'FILLED').length;
        const cancelledOrders = orders.filter(o => o.status === 'CANCELLED').length;
        const successRate = totalOrders > 0 ? (filledOrders / totalOrders) * 100 : 0;

        return {
            totalOrders,
            activeOrders,
            filledOrders,
            cancelledOrders,
            successRate: parseFloat(successRate.toFixed(2))
        };
    }
}