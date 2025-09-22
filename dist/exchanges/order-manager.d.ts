import { OrderRequest } from '../types';
import { ExchangeConnector } from './exchange-connector';
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
export declare class OrderManager extends EventEmitter {
    private orders;
    private exchangeConnector;
    private riskManager;
    private isTradeExecutionEnabled;
    constructor(exchangeConnector: ExchangeConnector, riskManager: RiskManager);
    /**
     * Execute a trade based on trading signal with full risk management
     */
    executeTradeSignal(signal: TradeSignal, currentPrice: number): Promise<TradeResult>;
    /**
     * Place a market order with risk management
     */
    private placeMarketOrder;
    /**
     * Place protective stop-loss and take-profit orders
     */
    private placeProtectiveOrders;
    /**
     * Submit an order and return TradeResult
     */
    submitOrder(orderRequest: OrderRequest): Promise<TradeResult>;
    /**
     * Cancel an order
     */
    cancelOrder(orderId: string, symbol: string): Promise<void>;
    /**
     * Get order information
     */
    getOrder(orderId: string): OrderInfo | undefined;
    /**
     * List all orders
     */
    listOrders(): Array<OrderInfo>;
    /**
     * Get active orders (not filled or cancelled)
     */
    getActiveOrders(): Array<OrderInfo>;
    /**
     * Check if there are active orders for a specific symbol
     */
    hasActiveOrdersForSymbol(symbol: string): boolean;
    /**
     * Get active orders for a specific symbol
     */
    getActiveOrdersForSymbol(symbol: string): Array<OrderInfo>;
    /**
     * Enable or disable trade execution
     */
    setTradeExecutionEnabled(enabled: boolean): void;
    /**
     * Generate unique order ID
     */
    private generateOrderId;
    /**
     * Format quantity to appropriate precision for the symbol with validation
     */
    private formatQuantity;
    /**
     * Round quantity to valid step size (LOT_SIZE filter compliance)
     */
    private roundToStepSize;
    /**
     * Get statistics about trading activity
     */
    getTradingStats(): {
        totalOrders: number;
        activeOrders: number;
        filledOrders: number;
        cancelledOrders: number;
        successRate: number;
    };
}
