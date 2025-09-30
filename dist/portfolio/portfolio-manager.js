"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PortfolioManager = void 0;
const events_1 = require("events");
class PortfolioManager extends events_1.EventEmitter {
    on(event, listener) {
        return super.on(event, listener);
    }
    constructor(initialCash = 10000, dataCollector) {
        super();
        this.positions = new Map();
        this.cash = 0;
        this.lastMetricsUpdate = 0;
        this.cash = initialCash;
        this.dataCollector = dataCollector;
    }
    /**
     * Get current portfolio status
     */
    async getPortfolio() {
        const positions = Array.from(this.positions.values()).map(pos => ({
            ...pos,
            unrealizedPnL: (pos.currentPrice - pos.entryPrice) * pos.quantity
        }));
        const totalValue = await this.getTotalValue();
        return {
            totalValue,
            positions: Object.fromEntries(positions.map(pos => [pos.symbol, pos.quantity]))
        };
    }
    /**
     * Set data collector for real-time pricing
     */
    setDataCollector(dataCollector) {
        this.dataCollector = dataCollector;
    }
    /**
     * Update cash balance (for trades)
     */
    updateBalance(amount) {
        this.cash += amount;
    }
    /**
     * Update portfolio after trade execution
     */
    async updateAfterTrade(trade) {
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
        const newPosition = {
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
    async closeAllPositions() {
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
    async updateMetrics() {
        const now = Date.now();
        if (now - this.lastMetricsUpdate < 60000)
            return; // Update at most once per minute
        let totalValue = this.cash;
        const updates = [];
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
    getBalance() {
        return this.cash;
    }
    /**
     * Get total portfolio value including positions
     */
    async getTotalValue() {
        let totalValue = this.cash;
        for (const [symbol, position] of this.positions) {
            const currentPrice = await this.getPrice(symbol);
            totalValue += position.quantity * currentPrice;
        }
        return totalValue;
    }
    /**
     * Get all positions
     */
    getPositions() {
        return Array.from(this.positions.values());
    }
    /**
     * Get current price for a symbol (public version)
     */
    async getCurrentPrice(symbol) {
        return await this.getPrice(symbol);
    }
    /**
     * Close a specific position
     */
    async closePosition(symbol) {
        const position = this.positions.get(symbol);
        if (!position || position.quantity <= 0)
            return;
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
    async getPrice(symbol) {
        // Try to get real-time price from data collector
        if (this.dataCollector && this.dataCollector.getCurrentPrice) {
            const price = this.dataCollector.getCurrentPrice(symbol);
            if (price && price > 0) {
                return price;
            }
        }
        // Fallback to realistic mock prices based on actual market values
        const mockPrices = {
            'BTCUSDT': 96800.00,
            'ETHUSDT': 3687.45,
            'ADAUSDT': 1.0523,
            'SOLUSDT': 245.25
        };
        // More intelligent fallback based on symbol pattern
        if (symbol.includes('BTC'))
            return mockPrices['BTCUSDT'] || 96800.00;
        if (symbol.includes('ETH'))
            return mockPrices['ETHUSDT'] || 3687.45;
        if (symbol.includes('ADA'))
            return mockPrices['ADAUSDT'] || 1.0523;
        if (symbol.includes('SOL'))
            return mockPrices['SOLUSDT'] || 245.25;
        // Generic fallback for unknown tokens
        return mockPrices[symbol] || 50.00;
    }
}
exports.PortfolioManager = PortfolioManager;
//# sourceMappingURL=portfolio-manager.js.map