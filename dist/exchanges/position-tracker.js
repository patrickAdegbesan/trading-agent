"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PositionTracker = void 0;
const events_1 = require("events");
const winston_1 = __importDefault(require("winston"));
class PositionTracker extends events_1.EventEmitter {
    constructor(exchangeConnector) {
        super();
        this.updateInterval = null;
        this.UPDATE_INTERVAL_MS = 5000; // Update every 5 seconds
        this.positions = new Map();
        this.exchangeConnector = exchangeConnector;
        this.logger = winston_1.default.createLogger({
            level: 'info',
            format: winston_1.default.format.combine(winston_1.default.format.timestamp(), winston_1.default.format.json()),
            transports: [
                new winston_1.default.transports.Console(),
                new winston_1.default.transports.File({ filename: 'logs/positions.log' })
            ]
        });
        // Start position tracking
        this.startTracking();
    }
    async startTracking() {
        try {
            // Initial position load
            await this.updatePositions();
            // Set up periodic updates
            this.updateInterval = setInterval(async () => {
                await this.updatePositions();
            }, this.UPDATE_INTERVAL_MS);
        }
        catch (error) {
            this.logger.error('Failed to start position tracking', { error: error.message });
        }
    }
    stopTracking() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
    }
    async updatePositions() {
        try {
            // Get positions from exchange
            const positions = await this.exchangeConnector.getPositions();
            // Update local position tracking
            for (const pos of positions) {
                const symbol = pos.symbol;
                const currentPosition = this.positions.get(symbol);
                const updatedPosition = {
                    symbol: pos.symbol,
                    size: parseFloat(pos.positionAmt),
                    entryPrice: parseFloat(pos.entryPrice),
                    lastUpdateTime: Date.now(),
                    unrealizedPnl: parseFloat(pos.unRealizedProfit),
                    marginUsed: parseFloat(pos.positionAmt) * parseFloat(pos.entryPrice),
                    leverage: pos.leverage || 1,
                    markPrice: parseFloat(pos.markPrice),
                    isIsolated: pos.marginType === 'isolated',
                    isolatedMargin: pos.isolatedMargin ? parseFloat(pos.isolatedMargin) : undefined,
                    liquidationPrice: pos.liquidationPrice ? parseFloat(pos.liquidationPrice) : undefined
                };
                // Check for significant changes
                if (currentPosition) {
                    const sizeChange = Math.abs(currentPosition.size - updatedPosition.size);
                    const priceChange = Math.abs(currentPosition.markPrice - updatedPosition.markPrice) / currentPosition.markPrice;
                    if (sizeChange > 0 || priceChange > 0.001) { // 0.1% price change threshold
                        this.emit('positionUpdate', {
                            symbol,
                            oldPosition: currentPosition,
                            newPosition: updatedPosition,
                            changes: {
                                sizeChange,
                                priceChange: priceChange * 100, // Convert to percentage
                                pnlChange: updatedPosition.unrealizedPnl - currentPosition.unrealizedPnl
                            }
                        });
                    }
                }
                else if (updatedPosition.size !== 0) {
                    // New position opened
                    this.emit('positionOpen', {
                        symbol,
                        position: updatedPosition
                    });
                }
                // Update or remove position
                if (updatedPosition.size !== 0) {
                    this.positions.set(symbol, updatedPosition);
                }
                else {
                    this.positions.delete(symbol);
                    if (currentPosition) {
                        this.emit('positionClose', {
                            symbol,
                            position: currentPosition
                        });
                    }
                }
            }
        }
        catch (error) {
            this.logger.error('Failed to update positions', { error: error.message });
        }
    }
    getPosition(symbol) {
        return this.positions.get(symbol);
    }
    getAllPositions() {
        return Array.from(this.positions.values());
    }
    getOpenPositions() {
        return Array.from(this.positions.values()).filter(pos => pos.size !== 0);
    }
    async setLeverage(symbol, leverage) {
        try {
            await this.exchangeConnector.setLeverage(symbol, leverage);
            const position = this.positions.get(symbol);
            if (position) {
                position.leverage = leverage;
                this.positions.set(symbol, position);
            }
            return true;
        }
        catch (error) {
            this.logger.error('Failed to set leverage', {
                symbol,
                leverage,
                error: error.message
            });
            return false;
        }
    }
    async setMarginType(symbol, isolated) {
        try {
            await this.exchangeConnector.setMarginType(symbol, isolated ? 'ISOLATED' : 'CROSSED');
            const position = this.positions.get(symbol);
            if (position) {
                position.isIsolated = isolated;
                this.positions.set(symbol, position);
            }
            return true;
        }
        catch (error) {
            this.logger.error('Failed to set margin type', {
                symbol,
                isolated,
                error: error.message
            });
            return false;
        }
    }
    getPositionValue(symbol) {
        const position = this.positions.get(symbol);
        if (!position)
            return 0;
        return Math.abs(position.size * position.markPrice);
    }
    getUnrealizedPnl(symbol) {
        if (symbol) {
            return this.positions.get(symbol)?.unrealizedPnl || 0;
        }
        return Array.from(this.positions.values())
            .reduce((total, pos) => total + pos.unrealizedPnl, 0);
    }
    getTotalMarginUsed() {
        return Array.from(this.positions.values())
            .reduce((total, pos) => total + pos.marginUsed, 0);
    }
    getPositionMetrics(symbol) {
        const position = this.positions.get(symbol);
        if (!position)
            return undefined;
        const value = Math.abs(position.size * position.markPrice);
        const liquidationDistance = position.liquidationPrice ?
            ((position.markPrice - position.liquidationPrice) / position.markPrice) * 100 :
            undefined;
        return {
            size: position.size,
            value,
            unrealizedPnl: position.unrealizedPnl,
            marginUsed: position.marginUsed,
            leverage: position.leverage,
            markPrice: position.markPrice,
            entryPrice: position.entryPrice,
            liquidationDistance
        };
    }
}
exports.PositionTracker = PositionTracker;
//# sourceMappingURL=position-tracker.js.map