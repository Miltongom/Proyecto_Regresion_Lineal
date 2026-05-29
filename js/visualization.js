class VisualizationController {
    constructor() {
        this.regressionChart = null;
        this.errorChart = null;
        this.allIterationsChart = null;
        this.comparisonHistories = [];
        this.selectedIterations = new Set(); // Iteraciones seleccionadas para comparar
    }

    initCharts() {
        const regressionCanvas = document.getElementById('regression-chart');
        const errorCanvas = document.getElementById('error-chart');
        const allIterationsCanvas = document.getElementById('all-iterations-chart');

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

        if (allIterationsCanvas && window.Chart) {
            this.allIterationsChart = new Chart(allIterationsCanvas, {
                type: 'scatter',
                data: {
                    datasets: []
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    animation: {
                        duration: 750,
                        easing: 'easeOutQuart'
                    },
                    plugins: {
                        title: {
                            display: true,
                            text: 'Comparador de Iteraciones'
                        },
                        legend: {
                            display: true,
                            position: 'top',
                            labels: {
                                usePointStyle: true,
                                padding: 15,
                                font: {
                                    size: 11
                                }
                            }
                        },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    const label = context.dataset.label || '';
                                    return label + ': (' + context.parsed.x.toFixed(2) + ', ' + context.parsed.y.toFixed(2) + ')';
                                }
                            }
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

    updateAllIterationsChart(xData, yData, history) {
        if (!this.allIterationsChart) {
            return;
        }

        const toggleEnabled = document.getElementById('toggle-all-iterations')?.checked;
        if (!toggleEnabled) {
            this.allIterationsChart.data.datasets = [];
            this.allIterationsChart.update();
            return;
        }

        // Si no hay selección, mostrar todas
        const showAll = this.selectedIterations.size === 0;
        const iterationsToShow = showAll 
            ? history.map((_, i) => i)
            : Array.from(this.selectedIterations);

        const datasets = [];
        
        // Agregar puntos reales
        datasets.push({
            label: 'Datos reales',
            data: xData.map((x, index) => ({ x, y: yData[index] })),
            backgroundColor: '#2563eb',
            borderColor: '#2563eb',
            pointRadius: 8,
            pointHoverRadius: 10,
            showLine: false,
            order: 0
        });

        // Generar colores para las iteraciones
        const colors = this.generateIterationColors(history.length);

        // Agregar línea para cada iteración seleccionada
        iterationsToShow.forEach((index) => {
            const iter = history[index];
            const isFirst = index === 0;
            const isLast = index === history.length - 1;
            const isSelected = this.selectedIterations.has(index);
            
            datasets.push({
                type: 'line',
                label: `Iteración ${iter.iterationNumber} (MSE: ${iter.mse.toFixed(4)})`,
                data: this.generateLinePoints(xData, iter.newM, iter.newB),
                borderColor: colors[index],
                backgroundColor: 'transparent',
                borderWidth: isLast ? 4 : (isFirst ? 3 : 2),
                borderDash: isFirst ? [8, 4] : [],
                tension: 0,
                pointRadius: 0,
                fill: false,
                order: isLast ? 1 : (isFirst ? 2 : 3)
            });
        });

        this.allIterationsChart.data.datasets = datasets;
        this.allIterationsChart.update();

        // Actualizar tabla de comparación
        this.updateComparisonTable(history, iterationsToShow);
    }

    generateIterationColors(count) {
        const colors = [];
        for (let i = 0; i < count; i++) {
            const ratio = i / Math.max(count - 1, 1);
            // Gradiente de rojo (#ef4444) a verde (#10b981)
            const r = Math.round(239 - (239 - 16) * ratio);
            const g = Math.round(68 + (185 - 68) * ratio);
            const b = Math.round(68 + (129 - 68) * ratio);
            colors.push(`rgb(${r}, ${g}, ${b})`);
        }
        return colors;
    }

    updateComparisonTable(history, iterationsToShow) {
        const tbody = document.getElementById('comparison-table-body');
        if (!tbody) return;

        tbody.innerHTML = '';

        iterationsToShow.forEach((index) => {
            const iter = history[index];
            const prevIter = index > 0 ? history[index - 1] : null;
            const improvement = prevIter 
                ? ((prevIter.mse - iter.mse) / prevIter.mse * 100)
                : 0;

            const row = document.createElement('tr');
            row.innerHTML = `
                <td><strong>Iteración ${iter.iterationNumber}</strong></td>
                <td>${iter.newM.toFixed(6)}</td>
                <td>${iter.newB.toFixed(6)}</td>
                <td><span class="mse-badge">${iter.mse.toFixed(6)}</span></td>
                <td>${prevIter 
                    ? `<span class="improvement-badge ${improvement > 0 ? 'positive' : 'negative'}">
                        ${improvement > 0 ? '↓' : '↑'} ${Math.abs(improvement).toFixed(2)}%
                       </span>`
                    : '<span class="muted-msg">—</span>'
                }</td>
            `;
            tbody.appendChild(row);
        });
    }

    renderIterationSelector(history) {
        const container = document.getElementById('selector-chips');
        if (!container) return;

        container.innerHTML = '';

        history.forEach((iter, index) => {
            const chip = document.createElement('button');
            chip.className = 'iteration-chip';
            chip.dataset.index = index;
            chip.innerHTML = `
                <span class="chip-label">Iter ${iter.iterationNumber}</span>
                <span class="chip-mse">MSE: ${iter.mse.toFixed(4)}</span>
            `;

            chip.addEventListener('click', () => {
                this.toggleIterationSelection(index);
            });

            container.appendChild(chip);
        });

        // Botón para restablecer
        const resetBtn = document.getElementById('btn-reset-selection');
        if (resetBtn) {
            resetBtn.onclick = () => {
                this.selectedIterations.clear();
                this.updateIterationChipsUI();
                if (window.engine) {
                    this.updateAllIterationsChart(window.engine.xData, window.engine.yData, window.engine.history);
                }
            };
        }
    }

    toggleIterationSelection(index) {
        if (this.selectedIterations.has(index)) {
            this.selectedIterations.delete(index);
        } else {
            this.selectedIterations.add(index);
        }

        this.updateIterationChipsUI();

        // Actualizar gráfica
        if (window.engine) {
            this.updateAllIterationsChart(window.engine.xData, window.engine.yData, window.engine.history);
        }
    }

    updateIterationChipsUI() {
        const chips = document.querySelectorAll('.iteration-chip');
        chips.forEach((chip) => {
            const index = parseInt(chip.dataset.index);
            if (this.selectedIterations.has(index)) {
                chip.classList.add('selected');
            } else {
                chip.classList.remove('selected');
            }
        });

        // Actualizar texto del selector
        const selectorTitle = document.querySelector('.selector-title');
        if (selectorTitle) {
            if (this.selectedIterations.size === 0) {
                selectorTitle.textContent = 'Selecciona iteraciones para comparar (mostrando todas):';
            } else {
                selectorTitle.textContent = `Comparando ${this.selectedIterations.size} iteración(es):`;
            }
        }
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