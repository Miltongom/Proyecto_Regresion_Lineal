class SimulationController {
    constructor(engine) {
        this.engine = engine;
        this.currentIterationIndex = 0;
        this.currentStepIndex = 0;
        this.steps = [
            { title: 'Parámetros actuales', formula: 'y^ = m·x + b' },
            { title: 'Cálculo de predicciones  (y^ = m·x + b)', formula: 'y^ᵢ = m·xᵢ + b' },
            { title: 'Cálculo de error  (error = y^ − y)', formula: 'errorᵢ = y^ᵢ − yᵢ' },
            { title: 'Error al cuadrado  (error²)', formula: 'error²ᵢ = (y^ᵢ − yᵢ)²' },
            { title: 'Error cuadrático medio  (MSE)', formula: 'MSE = (1/n) · Σ error²ᵢ' },
            { title: 'Notación matricial  (Xᵦ, Xᵦᵀ, gradiente)', formula: 'Xᵦ = [1 | X]  →  ∇θ = (2/n)·Xᵦᵀ·(y^−y)' },
            { title: 'Gradiente respecto a b  (∂E/∂b)', formula: '∂E/∂b = (2/n) · Σ errorᵢ' },
            { title: 'Gradiente respecto a m  (∂E/∂m)', formula: '∂E/∂m = (2/n) · Σ(errorᵢ · xᵢ)' },
            { title: 'Nuevo valor de theta  (actualización de parámetros)', formula: 'm ← m − α · ∂E/∂m,   b ← b − α · ∂E/∂b' }
        ];
    }

    nextStep() {
        if (!this.engine.history.length) {
            return '';
        }

        if (this.currentStepIndex < this.steps.length - 1) {
            this.currentStepIndex += 1;
        } else if (this.currentIterationIndex < this.engine.history.length - 1) {
            this.currentIterationIndex += 1;
            this.currentStepIndex = 0;
        }

        return this.renderCurrentStep();
    }

    prevStep() {
        if (!this.engine.history.length) {
            return '';
        }

        if (this.currentStepIndex > 0) {
            this.currentStepIndex -= 1;
        } else if (this.currentIterationIndex > 0) {
            this.currentIterationIndex -= 1;
            this.currentStepIndex = this.steps.length - 1;
        }

        return this.renderCurrentStep();
    }

    nextIteration() {
        if (!this.engine.history.length) {
            return '';
        }

        this.currentIterationIndex = Math.min(this.currentIterationIndex + 1, this.engine.history.length - 1);
        return this.renderCurrentStep();
    }

    prevIteration() {
        if (!this.engine.history.length) {
            return '';
        }

        this.currentIterationIndex = Math.max(this.currentIterationIndex - 1, 0);
        return this.renderCurrentStep();
    }

    runAllIterations() {
        if (!this.engine.history.length) {
            return '';
        }

        this.currentIterationIndex = this.engine.history.length - 1;
        this.currentStepIndex = this.steps.length - 1;
        return this.renderCurrentStep();
    }

    renderCurrentStep() {
        const display = document.getElementById('step-display');
        const iterationIndicator = document.getElementById('iteration-indicator');
        const stepIndicator = document.getElementById('step-indicator');

        if (!display || !this.engine.history.length) {
            return '';
        }

        const iterationData = this.engine.history[this.currentIterationIndex];
        const stepData = this.getStepData(iterationData, this.currentStepIndex);
        const tableHTML = this.generateTableHTML(iterationData, this.currentStepIndex);
        const html = `
            <div class="step-shell">
                <div class="step-top">
                    <div class="step-meta">
                        <div class="step-badge">Paso ${this.currentStepIndex + 1}</div>
                        <h3>${stepData.title}</h3>
                        <p>${stepData.explanation}</p>
                    </div>
                    <div class="metric-card">
                        <span class="metric-label">Iteración en vista</span>
                        <div class="metric-value">${iterationData.iterationNumber}</div>
                    </div>
                </div>
                <div class="formula-box">${stepData.formula}</div>
                ${stepData.extraHtml}
                ${tableHTML}
                <p class="summary-note">${stepData.educationalText}</p>
            </div>
        `;

        display.classList.remove('empty-state');
        display.innerHTML = html;
        iterationIndicator.textContent = `Iteración ${this.currentIterationIndex + 1} de ${this.engine.history.length}`;
        stepIndicator.textContent = `Paso ${this.currentStepIndex + 1} de ${this.steps.length}`;
        this.renderIterationHistory();
        return html;
    }

    getStepData(iterationData, stepIndex) {
        const xValues = this.engine.xData;
        const yValues = this.engine.yData;
        const xVector = this.vectorString(xValues);
        const yVector = this.vectorString(yValues);
        const yHatVector = this.vectorString(iterationData.yHat);
        const errorVector = this.vectorString(iterationData.errors);
        const squaredVector = this.vectorString(iterationData.squaredErrors);
        const products = iterationData.errors.map((error, index) => error * xValues[index]);
        const productVector = this.vectorString(products);
        const mseExpression = iterationData.squaredErrors.map((value) => this.formatNumber(value)).join(' + ');
        const errorExpression = iterationData.errors.map((value) => this.formatNumber(value)).join(' + ');
        const productExpression = products.map((value) => this.formatNumber(value)).join(' + ');
        const step = this.steps[stepIndex];
        const explanations = this.getEducationalExplanation(stepIndex);

        // Convención Excel: error = y^ − y (valores negativos cuando el modelo subestima)
        const displayErrors = iterationData.yHat.map((yh, i) => yh - yValues[i]);
        const displayErrorVector = this.vectorString(displayErrors);
        const displayProducts = displayErrors.map((e, i) => e * xValues[i]);
        const displayProductVector = this.vectorString(displayProducts);
        const displayErrorExpression = displayErrors.map((v) => this.formatNumber(v)).join(' + ');
        const displayProductExpression = displayProducts.map((v) => this.formatNumber(v)).join(' + ');
        const displayErrorSum = displayErrors.reduce((s, v) => s + v, 0);
        const displayProductSum = displayProducts.reduce((s, v) => s + v, 0);

        const stepsData = [
            {
                title: step.title,
                formula: `Modelo actual: ŷ = m·x + b = ${this.formatNumber(iterationData.m_before)}·x + ${this.formatNumber(iterationData.b_before)}`,
                explanation: `Antes de recalcular el error, observamos la recta con la que inicia la iteración ${iterationData.iterationNumber}.`,
                extraHtml: `
                    <div class="metrics-grid">
                        <div class="metric-card">
                            <span class="metric-label">Pendiente inicial</span>
                            <div class="metric-value">${this.formatNumber(iterationData.m_before)}</div>
                        </div>
                        <div class="metric-card">
                            <span class="metric-label">Intercepto inicial</span>
                            <div class="metric-value">${this.formatNumber(iterationData.b_before)}</div>
                        </div>
                        <div class="metric-card">
                            <span class="metric-label">Learning rate α</span>
                            <div class="metric-value warning">${this.formatNumber(this.engine.learningRate)}</div>
                        </div>
                    </div>
                `,
                educationalText: explanations
            },
            {
                title: step.title,
                formula: `Para cada dato: y^ᵢ = ${this.formatNumber(iterationData.m_before)}·xᵢ + ${this.formatNumber(iterationData.b_before)}  →  y^ = ${yHatVector}`,
                explanation: `Sustituimos la pendiente (m) y el intercepto (b) actuales para obtener la predicción y^ en cada punto x.`,
                extraHtml: `
                    <div class="metrics-grid">
                        <div class="metric-card">
                            <span class="metric-label">Ecuación</span>
                            <div class="metric-value prediction-text">y^ = ${this.formatNumber(iterationData.m_before)}·x + ${this.formatNumber(iterationData.b_before)}</div>
                        </div>
                        <div class="metric-card">
                            <span class="metric-label">Punto 1  →  y^₁</span>
                            <div class="metric-value prediction-text">y^₁ = ${this.formatNumber(iterationData.m_before)}·${this.formatNumber(xValues[0])} + ${this.formatNumber(iterationData.b_before)} = ${this.formatNumber(iterationData.yHat[0])}</div>
                        </div>
                    </div>
                `,
                educationalText: explanations
            },
            {
                title: step.title,
                formula: `error = y^ − y  =  ${yHatVector} − ${yVector}  =  ${displayErrorVector}`,
                explanation: `El error se calcula como y^ − y (igual que en la hoja de cálculo). Un valor negativo indica que la predicción fue menor que el valor real.`,
                extraHtml: `
                    <div class="metrics-grid">
                        <div class="metric-card">
                            <span class="metric-label">Punto 1  →  error₁</span>
                            <div class="metric-value ${this.getErrorClass(displayErrors[0])}">error₁ = ${this.formatNumber(iterationData.yHat[0])} − ${this.formatNumber(yValues[0])} = ${this.formatNumber(displayErrors[0])}</div>
                        </div>
                        <div class="metric-card">
                            <span class="metric-label">Σ error</span>
                            <div class="metric-value ${this.getErrorClass(displayErrorSum)}">${this.formatNumber(displayErrorSum)}</div>
                        </div>
                    </div>
                `,
                educationalText: explanations
            },
            {
                title: step.title,
                formula: `error² = (${displayErrorVector})²  =  ${squaredVector}`,
                explanation: `Al elevar al cuadrado eliminamos el signo del error. Los errores grandes pesan más, empujando al modelo a corregirlos con prioridad.`,
                extraHtml: `
                    <div class="metrics-grid">
                        <div class="metric-card">
                            <span class="metric-label">Punto 1  →  error²₁</span>
                            <div class="metric-value">error²₁ = (${this.formatNumber(displayErrors[0])})² = ${this.formatNumber(iterationData.squaredErrors[0])}</div>
                        </div>
                        <div class="metric-card">
                            <span class="metric-label">Σ error²</span>
                            <div class="metric-value warning">${this.formatNumber(iterationData.squaredErrors.reduce((s, v) => s + v, 0))}</div>
                        </div>
                    </div>
                `,
                educationalText: explanations
            },
            {
                title: step.title,
                formula: `MSE = (1/${this.engine.n})·(${mseExpression}) = ${this.formatNumber(iterationData.mse)}`,
                explanation: `Promediamos todos los errores cuadrados para evaluar la calidad global del modelo en esta iteración.`,
                extraHtml: `
                    <div class="metrics-grid">
                        <div class="metric-card">
                            <span class="metric-label">Número de datos</span>
                            <div class="metric-value">${this.engine.n}</div>
                        </div>
                        <div class="metric-card">
                            <span class="metric-label">Error cuadrático medio</span>
                            <div class="metric-value warning">${this.formatNumber(iterationData.mse)}</div>
                        </div>
                    </div>
                `,
                educationalText: explanations
            },
            {
                title: step.title,
                formula: `Xᵦ (n×2) → Xᵦᵀ (2×n) · e → ∇θ = (2/n)·Xᵦᵀ·(ŷ−y)`,
                explanation: `Organizamos los datos en la matriz aumentada Xᵦ (columna de 1s + columna X). Su transpuesta por el vector error da el gradiente en notación matricial, igual que en la hoja de cálculo.`,
                extraHtml: (() => {
                    const n = xValues.length;
                    const matErr = iterationData.yHat.map((yh, i) => yh - this.engine.yData[i]);
                    const gradB = (2 / n) * matErr.reduce((s, e) => s + e, 0);
                    const gradM = (2 / n) * matErr.reduce((s, e, i) => s + e * xValues[i], 0);
                    const td = (v, extra='') => `<td style="padding:4px 10px;border:1px solid #334;text-align:center;font-family:monospace;font-size:.85rem${extra}">${v}</td>`;
                    const th = (v) => `<td style="padding:4px 10px;border:1px solid #334;text-align:center;font-family:monospace;font-size:.85rem;background:rgba(255,255,255,.06);font-weight:700">${v}</td>`;
                    const matStyle = 'border-collapse:collapse;margin:4px auto';

                    const xbRows = xValues.map(x => `<tr>${td('1')}${td(this.formatNumber(x))}</tr>`).join('');
                    const errRows = matErr.map(e => `<tr>${td(this.formatNumber(e), ';color:' + (e < 0 ? '#f87171' : '#4ade80'))}</tr>`).join('');
                    const gradRows = `<tr><td style="padding:4px 12px;border:1px solid #334;font-family:monospace;color:#facc15;font-weight:700">∇b = ${this.formatNumber(gradB)}</td></tr>
                        <tr><td style="padding:4px 12px;border:1px solid #334;font-family:monospace;color:#facc15;font-weight:700">∇m = ${this.formatNumber(gradM)}</td></tr>`;

                    return `
                    <div style="display:flex;flex-wrap:wrap;gap:16px;align-items:flex-start;justify-content:center;margin:12px 0">
                        <div class="matrix-item">
                            <h4>Xᵦ (n×2)</h4>
                            <table style="${matStyle}"><thead><tr>${th('1')}${th('x')}</tr></thead><tbody>${xbRows}</tbody></table>
                        </div>
                        <div style="align-self:center;font-size:1.4rem;color:var(--text-light)">→</div>
                        <div class="matrix-item">
                            <h4>Xᵦᵀ (2×n)</h4>
                            <table style="${matStyle}"><tbody>
                                <tr>${xValues.map(() => td('1')).join('')}</tr>
                                <tr>${xValues.map(x => td(this.formatNumber(x))).join('')}</tr>
                            </tbody></table>
                        </div>
                        <div style="align-self:center;font-size:1.4rem;color:var(--text-light)">×</div>
                        <div class="matrix-item">
                            <h4>e = ŷ − y</h4>
                            <table style="${matStyle}"><tbody>${errRows}</tbody></table>
                        </div>
                        <div style="align-self:center;font-size:1.4rem;color:var(--text-light)">=</div>
                        <div class="matrix-item">
                            <h4>∇θ = (2/n)·Xᵦᵀ·e</h4>
                            <table style="${matStyle}"><tbody>${gradRows}</tbody></table>
                        </div>
                    </div>`;
                })(),
                educationalText: explanations
            },
            {
                title: step.title,
                formula: `∂E/∂b = (2/${this.engine.n})·(${displayErrorExpression}) = ${this.formatNumber(iterationData.gradB)}`,
                explanation: `Sumamos todos los errores (y^ − y) y calculamos qué tan sensible es el MSE respecto al intercepto b.`,
                extraHtml: `
                    <div class="metrics-grid">
                        <div class="metric-card">
                            <span class="metric-label">Σ error</span>
                            <div class="metric-value ${this.getErrorClass(displayErrorSum)}">${this.formatNumber(displayErrorSum)}</div>
                        </div>
                        <div class="metric-card">
                            <span class="metric-label">Gradiente ∂E/∂b</span>
                            <div class="metric-value gradient">${this.formatNumber(iterationData.gradB)}</div>
                        </div>
                    </div>
                `,
                educationalText: explanations
            },
            {
                title: step.title,
                formula: `∂E/∂m = (2/${this.engine.n})·(${displayProductExpression}) = ${this.formatNumber(iterationData.gradM)}`,
                explanation: `Multiplicamos cada error por su x para medir el impacto de la pendiente. Σ(error·x) refleja cuánto contribuye cada punto al ajuste de m.`,
                extraHtml: `
                    <div class="metrics-grid">
                        <div class="metric-card">
                            <span class="metric-label">Σ(error · x)</span>
                            <div class="metric-value gradient">${this.formatNumber(displayProductSum)}</div>
                        </div>
                        <div class="metric-card">
                            <span class="metric-label">Gradiente ∂E/∂m</span>
                            <div class="metric-value gradient">${this.formatNumber(iterationData.gradM)}</div>
                        </div>
                    </div>
                `,
                educationalText: explanations
            },
            {
                title: step.title,
                formula: `mₙ = ${this.formatNumber(iterationData.m_before)} − ${this.formatNumber(this.engine.learningRate)}·(${this.formatNumber(iterationData.gradM)}) = ${this.formatNumber(iterationData.newM)}<br>bₙ = ${this.formatNumber(iterationData.b_before)} − ${this.formatNumber(this.engine.learningRate)}·(${this.formatNumber(iterationData.gradB)}) = ${this.formatNumber(iterationData.newB)}`,
                explanation: `Actualizamos theta restando el gradiente escalado por α. Estos son los nuevos valores de theta para la siguiente iteración.`,
                extraHtml: `
                    <div class="metrics-grid">
                        <div class="metric-card">
                            <span class="metric-label">Nuevo valor b</span>
                            <div class="metric-value success">${this.formatNumber(iterationData.newB)}</div>
                        </div>
                        <div class="metric-card">
                            <span class="metric-label">Nuevo valor m</span>
                            <div class="metric-value success">${this.formatNumber(iterationData.newM)}</div>
                        </div>
                        <div class="metric-card">
                            <span class="metric-label">Learning rate α</span>
                            <div class="metric-value warning">${this.formatNumber(this.engine.learningRate)}</div>
                        </div>
                    </div>
                `,
                educationalText: explanations
            }
        ];

        return stepsData[stepIndex];
    }

    generateTableHTML(iterationData, stepIndex) {
        // Columnas resaltadas por paso (sin columna e·x — no aparece en la hoja Excel)
        const highlightMap = {
            0: [],
            1: ['yHat'],
            2: ['errors'],
            3: ['squaredErrors'],
            4: ['squaredErrors'],
            5: ['yHat', 'errors'],
            6: ['errors'],
            7: [],
            8: ['yHat', 'errors']
        };

        const highlighted = highlightMap[stepIndex] || [];

        const rows = this.engine.xData.map((x, index) => {
            // Convención Excel: error = y^ − y
            const displayError = iterationData.yHat[index] - this.engine.yData[index];
            const errorClass = this.getErrorClass(displayError);
            return `
                <tr>
                    <td>${index + 1}</td>
                    <td>${this.formatNumber(x)}</td>
                    <td>${this.formatNumber(this.engine.yData[index])}</td>
                    <td class="${highlighted.includes('yHat') ? 'highlight-col ' : ''}prediction-text">${this.formatNumber(iterationData.yHat[index])}</td>
                    <td class="${highlighted.includes('errors') ? 'highlight-col ' : ''}${errorClass}">${this.formatNumber(displayError)}</td>
                    <td class="${highlighted.includes('squaredErrors') ? 'highlight-col ' : ''}">${this.formatNumber(iterationData.squaredErrors[index])}</td>
                </tr>
            `;
        }).join('');

        const squaredSum = iterationData.squaredErrors.reduce((s, v) => s + v, 0);

        return `
            <div class="table-scroll data-table">
                <table>
                    <thead>
                        <tr>
                            <th>Punto</th>
                            <th>X</th>
                            <th>y</th>
                            <th class="${highlighted.includes('yHat') ? 'highlight-col' : ''}">y^</th>
                            <th class="${highlighted.includes('errors') ? 'highlight-col' : ''}">error</th>
                            <th class="${highlighted.includes('squaredErrors') ? 'highlight-col' : ''}">error²</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows}
                    </tbody>
                    <tfoot>
                        <tr>
                            <td colspan="5" style="text-align:right"><strong>MSE = Σerror² / n =</strong></td>
                            <td class="${highlighted.includes('squaredErrors') ? 'highlight-col ' : ''}"><strong>${this.formatNumber(iterationData.mse)}</strong></td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        `;
    }

    getEducationalExplanation(stepIndex) {
        const texts = [
            'Todo entrenamiento comienza con una hipótesis inicial. Esta recta es la referencia desde la cual calcularemos el error y construiremos la actualización.',
            'Las predicciones muestran lo que el modelo cree que debería valer y para cada dato de entrada. Si la recta está mal ubicada, estas predicciones estarán lejos de los valores reales.',
            'El error conserva dirección. Un valor positivo indica que la predicción quedó corta; un valor negativo indica que fue demasiado alta. Esa dirección es esencial para el gradiente.',
            'Elevar al cuadrado evita que errores positivos y negativos se cancelen. Además, castiga más a los errores grandes, empujando al modelo a corregirlos con prioridad.',
            'El MSE resume el comportamiento del modelo en un único número. Mientras más pequeño sea, más cerca estará la recta de los datos observados.',
            'La notación matricial ayuda a conectar el cálculo manual con implementaciones más avanzadas de Machine Learning, donde muchas operaciones se vectorizan por eficiencia.',
            'El gradiente de b indica si conviene mover la recta hacia arriba o hacia abajo. Su magnitud refleja la intensidad del ajuste necesario.',
            'El gradiente de m combina error y posición horizontal. Así sabemos si la pendiente debe inclinarse más o menos para seguir la tendencia de los datos.',
            'La actualización es el corazón del aprendizaje. Restamos el gradiente porque queremos movernos en la dirección opuesta al crecimiento del error.'
        ];

        return texts[stepIndex];
    }

    renderIterationHistory() {
        const tbody = document.getElementById('iteration-history-body');
        if (!tbody) {
            return;
        }

        if (!this.engine.history.length) {
            tbody.innerHTML = '<tr><td colspan="4">Aún no hay iteraciones calculadas.</td></tr>';
            return;
        }

        tbody.innerHTML = this.engine.history.map((item, index) => `
            <tr class="${index === this.currentIterationIndex ? 'is-active' : ''}">
                <td>${item.iterationNumber}</td>
                <td>${this.formatNumber(item.newM)}</td>
                <td>${this.formatNumber(item.newB)}</td>
                <td>${this.formatNumber(item.mse)}</td>
            </tr>
        `).join('');
    }

    formatNumber(value) {
        const numericValue = Number(value);
        if (!Number.isFinite(numericValue)) {
            return '—';
        }

        return numericValue.toFixed(3);
    }

    getErrorClass(value) {
        return Number(value) >= 0 ? 'error-positive' : 'error-negative';
    }

    vectorString(values) {
        return `[${values.map((value) => this.formatNumber(value)).join(', ')}]`;
    }
}

window.SimulationController = SimulationController;