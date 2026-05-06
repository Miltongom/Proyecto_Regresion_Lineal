class VisualizationController {
    constructor() {
        this.regressionChart = null;
        this.errorChart = null;
        this.comparisonHistories = [];
    }

    initCharts() {
        const regressionCanvas = document.getElementById('regression-chart');
        const errorCanvas = document.getElementById('error-chart');

        if (regressionCanvas && window.Chart) {
            this.regressionChart = new Chart(regressionCanvas, {
                type: 'scatter',
                data: {
                    datasets: [
                        {
                            label: 'Datos reales (y)',
                            data: [],
                            backgroundColor: '#2563eb',
                            borderColor: '#2563eb',
                            pointRadius: 7,
                            pointHoverRadius: 9,
                            showLine: false
                        },
                        {
                            type: 'line',
                            label: 'Línea de regresión',
                            data: [],
                            borderColor: '#ef4444',
                            backgroundColor: 'rgba(239, 68, 68, 0.1)',
                            borderWidth: 3,
                            tension: 0.2,
                            pointRadius: 0,
                            fill: false
                        },
                        {
                            label: 'Predicciones ŷ',
                            data: [],
                            backgroundColor: '#f97316',
                            borderColor: '#f97316',
                            pointRadius: 7,
                            pointHoverRadius: 9,
                            pointStyle: 'triangle',
                            showLine: false
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    animation: {
                        duration: 550,
                        easing: 'easeOutQuart'
                    },
                    plugins: {
                        title: {
                            display: true,
                            text: 'Datos y Línea de Regresión'
                        },
                        legend: {
                            position: 'top'
                        }
                    },
                    scales: {
                        x: {
                            title: {
                                display: true,
                                text: 'X'
                            }
                        },
                        y: {
                            title: {
                                display: true,
                                text: 'Y'
                            }
                        }
                    }
                }
            });
        }

        if (errorCanvas && window.Chart) {
            this.errorChart = new Chart(errorCanvas, {
                type: 'line',
                data: {
                    labels: [],
                    datasets: [
                        {
                            label: 'MSE principal',
                            data: [],
                            borderColor: '#10b981',
                            backgroundColor: 'rgba(16, 185, 129, 0.18)',
                            fill: true,
                            borderWidth: 3,
                            tension: 0.25,
                            pointRadius: 3,
                            pointHoverRadius: 6
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    animation: {
                        duration: 550,
                        easing: 'easeOutQuart'
                    },
                    plugins: {
                        title: {
                            display: true,
                            text: 'Convergencia del Error (MSE)'
                        },
                        legend: {
                            position: 'top'
                        }
                    },
                    scales: {
                        x: {
                            title: {
                                display: true,
                                text: 'Iteración'
                            }
                        },
                        y: {
                            title: {
                                display: true,
                                text: 'MSE'
                            }
                        }
                    }
                }
            });
        }
    }

    updateRegressionChart(xData, yData, yHat, m, b, iterationNumber) {
        if (!this.regressionChart) {
            return;
        }

        this.regressionChart.data.datasets[0].data = xData.map((x, index) => ({ x, y: yData[index] }));
        this.regressionChart.data.datasets[1].data = this.generateLinePoints(xData, m, b);
        this.regressionChart.data.datasets[2].data = Array.isArray(yHat)
            ? xData.map((x, index) => ({ x, y: yHat[index] }))
            : [];
        this.regressionChart.options.plugins.title.text = `Datos y Línea de Regresión · Iteración ${iterationNumber}`;
        this.regressionChart.update();
    }

    updateErrorChart(history) {
        if (!this.errorChart) {
            return;
        }

        const labels = history.map((item) => item.iterationNumber);
        const datasets = [
            {
                label: 'MSE principal',
                data: history.map((item) => item.mse),
                borderColor: '#10b981',
                backgroundColor: 'rgba(16, 185, 129, 0.18)',
                fill: true,
                borderWidth: 3,
                tension: 0.25,
                pointRadius: labels.map(() => 3),
                pointHoverRadius: 6
            }
        ];

        const compareEnabled = document.getElementById('toggle-lr-compare')?.checked;
        if (compareEnabled && Array.isArray(this.comparisonHistories)) {
            this.comparisonHistories.forEach((series) => {
                datasets.push({
                    label: series.label,
                    data: series.history.map((item) => item.mse),
                    borderColor: series.color,
                    backgroundColor: 'transparent',
                    fill: false,
                    borderDash: [8, 6],
                    borderWidth: 2,
                    tension: 0.2,
                    pointRadius: 0
                });
            });
        }

        this.errorChart.data.labels = labels;
        this.errorChart.data.datasets = datasets;
        this.errorChart.update();
    }

    generateLinePoints(xData, m, b) {
        if (!xData.length) {
            return [];
        }

        const minX = Math.min(...xData);
        const maxX = Math.max(...xData);
        return [
            { x: minX, y: (m * minX) + b },
            { x: maxX, y: (m * maxX) + b }
        ];
    }

    highlightIteration(index) {
        const rows = document.querySelectorAll('#iteration-history-body tr');
        rows.forEach((row, rowIndex) => {
            row.classList.toggle('is-active', rowIndex === index);
        });

        if (!this.errorChart || !this.errorChart.data.datasets.length) {
            return;
        }

        this.errorChart.data.datasets = this.errorChart.data.datasets.map((dataset, datasetIndex) => {
            if (datasetIndex !== 0 || !Array.isArray(this.errorChart.data.labels)) {
                return dataset;
            }

            return {
                ...dataset,
                pointRadius: this.errorChart.data.labels.map((_, labelIndex) => (labelIndex === index ? 6 : 3)),
                pointBackgroundColor: this.errorChart.data.labels.map((_, labelIndex) => (labelIndex === index ? '#f59e0b' : '#10b981')),
                pointBorderColor: this.errorChart.data.labels.map((_, labelIndex) => (labelIndex === index ? '#b45309' : '#10b981'))
            };
        });

        this.errorChart.update('none');
    }
}

window.VisualizationController = VisualizationController;