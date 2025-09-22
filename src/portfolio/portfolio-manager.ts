import { Portfolio, Position } from '../types';
import { EventEmitter } from 'events';

export class PortfolioManager extends EventEmitter {
    // Explicitly declare event types
    public on(event: 'positionUpdate', listener: (position: Position) => void): this;
    public on(event: 'metricsUpdate', listener: (metrics: any) => void): this;
    public on(event: string, listener: (...args: any[]) => void): this {
        return super.on(event, listener);
    }
    private positions: Map<string, Position> = new Map();
    private cash: number = 0;
    private lastMetricsUpdate: number = 0;

    constructor(initialCash: number = 10000) {
        super();
        this.cash = initialCash;
    }

    /**
     * Get current portfolio status
     */
    public async getPortfolio(): Promise<Portfolio> {
        return {
            totalValue: await this.getTotalValue(),
            positions: Object.fromEntries(
                Array.from(this.positions.entries()).map(([symbol, pos]) => [symbol, pos.quantity])
            )
        };
    }

    /**
     * Update portfolio after trade execution
     */
    public async updateAfterTrade(trade: { symbol: string; quantity: number; price: number; timestamp: number }): Promise<void> {
        // Validate trade data
        if (!trade.symbol || trade.symbol.trim() === '') {
            throw new Error('Invalid symbol in trade data');
        }
        
        if (typeof trade.quantity !== 'number' || isNaN(trade.quantity)) {
            throw new Error('Invalid quantity in trade data');
        }

        if (typeof trade.price !== 'number' || isNaN(trade.price) || trade.price <= 0) {
            throw new Error('Invalid price in trade data');
        }

        if (typeof trade.timestamp !== 'number' || isNaN(trade.timestamp) || trade.timestamp <= 0) {
            throw new Error('Invalid timestamp in trade data');
        }

        const currentPosition = this.positions.get(trade.symbol);
        
        const newPosition: Position = {
            symbol: trade.symbol,
            quantity: Number((currentPosition?.quantity || 0) + trade.quantity),
            entryPrice: trade.price,
            currentPrice: trade.price,
            unrealizedPnL: 0,
            timestamp: trade.timestamp
        };

        this.positions.set(trade.symbol, newPosition);
        this.emit('positionUpdate', newPosition);
    }

    /**
     * Close all open positions
     */
    public async closeAllPositions(): Promise<void> {
        const closePromises = Array.from(this.positions.entries()).map(async ([symbol, position]) => {
            if (position.quantity > 0) {
                await this.closePosition(symbol);
            }
        });

        await Promise.all(closePromises);
        this.positions.clear();
        this.emit('allPositionsClosed');
    }

    /**
     * Update portfolio metrics
     */
    public async updateMetrics(): Promise<void> {
        const now = Date.now();
        if (now - this.lastMetricsUpdate < 60000) return; // Update at most once per minute

        let totalValue = this.cash;
        const updates: Position[] = [];

        for (const [symbol, position] of this.positions) {
            const currentPrice = await this.getPrice(symbol);
            const updatedPosition = {
                ...position,
                currentPrice,
                unrealizedPnL: (currentPrice - position.entryPrice) * position.quantity
            };
            
            this.positions.set(symbol, updatedPosition);
            updates.push(updatedPosition);
            totalValue += position.quantity * currentPrice;
        }

        this.lastMetricsUpdate = now;
        this.emit('metricsUpdate', { totalValue, positions: updates });
    }

    /**
     * Get available cash balance
     */
    public getBalance(): number {
        return this.cash;
    }

    /**
     * Get total portfolio value including positions
     */
    public async getTotalValue(): Promise<number> {
        let totalValue = this.cash;
        
        for (const [symbol, position] of this.positions) {
            const currentPrice = await this.getPrice(symbol);
            totalValue += position.quantity * currentPrice;
        }
        
        return totalValue;
    }

    /**
     * Close a specific position
     */
    private async closePosition(symbol: string): Promise<void> {
        const position = this.positions.get(symbol);
        if (!position || position.quantity <= 0) return;

        const currentPrice = await this.getPrice(symbol);
        const pnl = (currentPrice - position.entryPrice) * position.quantity;
        
        this.cash += currentPrice * position.quantity;
        this.positions.delete(symbol);
        
        this.emit('positionClosed', {
            symbol,
            quantity: position.quantity,
            entryPrice: position.entryPrice,
            exitPrice: currentPrice,
            pnl
        });
    }

    /**
     * Get current market price for a symbol
     */
    private async getPrice(symbol: string): Promise<number> {
        // TODO: Implement actual price fetching from exchange
        // For now, return a mock price
        return 100;
    }
}