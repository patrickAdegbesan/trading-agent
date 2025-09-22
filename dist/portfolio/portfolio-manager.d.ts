import { Portfolio, Position } from '../types';
import { EventEmitter } from 'events';
export declare class PortfolioManager extends EventEmitter {
    on(event: 'positionUpdate', listener: (position: Position) => void): this;
    on(event: 'metricsUpdate', listener: (metrics: any) => void): this;
    private positions;
    private cash;
    private lastMetricsUpdate;
    constructor(initialCash?: number);
    /**
     * Get current portfolio status
     */
    getPortfolio(): Promise<Portfolio>;
    /**
     * Update portfolio after trade execution
     */
    updateAfterTrade(trade: {
        symbol: string;
        quantity: number;
        price: number;
        timestamp: number;
    }): Promise<void>;
    /**
     * Close all open positions
     */
    closeAllPositions(): Promise<void>;
    /**
     * Update portfolio metrics
     */
    updateMetrics(): Promise<void>;
    /**
     * Get available cash balance
     */
    getBalance(): number;
    /**
     * Get total portfolio value including positions
     */
    getTotalValue(): Promise<number>;
    /**
     * Close a specific position
     */
    private closePosition;
    /**
     * Get current market price for a symbol
     */
    private getPrice;
}
