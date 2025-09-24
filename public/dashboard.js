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
        try {
            console.log('🎯 Starting chart initialization...');
            
            // Check if Chart.js is available
            if (typeof Chart === 'undefined') {
                console.error('❌ Chart.js is not loaded!');
                return;
            }
            
            // Performance Chart
            const performanceCanvas = document.getElementById('performanceChart');
            if (!performanceCanvas) {
                console.error('❌ Performance chart canvas not found!');
                return;
            }
            
            console.log('📊 Creating performance chart...');
            const performanceCtx = performanceCanvas.getContext('2d');
            
            this.charts.performance = new Chart(performanceCtx, {
                type: 'line',
                data: {
                    labels: ['Start'],
                    datasets: [{
                        label: 'Cumulative P&L',
                        data: [0],
                        borderColor: '#10b981',
                        backgroundColor: 'rgba(16, 185, 129, 0.1)',
                        borderWidth: 3,
                        fill: true,
                        tension: 0.4,
                        pointRadius: 4,
                        pointHoverRadius: 6
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    interaction: {
                        intersect: false,
                        mode: 'index'
                    },
                    layout: {
                        padding: {
                            top: 10,
                            bottom: 10,
                            left: 10,
                            right: 10
                        }
                    },
                    scales: {
                        x: {
                            type: 'category',
                            grid: {
                                color: '#4b5563'
                            },
                            ticks: {
                                color: '#d1d5db',
                                maxTicksLimit: 10
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
                            },
                            min: -1,
                            max: 1
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
            
            console.log('✅ Performance chart created successfully');

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

        console.log('✅ Charts initialized successfully');
        
        // Force immediate chart update to ensure visibility
        setTimeout(() => {
            console.log('🔄 Forcing chart update...');
            if (this.charts.performance) {
                this.charts.performance.update('none');
            }
            if (this.charts.portfolio) {
                this.charts.portfolio.update('none');
            }
        }, 100);
        
        } catch (error) {
            console.error('❌ Error initializing charts:', error);
            // Add visible error indication
            const performanceCanvas = document.getElementById('performanceChart');
            if (performanceCanvas) {
                const ctx = performanceCanvas.getContext('2d');
                ctx.fillStyle = '#ef4444';
                ctx.font = '16px Arial';
                ctx.fillText('Chart Error - Check Console', 10, 30);
            }
        }
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
                this.updatePortfolio(),
                this.updateRejectedSignals()
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
            
            console.log('Performance data received:', data);
            console.log('Chart data length:', data.chartData?.length);
            
            if (data.chartData && data.chartData.length > 0) {
                const chart = this.charts.performance;
                
                // Process timestamps - handle both string ISO dates and numeric timestamps
                const labels = data.chartData.map(d => {
                    let date;
                    if (typeof d.timestamp === 'string') {
                        date = new Date(d.timestamp);
                    } else {
                        date = new Date(d.timestamp); // numeric timestamp
                    }
                    
                    // Format to show just time for recent data, or date + time for older data
                    const now = new Date();
                    const isToday = date.toDateString() === now.toDateString();
                    
                    if (isToday) {
                        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    } else {
                        return date.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' + 
                               date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    }
                });
                
                const pnlData = data.chartData.map(d => d.cumulativePnL || 0);
                
                console.log('Chart labels sample:', labels.slice(0, 3));
                console.log('Chart data sample:', pnlData.slice(0, 3));
                console.log('Chart data min/max:', Math.min(...pnlData), Math.max(...pnlData));
                
                chart.data.labels = labels;
                chart.data.datasets[0].data = pnlData;
                
                // Always set appropriate y-axis range for small values
                const minVal = Math.min(...pnlData);
                const maxVal = Math.max(...pnlData);
                const dataRange = maxVal - minVal;
                
                if (dataRange < 2) {
                    // For small values, set a fixed range to make the line visible
                    const center = (minVal + maxVal) / 2;
                    chart.options.scales.y.min = center - 1;
                    chart.options.scales.y.max = center + 1;
                } else {
                    // For larger ranges, add 10% padding
                    const padding = dataRange * 0.1;
                    chart.options.scales.y.min = minVal - padding;
                    chart.options.scales.y.max = maxVal + padding;
                }
                
                chart.update('none');
                
                console.log('Chart updated successfully');
            } else {
                console.warn('No chart data available');
                // Show a visible baseline when no data is available
                const chart = this.charts.performance;
                const now = new Date();
                chart.data.labels = [
                    now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                ];
                chart.data.datasets[0].data = [0];
                
                // Set visible y-axis range
                chart.options.scales.y.min = -0.5;
                chart.options.scales.y.max = 0.5;
                
                chart.update('none');
                console.log('Chart set to "No Data" baseline');
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

    async updateRejectedSignals() {
        try {
            const response = await fetch('/api/rejected-signals');
            const data = await response.json();
            
            // Update statistics
            document.getElementById('total-rejected').textContent = data.stats.totalRejected;
            document.getElementById('hourly-rejected').textContent = data.stats.lastHour;
            document.getElementById('missed-gains').textContent = (data.stats.potentialMissedGains * 100).toFixed(2);
            
            // Update rejection types grid
            const rejectionTypesGrid = document.getElementById('rejection-types-grid');
            rejectionTypesGrid.innerHTML = '';
            
            const rejectionTypeNames = {
                'DUPLICATE_SIGNAL': '🔄 Duplicate',
                'LOW_CONFIDENCE': '📉 Low Confidence',
                'MAX_ORDERS_EXCEEDED': '⚠️ Too Many Orders',
                'TRADE_COOLDOWN': '⏰ Cooldown',
                'RISK_MANAGER_DENIAL': '🚫 Risk Blocked',
                'INVALID_POSITION_SIZE': '💰 Invalid Size',
                'CLOSE_NOT_IMPLEMENTED': '🔒 Close N/A'
            };
            
            Object.entries(data.stats.rejectionTypes).forEach(([type, count]) => {
                const typeElement = document.createElement('div');
                typeElement.className = 'rejection-type-item';
                typeElement.innerHTML = `
                    <div class="rejection-type-name">${rejectionTypeNames[type] || type}</div>
                    <div class="rejection-type-count">${count}</div>
                `;
                rejectionTypesGrid.appendChild(typeElement);
            });
            
            // Update rejected signals table
            const tbody = document.getElementById('rejected-signals-tbody');
            tbody.innerHTML = '';
            
            data.signals.forEach(signal => {
                const row = document.createElement('tr');
                const sideClass = signal.side === 'BUY' ? 'buy' : 'sell';
                const confidenceClass = parseFloat(signal.confidence) >= 70 ? 'high-confidence' : 
                                       parseFloat(signal.confidence) >= 50 ? 'medium-confidence' : 'low-confidence';
                
                row.innerHTML = `
                    <td class="time-cell">${signal.timeAgo}</td>
                    <td class="symbol-cell">${signal.symbol}</td>
                    <td class="side-cell ${sideClass}">${signal.side}</td>
                    <td class="price-cell">$${parseFloat(signal.price).toLocaleString()}</td>
                    <td class="confidence-cell ${confidenceClass}">${signal.confidence}%</td>
                    <td class="return-cell">${signal.expectedReturn}%</td>
                    <td class="reason-cell" title="${signal.reason}">${this.getRejectionTypeDisplay(signal.rejectionType)}</td>
                    <td class="gain-cell">${(signal.potentialMissedGain * 100).toFixed(2)}%</td>
                `;
                
                tbody.appendChild(row);
            });
            
        } catch (error) {
            console.error('Error updating rejected signals:', error);
        }
    }

    getRejectionTypeDisplay(type) {
        const displays = {
            'DUPLICATE_SIGNAL': '🔄 Duplicate',
            'LOW_CONFIDENCE': '📉 Low Conf.',
            'MAX_ORDERS_EXCEEDED': '⚠️ Max Orders',
            'TRADE_COOLDOWN': '⏰ Cooldown',
            'RISK_MANAGER_DENIAL': '🚫 Risk Block',
            'INVALID_POSITION_SIZE': '💰 Invalid Size',
            'CLOSE_NOT_IMPLEMENTED': '🔒 Not Impl.'
        };
        return displays[type] || type;
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
        window.refreshRejectedSignals = () => this.updateRejectedSignals();
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