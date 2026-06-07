let chartjsPromise = null;
const activeCharts = new Map();

function loadChartJs() {
    if (window.Chart) {
        return Promise.resolve();
    }
    if (chartjsPromise) {
        return chartjsPromise;
    }
    chartjsPromise = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/chart.js';
        script.onload = () => {
            resolve();
        };
        script.onerror = (err) => {
            chartjsPromise = null;
            reject(err);
        };
        document.head.appendChild(script);
    });
    return chartjsPromise;
}

export async function drawLineChart(canvasId, data, labels, options = null) {
    await loadChartJs();
    const canvas = document.getElementById(canvasId);
    if (!canvas) throw new Error(`Canvas with id ${canvasId} not found.`);
    
    destroyChart(canvasId);
    
    const chart = new window.Chart(canvas, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: options?.label || 'Value',
                data: data,
                borderColor: options?.borderColor || 'rgb(75, 192, 192)',
                backgroundColor: options?.backgroundColor || 'rgba(75, 192, 192, 0.2)',
                tension: options?.tension ?? 0.1
            }]
        },
        options: options || {}
    });
    activeCharts.set(canvasId, chart);
}

export async function drawBarChart(canvasId, data, labels, options = null) {
    await loadChartJs();
    const canvas = document.getElementById(canvasId);
    if (!canvas) throw new Error(`Canvas with id ${canvasId} not found.`);
    
    destroyChart(canvasId);
    
    const chart = new window.Chart(canvas, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: options?.label || 'Value',
                data: data,
                backgroundColor: options?.backgroundColor || 'rgba(54, 162, 235, 0.2)',
                borderColor: options?.borderColor || 'rgb(54, 162, 235)',
                borderWidth: options?.borderWidth || 1
            }]
        },
        options: options || {}
    });
    activeCharts.set(canvasId, chart);
}

export async function drawDonutChart(canvasId, data, labels, options = null) {
    await loadChartJs();
    const canvas = document.getElementById(canvasId);
    if (!canvas) throw new Error(`Canvas with id ${canvasId} not found.`);
    
    destroyChart(canvasId);
    
    const chart = new window.Chart(canvas, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: options?.backgroundColor || [
                    'rgba(255, 99, 132, 0.2)',
                    'rgba(54, 162, 235, 0.2)',
                    'rgba(255, 206, 86, 0.2)',
                    'rgba(75, 192, 192, 0.2)',
                    'rgba(153, 102, 255, 0.2)'
                ],
                borderColor: options?.borderColor || [
                    'rgba(255, 99, 132, 1)',
                    'rgba(54, 162, 235, 1)',
                    'rgba(255, 206, 86, 1)',
                    'rgba(75, 192, 192, 1)',
                    'rgba(153, 102, 255, 1)'
                ],
                borderWidth: options?.borderWidth || 1
            }]
        },
        options: options || {}
    });
    activeCharts.set(canvasId, chart);
}

function destroyChart(canvasId) {
    if (activeCharts.has(canvasId)) {
        try {
            activeCharts.get(canvasId).destroy();
        } catch (e) {
            console.error("Failed to destroy chart", e);
        }
        activeCharts.delete(canvasId);
    }
}
