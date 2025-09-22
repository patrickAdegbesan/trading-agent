// Dashboard JavaScript for Real-time Trading Bot Monitoring
class TradingDashboard {
    constructor() {
        this.isConnected = false;
        this.charts = {};
        this.updateInterval = null;
        this.notificationCount = 0;
        this.lastDataUpdate = null;
        
        this.init();
    }

    async init() {
        console.log('🚀 Initializing Trading Dashboard...');
        
        // Hide loading overlay after a short delay
        setTimeout(() => {
            document.getElementById('loading-overlay').classList.add('hidden');
        }, 1000);

        // Initialize charts
        this.initializeCharts();
        
        // Load initial data
        await this.loadAllData();
        
        // Start periodic updates
        this.startPeriodicUpdates();
        
        // Setup event listeners
        this.setupEventListeners();
        
        console.log('✅ Dashboard initialized successfully');
    }

    initializeCharts() {
        // Performance Chart
        const performanceCtx = document.getElementById('performanceChart').getContext('2d');
        this.charts.performance = new Chart(performanceCtx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Cumulative P&L',
                    data: [],
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        type: 'time',
                        time: {
                            unit: 'hour'
                        },
                        grid: {
                            color: '#4b5563'
                        },
                        ticks: {
                            color: '#d1d5db'
                        }
                    },
                    y: {
                        grid: {
                            color: '#4b5563'
                        },
                        ticks: {
                            color: '#d1d5db',
                            callback: function(value) {
                                return '$' + value.toFixed(2);
                            }
                        }
                    }
                },
                plugins: {
                    legend: {
                        labels: {
                            color: '#d1d5db'
                        }
                    }
                }
            }
        });

        // Portfolio Chart
        const portfolioCtx = document.getElementById('portfolioChart').getContext('2d');
        this.charts.portfolio = new Chart(portfolioCtx, {
            type: 'doughnut',
            data: {
                labels: ['Cash', 'BTC', 'ETH', 'ADA', 'SOL'],
                datasets: [{
                    data: [85, 10, 3, 1, 1],
                    backgroundColor: [
                        '#6b7280',
                        '#f59e0b',
                        '#3b82f6',
                        '#10b981',
                        '#8b5cf6'
                    ],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            color: '#d1d5db',
                            usePointStyle: true,
                            padding: 15
                        }
                    }
                }
            }
        });
    }

    async loadAllData() {
        try {
            await Promise.all([
                this.updateStatus(),
                this.updateStats(),
                this.updateTrades(),
                this.updatePerformance(),
                this.updateMLPredictions(),
                this.updateLiveData(),
                this.updatePortfolio()
            ]);
            
            this.lastDataUpdate = new Date();
            console.log('📊 All data loaded successfully');
        } catch (error) {
            console.error('❌ Error loading dashboard data:', error);
            this.showNotification('Error loading data', 'Failed to load dashboard data', 'error');
        }
    }

    async updateStatus() {
        try {
            const response = await fetch('/api/status');
            const status = await response.json();
            
            // Update status indicator
            const statusDot = document.getElementById('status-dot');
            const statusText = document.getElementById('status-text');
            
            if (status.isConnected) {
                statusDot.className = 'status-dot';
                statusText.textContent = 'Online';
                this.isConnected = true;
            } else {
                statusDot.className = 'status-dot offline';
                statusText.textContent = 'Offline';
                this.isConnected = false;
            }
            
            // Update uptime
            const uptimeElement = document.getElementById('uptime');
            const hours = Math.floor(status.uptime / 3600);
            const minutes = Math.floor((status.uptime % 3600) / 60);
            uptimeElement.textContent = `${hours}h ${minutes}m`;
            
        } catch (error) {
            console.error('Error updating status:', error);
        }
    }

    async updateStats() {
        try {
            const response = await fetch('/api/stats');
            const stats = await response.json();
            
            // Update metric cards
            document.getElementById('total-pnl').textContent = `$${stats.totalPnL.toFixed(2)}`;
            document.getElementById('win-rate').textContent = `${stats.winRate.toFixed(1)}%`;
            document.getElementById('total-trades').textContent = stats.totalTrades;
            document.getElementById('active-trades').textContent = `${stats.activeTrades} Active`;
            
            // Update P&L change indicator
            const pnlChange = document.getElementById('pnl-change');
            const dailyPnL = stats.dailyPnL || 0;
            const changePercent = dailyPnL >= 0 ? '+' : '';
            pnlChange.textContent = `${changePercent}${dailyPnL.toFixed(2)}%`;
            pnlChange.className = `metric-change ${dailyPnL >= 0 ? 'positive' : 'negative'}`;
            
        } catch (error) {
            console.error('Error updating stats:', error);
        }
    }

    async updateTrades() {
        try {
            const response = await fetch('/api/trades?limit=20');
            const trades = await response.json();
            
            const tbody = document.getElementById('trades-tbody');
            tbody.innerHTML = '';
            
            trades.forEach(trade => {
                const row = document.createElement('tr');
                const time = new Date(trade.timestamp).toLocaleTimeString();
                const pnl = trade.pnl || 0;
                
                row.innerHTML = `
                    <td>${time}</td>
                    <td>${trade.symbol}</td>
                    <td><span class="trade-side ${trade.side.toLowerCase()}">${trade.side}</span></td>
                    <td>$${parseFloat(trade.price).toFixed(4)}</td>
                    <td>${parseFloat(trade.quantity).toFixed(4)}</td>
                    <td><span class="trade-pnl ${pnl >= 0 ? 'positive' : 'negative'}">$${pnl.toFixed(2)}</span></td>
                    <td><span class="trade-status ${trade.status}">${trade.status.toUpperCase()}</span></td>
                `;
                
                tbody.appendChild(row);
            });
            
        } catch (error) {
            console.error('Error updating trades:', error);
        }
    }

    async updatePerformance() {
        try {
            const response = await fetch('/api/performance?days=7');
            const data = await response.json();
            
            if (data.chartData && data.chartData.length > 0) {
                const chart = this.charts.performance;
                chart.data.labels = data.chartData.map(d => new Date(d.timestamp));
                chart.data.datasets[0].data = data.chartData.map(d => d.cumulativePnL);
                chart.update('none');
            }
            
        } catch (error) {
            console.error('Error updating performance:', error);
        }
    }

    async updateMLPredictions() {
        try {
            const response = await fetch('/api/ml-predictions');
            const predictions = await response.json();
            
            const container = document.getElementById('ml-predictions');
            container.innerHTML = '';
            
            Object.entries(predictions).forEach(([symbol, prediction]) => {
                const predictionElement = document.createElement('div');
                predictionElement.className = 'ml-prediction';
                
                predictionElement.innerHTML = `
                    <div class="prediction-pair">${symbol}</div>
                    <div class="prediction-signal">
                        <span class="signal-side ${prediction.side.toLowerCase()}">${prediction.side}</span>
                        <span class="signal-confidence">${(prediction.confidence * 100).toFixed(1)}%</span>
                    </div>
                `;
                
                container.appendChild(predictionElement);
            });
            
        } catch (error) {
            console.error('Error updating ML predictions:', error);
        }
    }

    async updateLiveData() {
        try {
            const response = await fetch('/api/live-data');
            const data = await response.json();
            
            const container = document.getElementById('trading-pairs');
            container.innerHTML = '';
            
            Object.entries(data.prices).forEach(([symbol, priceData]) => {
                const pairElement = document.createElement('div');
                pairElement.className = 'pair-card';
                
                const changePercent = priceData.change24h;
                const changeClass = changePercent >= 0 ? 'positive' : 'negative';
                const changeSign = changePercent >= 0 ? '+' : '';
                
                pairElement.innerHTML = `
                    <div class="pair-header">
                        <div class="pair-symbol">${symbol}</div>
                        <div class="pair-change ${changeClass}">${changeSign}${changePercent.toFixed(2)}%</div>
                    </div>
                    <div class="pair-price">$${priceData.price.toLocaleString()}</div>
                    <div class="pair-volume">Vol: ${this.formatVolume(priceData.volume)}</div>
                `;
                
                container.appendChild(pairElement);
            });
            
            // Update last update time
            const updateTime = new Date(data.timestamp).toLocaleTimeString();
            document.getElementById('market-update').textContent = `Last update: ${updateTime}`;
            
        } catch (error) {
            console.error('Error updating live data:', error);
        }
    }

    async updatePortfolio() {
        try {
            const response = await fetch('/api/portfolio');
            const portfolio = await response.json();
            
            // Update portfolio value
            document.getElementById('portfolio-value').textContent = `$${portfolio.totalValue.toLocaleString()}`;
            
            // Update positions
            const container = document.getElementById('portfolio-positions');
            container.innerHTML = '';
            
            portfolio.positions.forEach(position => {
                if (position.quantity > 0) {
                    const positionElement = document.createElement('div');
                    positionElement.className = 'position-item';
                    
                    const pnlClass = position.pnl >= 0 ? 'positive' : 'negative';
                    const pnlSign = position.pnl >= 0 ? '+' : '';
                    
                    positionElement.innerHTML = `
                        <div class="position-symbol">${position.symbol}</div>
                        <div class="position-value">
                            <div class="position-amount">$${position.value.toFixed(2)}</div>
                            <div class="position-pnl ${pnlClass}">${pnlSign}$${position.pnl.toFixed(2)}</div>
                        </div>
                    `;
                    
                    container.appendChild(positionElement);
                }
            });
            
            // Update portfolio chart
            if (portfolio.allocation) {
                const chart = this.charts.portfolio;
                chart.data.datasets[0].data = Object.values(portfolio.allocation);
                chart.update('none');
            }
            
        } catch (error) {
            console.error('Error updating portfolio:', error);
        }
    }

    startPeriodicUpdates() {
        // Update every 5 seconds
        this.updateInterval = setInterval(() => {
            this.loadAllData();
        }, 5000);
        
        console.log('🔄 Started periodic updates (5s interval)');
    }

    setupEventListeners() {
        // Chart period buttons
        document.querySelectorAll('.chart-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.chart-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                
                const period = e.target.dataset.period;
                this.updateChartPeriod(period);
            });
        });
        
        // Notification toggle
        window.toggleNotifications = () => {
            const panel = document.getElementById('notifications-panel');
            panel.classList.toggle('open');
        };
        
        // Refresh functions
        window.refreshTrades = () => this.updateTrades();
        window.refreshAllData = () => this.loadAllData();
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === 'r' && e.ctrlKey) {
                e.preventDefault();
                this.loadAllData();
            }
            if (e.key === 'n' && e.ctrlKey) {
                e.preventDefault();
                toggleNotifications();
            }
        });
    }

    updateChartPeriod(period) {
        let days = 1;
        switch (period) {
            case '7d': days = 7; break;
            case '30d': days = 30; break;
            default: days = 1;
        }
        
        // Reload performance data with new period
        fetch(`/api/performance?days=${days}`)
            .then(response => response.json())
            .then(data => {
                if (data.chartData && data.chartData.length > 0) {
                    const chart = this.charts.performance;
                    chart.data.labels = data.chartData.map(d => new Date(d.timestamp));
                    chart.data.datasets[0].data = data.chartData.map(d => d.cumulativePnL);
                    chart.update();
                }
            })
            .catch(error => console.error('Error updating chart period:', error));
    }

    showNotification(title, message, type = 'info') {
        this.notificationCount++;
        
        // Update notification badge
        document.getElementById('notification-badge').textContent = this.notificationCount;
        
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification-item ${type}`;
        
        notification.innerHTML = `
            <div class="notification-title">${title}</div>
            <div class="notification-message">${message}</div>
            <div class="notification-time">${new Date().toLocaleTimeString()}</div>
        `;
        
        // Add to notifications list
        const list = document.getElementById('notifications-list');
        list.insertBefore(notification, list.firstChild);
        
        // Keep only last 20 notifications
        const notifications = list.children;
        while (notifications.length > 20) {
            list.removeChild(notifications[notifications.length - 1]);
        }
        
        console.log(`📢 Notification: ${title} - ${message}`);
    }

    formatVolume(volume) {
        if (volume >= 1000000000) {
            return (volume / 1000000000).toFixed(1) + 'B';
        } else if (volume >= 1000000) {
            return (volume / 1000000).toFixed(1) + 'M';
        } else if (volume >= 1000) {
            return (volume / 1000).toFixed(1) + 'K';
        }
        return volume.toLocaleString();
    }

    destroy() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }
        
        // Destroy charts
        Object.values(this.charts).forEach(chart => {
            if (chart && typeof chart.destroy === 'function') {
                chart.destroy();
            }
        });
        
        console.log('🛑 Dashboard destroyed');
    }
}

// Auto-start dashboard when page loads
document.addEventListener('DOMContentLoaded', () => {
    window.dashboard = new TradingDashboard();
});

// Handle page visibility changes
document.addEventListener('visibilitychange', () => {
    if (document.hidden && window.dashboard) {
        // Pause updates when tab is hidden
        if (window.dashboard.updateInterval) {
            clearInterval(window.dashboard.updateInterval);
        }
    } else if (window.dashboard) {
        // Resume updates when tab becomes visible
        window.dashboard.startPeriodicUpdates();
        window.dashboard.loadAllData();
    }
});

// Handle page unload
window.addEventListener('beforeunload', () => {
    if (window.dashboard) {
        window.dashboard.destroy();
    }
});