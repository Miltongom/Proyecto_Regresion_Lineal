document.addEventListener('DOMContentLoaded', () => {
    // Datos exactos de la hoja de trabajo (X=[2,10,6,8,4], y=[11,37,23,28,16], lr=0.005)
    const defaultConfig = {
        x: [2, 10, 6, 8, 4],
        y: [11, 37, 23, 28, 16],
        m: 0,
        b: 0,
        lr: 0.005,
        iterations: 5
    };

    let engine = null;
    let simulationController = null;
    let visualization = new VisualizationController();
    let chatbot = new ChatbotController();
    let currentConfig = null;

    // ─── INIT ───
    visualization.initCharts();
    applyDefaultInputs();
    hydrateChatbotSettings();
    bindEvents();
    updateDataPreview();
    updateThetaDisplay();

    // ─── EVENT BINDINGS ───
    function bindEvents() {
        // Nav sidebar
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', e => {
                e.preventDefault();
                const page = item.dataset.page;
                if (page) switchPage(page);
            });
        });

        // Nav toggle (collapse/expand sidebar)
        document.getElementById('btn-toggle-nav')?.addEventListener('click', () => {
            document.getElementById('nav-sidebar')?.classList.toggle('collapsed');
        });

        // data-nav buttons (hero, workflow, empty state)
        document.addEventListener('click', e => {
            const navTarget = e.target.closest('[data-nav]');
            if (navTarget) switchPage(navTarget.dataset.nav);
        });

        // Config form
        document.getElementById('btn-start')?.addEventListener('click', startSimulation);
        document.getElementById('btn-reset')?.addEventListener('click', () => {
            applyDefaultInputs();
            updateDataPreview();
        });

        // Add data row button
        document.getElementById('btn-add-row')?.addEventListener('click', () => addDataRow());

        // Clear all data button
        document.getElementById('btn-clear-data')?.addEventListener('click', () => {
            const tbody = document.getElementById('data-rows');
            if (tbody && confirm('¿Estás seguro de que quieres eliminar todos los datos?')) {
                tbody.innerHTML = '';
                updateDataCount();
                updateDataPreview();
            }
        });

        // Table: live preview on data change + row deletion
        document.getElementById('data-rows')?.addEventListener('input', () => {
            updateDataCount();
            updateDataPreview();
        });
        document.getElementById('data-rows')?.addEventListener('click', e => {
            const delBtn = e.target.closest('.btn-del-row');
            if (delBtn) removeDataRow(delBtn);
        });

        // Live theta display (sin sliders)
        document.getElementById('input-m')?.addEventListener('input', updateThetaDisplay);
        document.getElementById('input-b')?.addEventListener('input', updateThetaDisplay);
        document.getElementById('input-lr')?.addEventListener('input', e => {
            updateLRHint(Number(e.target.value));
        });

        // Simulation controls
        document.getElementById('btn-next-step')?.addEventListener('click', () => {
            if (!simulationController) return;
            simulationController.nextStep();
            syncViewWithState();
        });
        document.getElementById('btn-prev-step')?.addEventListener('click', () => {
            if (!simulationController) return;
            simulationController.prevStep();
            syncViewWithState();
        });
        document.getElementById('btn-next-iteration')?.addEventListener('click', () => {
            if (!simulationController) return;
            simulationController.nextIteration();
            syncViewWithState();
        });
        document.getElementById('btn-prev-iteration')?.addEventListener('click', () => {
            if (!simulationController) return;
            simulationController.prevIteration();
            syncViewWithState();
        });
        document.getElementById('btn-run-all')?.addEventListener('click', () => {
            if (!simulationController) return;
            simulationController.runAllIterations();
            syncViewWithState();
        });

        // Chart toggles
        document.getElementById('toggle-lr-compare')?.addEventListener('change', () => {
            if (engine) {
                visualization.updateErrorChart(engine.history);
                visualization.highlightIteration(simulationController.currentIterationIndex);
            }
        });
        document.getElementById('toggle-error-chart')?.addEventListener('change', e => {
            document.getElementById('error-chart-card')?.classList.toggle('hidden', !e.target.checked);
        });
        document.getElementById('toggle-all-iterations')?.addEventListener('change', () => {
            if (engine) {
                visualization.updateAllIterationsChart(engine.xData, engine.yData, engine.history);
            }
        });

        // Chatbot
        document.getElementById('test-api-key')?.addEventListener('click', async () => {
            const key = document.getElementById('api-key-input')?.value.trim() || chatbot.apiKey;
            const resultEl = document.getElementById('test-api-result');
            if (!key) {
                resultEl.style.display = 'block';
                resultEl.style.background = '#fff3cd';
                resultEl.textContent = '⚠️ Primero pega tu API key en el campo de arriba.';
                return;
            }
            resultEl.style.display = 'block';
            resultEl.style.background = '#e8f4fd';
            resultEl.textContent = '🔄 Probando conexión...';
            const tests = [
                { version: 'v1',     model: 'gemini-2.0-flash' },
                { version: 'v1beta', model: 'gemini-2.5-flash' }
            ];
            for (const { version, model } of tests) {
                try {
                    const url = `https://generativelanguage.googleapis.com/${version}/models/${model}:generateContent?key=${encodeURIComponent(key)}`;
                    const res = await fetch(url, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: 'Hola' }] }] })
                    });
                    const data = await res.json();
                    if (res.ok) {
                        resultEl.style.background = '#d4edda';
                        resultEl.textContent = `✅ Conexión OK con ${version}/models/${model}`;
                        return;
                    } else {
                        resultEl.style.background = '#f8d7da';
                        resultEl.textContent = `❌ Error ${res.status} (${version}/${model}): ${data.error?.message || 'Clave inválida'}`;
                    }
                } catch {
                    resultEl.style.background = '#f8d7da';
                    resultEl.textContent = '❌ Sin conexión a internet o error de red.';
                }
            }
        });

        document.getElementById('save-api-key')?.addEventListener('click', () => {
            const provider = document.getElementById('provider-select')?.value || 'openai';
            const apiKey = document.getElementById('api-key-input')?.value.trim() || '';
            chatbot.setAPIKey(apiKey, provider);
            chatbot.appendMessage('assistant', apiKey
                ? `✅ Configuración guardada para ${provider}.`
                : '⚠️ Se eliminó la API key guardada.');
        });
        document.getElementById('chat-send')?.addEventListener('click', sendChatMessage);
        document.getElementById('chat-input')?.addEventListener('keydown', e => {
            if (e.key === 'Enter') { e.preventDefault(); sendChatMessage(); }
        });

        // Suggested questions
        document.querySelectorAll('.sq-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const question = btn.dataset.q;
                if (question) chatbot.sendMessage(question);
            });
        });
    }

    // ─── PAGE NAVIGATION ───
    function switchPage(pageName) {
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

        const targetPage = document.getElementById(`page-${pageName}`);
        if (targetPage) targetPage.classList.add('active');

        const targetNav = document.querySelector(`.nav-item[data-page="${pageName}"]`);
        if (targetNav) targetNav.classList.add('active');

        const titles = {
            dashboard: 'Inicio',
            datos: 'Configuración',
            simulation: 'Simulación',
            charts: 'Gráficas',
            education: 'Modo Educativo',
            chatbot: 'Asistente IA'
        };
        const titleEl = document.getElementById('topbar-title');
        if (titleEl) titleEl.textContent = titles[pageName] || pageName;
    }

    // ─── SIMULATION START ───
    function startSimulation() {
        hideConfigMessages();
        try {
            const parsed = parseInputs();
            currentConfig = parsed;
            engine = new LinearRegressionEngine(parsed.x, parsed.y, parsed.m, parsed.b, parsed.lr);
            engine.runNIterations(parsed.iterations);
            
            // Hacer engine global para acceso desde visualization
            window.engine = engine;
            
            simulationController = new SimulationController(engine);
            simulationController.renderCurrentStep();
            buildComparisonHistories();
            syncViewWithState();
            
            // Renderizar selector de iteraciones
            visualization.renderIterationSelector(engine.history);
            
            showConfigSuccess(`✅ Simulación iniciada: ${parsed.iterations} iteraciones con ${parsed.x.length} datos.`);
            updateDashboardStats();
            updateNavBadge(parsed.iterations);
        } catch (err) {
            showConfigError(err.message);
        }
    }

    function parseInputs() {
        const { x, y } = getTableData();
        const m = Number(document.getElementById('input-m')?.value);
        const b = Number(document.getElementById('input-b')?.value);
        const lr = Number(document.getElementById('input-lr')?.value);
        const iterations = Number(document.getElementById('input-iters')?.value);

        if (x.length < 2 || y.length < 2)
            throw new Error('Ingresa al menos dos pares de datos (X, Y).');
        if (x.length !== y.length)
            throw new Error('La cantidad de valores en X y Y debe coincidir.');
        if (![m, b, lr, iterations].every(Number.isFinite))
            throw new Error('Todos los parámetros deben ser números válidos.');
        if (!x.every(Number.isFinite) || !y.every(Number.isFinite))
            throw new Error('X e Y solo pueden contener números válidos.');
        if (lr <= 0) throw new Error('El learning rate debe ser mayor que cero.');
        if (!Number.isInteger(iterations) || iterations <= 0)
            throw new Error('El número de iteraciones debe ser un entero positivo.');

        return { x, y, m, b, lr, iterations };
    }

    function parseNumberSeries(raw) {
        return raw.split(/[\s,;]+/).map(v => v.trim()).filter(Boolean).map(Number);
    }

    // ─── SYNC VIEW ───
    function syncViewWithState() {
        if (!engine || !simulationController) return;
        const state = getDisplayState();
        const iter = engine.history[simulationController.currentIterationIndex];
        visualization.updateRegressionChart(engine.xData, engine.yData, iter.yHat, state.m, state.b, state.iterationNumber);
        visualization.updateAllIterationsChart(engine.xData, engine.yData, engine.history);
        visualization.updateErrorChart(engine.history);
        visualization.highlightIteration(simulationController.currentIterationIndex);
        updateTopbarParams(state);
        updateDashboardStats();
    }

    function getDisplayState() {
        const iter = engine.history[simulationController.currentIterationIndex];
        const isLastStep = simulationController.currentStepIndex === simulationController.steps.length - 1;
        return {
            iterationNumber: iter.iterationNumber,
            stepNumber: simulationController.currentStepIndex + 1,
            m: isLastStep ? iter.newM : iter.m_before,
            b: isLastStep ? iter.newB : iter.b_before,
            error: iter.mse
        };
    }

    function updateTopbarParams(state) {
        const fmt = v => Number(v).toFixed(3);
        const el = id => document.getElementById(id);

        el('current-m').textContent = fmt(state.m);
        el('current-b').textContent = fmt(state.b);
        el('current-error').textContent = fmt(state.error);
        const meta = el('current-iteration-meta');
        if (meta) meta.textContent = `It. ${state.iterationNumber} · Paso ${state.stepNumber}`;

        ['tp-m','tp-b','tp-mse'].forEach(id => {
            const el2 = document.getElementById(id);
            if (el2) el2.style.display = '';
        });
        if (meta) meta.style.display = '';
    }

    function updateDashboardStats() {
        if (!engine || engine.history.length === 0) return;
        const last = engine.history[engine.history.length - 1];
        const fmt = v => Number(v).toFixed(3);
        const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
        
        // Stats principales
        set('dash-m', fmt(last.newM));
        set('dash-b', fmt(last.newB));
        set('dash-mse', fmt(last.mse));
        set('dash-iters', engine.history.length);
        
        // Stats mini en hero
        set('dash-m-mini', fmt(last.newM));
        set('dash-b-mini', fmt(last.newB));
        set('dash-mse-mini', fmt(last.mse));
    }

    function updateNavBadge(count) {
        const badge = document.getElementById('nav-iter-badge');
        if (badge) { badge.textContent = count; badge.style.display = ''; }
    }

    // ─── DATA PREVIEW ───
    function updateDataPreview() {
        const { x: xVals, y: yVals } = getTableData();
        const container = document.getElementById('data-preview-table');
        if (!container) return;

        if (xVals.length === 0) {
            container.innerHTML = '<p class="muted-msg">Agrega datos para ver la vista previa.</p>';
            return;
        }

        const len = Math.max(xVals.length, yVals.length);
        let rows = '';
        for (let i = 0; i < len; i++) {
            const xi = xVals[i] !== undefined ? xVals[i] : '—';
            const yi = yVals[i] !== undefined ? yVals[i] : '—';
            rows += `<tr><td>${i + 1}</td><td>${xi}</td><td>${yi}</td></tr>`;
        }

        const mismatched = xVals.length !== yVals.length;
        container.innerHTML = `
            <div class="table-wrap" style="max-height:280px;overflow-y:auto">
                <table>
                    <thead><tr><th>Punto</th><th>X</th><th>y</th></tr></thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
            <p class="muted-msg" style="margin-top:10px">${len} par(es) de datos ${mismatched ? '⚠️ X e Y tienen diferente cantidad' : '✅ válidos'}</p>`;
    }

    // ─── COMPARISON HISTORIES ───
    function buildComparisonHistories() {
        if (!currentConfig) { visualization.comparisonHistories = []; return; }
        const variants = [
            { factor: 0.5, color: '#0ea5e9', label: `α/2 = ${currentConfig.lr / 2}` },
            { factor: 2,   color: '#f97316', label: `α×2 = ${currentConfig.lr * 2}` }
        ];
        visualization.comparisonHistories = variants.map(v => {
            const e2 = new LinearRegressionEngine(
                currentConfig.x, currentConfig.y,
                currentConfig.m, currentConfig.b,
                currentConfig.lr * v.factor
            );
            e2.runNIterations(currentConfig.iterations);
            return { label: v.label, color: v.color, history: e2.history };
        });
    }

    // ─── CHATBOT ───
    function sendChatMessage() {
        const input = document.getElementById('chat-input');
        if (!input) return;
        const msg = input.value.trim();
        if (!msg) return;
        input.value = '';
        chatbot.sendMessage(msg);
    }

    function hydrateChatbotSettings() {
        const apiInput = document.getElementById('api-key-input');
        const providerSelect = document.getElementById('provider-select');
        if (apiInput) apiInput.value = chatbot.apiKey;
        if (providerSelect) providerSelect.value = chatbot.provider;
    }

    // ─── HELPERS ───
    function applyDefaultInputs() {
        const tbody = document.getElementById('data-rows');
        if (tbody) tbody.innerHTML = '';
        defaultConfig.x.forEach((xi, i) => addDataRow(xi, defaultConfig.y[i]));

        document.getElementById('input-m').value = String(defaultConfig.m);
        document.getElementById('input-b').value = String(defaultConfig.b);
        document.getElementById('input-lr').value = String(defaultConfig.lr);
        document.getElementById('input-iters').value = String(defaultConfig.iterations);

        updateLRHint(defaultConfig.lr);
        updateDataCount();
    }

    function showConfigError(msg) {
        const el = document.getElementById('config-error');
        if (el) { el.textContent = msg; el.classList.remove('hidden'); }
        document.getElementById('config-success')?.classList.add('hidden');
    }

    // ─── TABLE HELPERS ───
    function addDataRow(x = '', y = '') {
        const tbody = document.getElementById('data-rows');
        if (!tbody) return;
        const rowNum = tbody.rows.length + 1;
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><span class="row-num-pill">${rowNum}</span></td>
            <td><input class="cell-input" type="number" step="any" placeholder="0" value="${x}"></td>
            <td><input class="cell-input" type="number" step="any" placeholder="0" value="${y}"></td>
            <td><button class="btn-del-row" type="button" title="Eliminar fila">×</button></td>`;
        tbody.appendChild(tr);
        updateDataCount();
        updateDataPreview();
    }

    function removeDataRow(btn) {
        btn.closest('tr').remove();
        const tbody = document.getElementById('data-rows');
        if (tbody) [...tbody.rows].forEach((tr, i) => {
            const pill = tr.querySelector('.row-num-pill');
            if (pill) pill.textContent = i + 1;
        });
        updateDataCount();
        updateDataPreview();
    }

    function getTableData() {
        const tbody = document.getElementById('data-rows');
        if (!tbody) return { x: [], y: [] };
        const x = [], y = [];
        [...tbody.rows].forEach(tr => {
            const inputs = tr.querySelectorAll('.cell-input');
            if (inputs.length >= 2) {
                x.push(Number(inputs[0].value));
                y.push(Number(inputs[1].value));
            }
        });
        return { x, y };
    }

    function updateDataCount() {
        const tbody = document.getElementById('data-rows');
        const badge = document.getElementById('data-count');
        if (badge) badge.textContent = `${tbody?.rows.length ?? 0} pares`;
    }

    function updateThetaDisplay() {
        const m = Number(document.getElementById('input-m')?.value) || 0;
        const b = Number(document.getElementById('input-b')?.value) || 0;
        const fmt = v => v.toFixed(6);
        const elB = document.getElementById('theta-b');
        const elM = document.getElementById('theta-m');
        if (elB) elB.textContent = fmt(b);
        if (elM) elM.textContent = fmt(m);
    }

    function updateLRHint(lr) {
        const hint = document.getElementById('lr-hint');
        if (lr <= 0) {
            hint.textContent = '❌ El learning rate debe ser mayor que 0';
            hint.className = 'lr-hint lr-danger';
        } else if (lr < 0.0001) {
            hint.textContent = '🐌 Muy bajo — aprendizaje muy lento';
            hint.className = 'lr-hint lr-warn';
        } else if (lr <= 0.01) {
            hint.textContent = '✅ Rango recomendado (0.001 – 0.01)';
            hint.className = 'lr-hint lr-ok';
        } else if (lr <= 0.1) {
            hint.textContent = '⚠️ Alto — puede ser inestable';
            hint.className = 'lr-hint lr-warn';
        } else {
            hint.textContent = '🔥 Muy alto — riesgo de divergencia';
            hint.className = 'lr-hint lr-danger';
        }
    }

    function showConfigSuccess(msg) {
        const el = document.getElementById('config-success');
        if (el) { el.textContent = msg; el.classList.remove('hidden'); }
        document.getElementById('config-error')?.classList.add('hidden');
    }

    function hideConfigMessages() {
        document.getElementById('config-error')?.classList.add('hidden');
        document.getElementById('config-success')?.classList.add('hidden');
    }
});
