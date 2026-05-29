class ChatbotController {
    constructor() {
        this.storageKey = 'lr-simulator-chatbot-settings';
        const savedSettings = this.loadSettings();
        this.apiKey = savedSettings.apiKey || '';
        this.provider = savedSettings.provider || 'gemini';
        this.messages = [];
        this.systemPrompt = `Eres un asistente educativo especializado en Machine Learning, específicamente en regresión lineal simple y descenso por gradiente.

Tu objetivo es ayudar a estudiantes universitarios a comprender:
- Regresión lineal simple (y = mx + b)
- Descenso por gradiente
- Error cuadrático medio (MSE)
- Gradientes y derivadas parciales
- Learning rate (α) y su impacto
- Convergencia de modelos

Reglas de formato OBLIGATORIAS:
- Responde SIEMPRE en máximo 3 párrafos cortos
- Cada párrafo debe tener máximo 3 oraciones
- Usa negritas para conceptos clave
- Incluye fórmulas solo si son esenciales
- Responde en español
- Nunca escribas respuestas largas ni listas extensas

Si te preguntan sobre el simulador, explica brevemente cómo funciona.`;
    }

    togglePanel() {
        const panel = document.getElementById('chatbot-panel');
        if (!panel) {
            return;
        }

        panel.classList.toggle('open');
    }

    setAPIKey(key, provider) {
        this.apiKey = key;
        this.provider = provider;
        localStorage.setItem(this.storageKey, JSON.stringify({ apiKey: key, provider }));
    }

    async sendMessage(userMessage) {
        const trimmedMessage = String(userMessage || '').trim();
        if (!trimmedMessage) {
            return;
        }

        if (!this.apiKey) {
            this.appendMessage('assistant', '⚠️ Primero necesitas configurar tu API key. Ve a la sección de configuración y pega tu clave de Gemini (es gratis). Obtén tu clave aquí: https://aistudio.google.com/app/apikey');
            return;
        }

        this.appendMessage('user', trimmedMessage);
        this.messages.push({ role: 'user', content: trimmedMessage });
        this.showTypingIndicator();

        try {
            const responseText = this.provider === 'gemini'
                ? await this.callGemini(trimmedMessage)
                : await this.callOpenAI(trimmedMessage);

            this.messages.push({ role: 'assistant', content: responseText });
            this.appendMessage('assistant', responseText);
        } catch (error) {
            console.error('Error en chatbot:', error);
            this.appendMessage('assistant', `❌ Error: ${error.message}\n\nVerifica que tu API key sea correcta y que tengas conexión a internet.`);
        } finally {
            this.hideTypingIndicator();
        }
    }

    async callOpenAI(message) {
        void message;
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${this.apiKey}`
            },
            body: JSON.stringify({
                model: 'gpt-3.5-turbo',
                messages: [
                    { role: 'system', content: this.systemPrompt },
                    ...this.messages.map((message) => ({
                        role: message.role,
                        content: message.content
                    }))
                ],
                temperature: 0.7,
                max_tokens: 800
            })
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error?.message || 'Error al consultar OpenAI.');
        }

        return data.choices?.[0]?.message?.content?.trim() || 'No recibí respuesta del modelo.';
    }

    async callGemini(message) {
        void message;

        // Combina versiones de API y modelos: v1 primero (más estable), luego v1beta
        const endpointsToTry = [
            { version: 'v1',     model: 'gemini-2.0-flash' },
            { version: 'v1',     model: 'gemini-1.5-flash' },
            { version: 'v1beta', model: 'gemini-2.5-flash' },
            { version: 'v1beta', model: 'gemini-2.0-flash' },
            { version: 'v1beta', model: 'gemini-1.5-flash' }
        ];

        let lastError = null;

        for (const { version, model } of endpointsToTry) {
            try {
                const url = `https://generativelanguage.googleapis.com/${version}/models/${model}:generateContent?key=${encodeURIComponent(this.apiKey)}`;

                const response = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        system_instruction: {
                            parts: [{ text: this.systemPrompt }]
                        },
                        contents: this.messages.map((entry) => ({
                            role: entry.role === 'user' ? 'user' : 'model',
                            parts: [{ text: entry.content }]
                        })),
                        generationConfig: {
                            temperature: 0.7,
                            maxOutputTokens: 800
                        }
                    })
                });

                const data = await response.json();

                if (response.ok) {
                    const text = data.candidates?.[0]?.content?.parts?.map((part) => part.text).join(' ').trim();
                    if (text) {
                        console.log(`✅ Usando ${version}/models/${model}`);
                        return text;
                    }
                } else {
                    const errorMsg = data.error?.message || 'Error desconocido';
                    console.log(`❌ ${version}/${model} falló (${response.status}):`, errorMsg);

                    if (response.status === 400 && errorMsg.toLowerCase().includes('api key')) {
                        throw new Error(`API Key no válida (400): ${errorMsg}\n\n👉 Solución: Ve a https://aistudio.google.com/app/apikey → elimina la clave actual → crea una NUEVA con "Create API key in new project"`);
                    }
                    if (response.status === 403) {
                        throw new Error(`Sin permiso (403): ${errorMsg}\n\n👉 Ve a https://aistudio.google.com/app/apikey → crea una NUEVA clave`);
                    }
                    if (response.status === 429) {
                        throw new Error(`Límite de solicitudes (429). Espera un momento e intenta de nuevo.`);
                    }

                    lastError = new Error(`${version}/${model} (${response.status}): ${errorMsg}`);
                }
            } catch (error) {
                if (error.message.includes('(400)') || error.message.includes('(403)') || error.message.includes('(429)')) {
                    throw error;
                }
                lastError = error;
                console.log(`${version}/${model} no disponible, probando siguiente...`);
            }
        }

        throw lastError || new Error('No se pudo conectar con ningún modelo de Gemini. Verifica tu API key y conexión a internet.');
    }

    renderMarkdown(text) {
        // Cerrar negritas/cursivas incompletas al final del texto (respuestas cortadas)
        const openBold = (text.match(/\*\*/g) || []).length;
        if (openBold % 2 !== 0) text = text + '**';
        const openItalic = (text.match(/(?<!\*)\*(?!\*)/g) || []).length;
        if (openItalic % 2 !== 0) text = text + '*';

        // Escapar HTML para evitar XSS
        let html = text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');

        // Bloques de código (``` ... ```)
        html = html.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
        // Código inline (`...`)
        html = html.replace(/`([^`]+)`/g, '<code class="formula">$1</code>');
        // Negritas (**texto**) — permite espacios dentro
        html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
        // Cursiva (*texto*) — solo si no es parte de **
        html = html.replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, '<em>$1</em>');

        // Procesar línea por línea para listas y saltos
        const lines = html.split('\n');
        const result = [];
        let inList = false;

        for (const line of lines) {
            const trimmed = line.trim();
            if (/^[-•]\s+/.test(trimmed) || /^\d+\.\s+/.test(trimmed)) {
                if (!inList) { result.push('<ul>'); inList = true; }
                result.push(`<li>${trimmed.replace(/^[-•\d.]+\s+/, '')}</li>`);
            } else {
                if (inList) { result.push('</ul>'); inList = false; }
                if (/[=∂αΣβ∇]/.test(trimmed) && trimmed.length < 120 && !trimmed.startsWith('<')) {
                    result.push(`<code class="formula">${trimmed}</code>`);
                } else if (trimmed === '') {
                    result.push('<br>');
                } else {
                    result.push(trimmed);
                }
            }
        }
        if (inList) result.push('</ul>');

        return result.join('<br>').replace(/<br><ul>/g, '<ul>').replace(/<\/ul><br>/g, '</ul>');
    }

    appendMessage(role, text) {
        const container = document.getElementById('chat-messages');
        if (!container) {
            return;
        }

        const row = document.createElement('div');
        row.className = `msg-row ${role}`;

        const avatar = document.createElement('div');
        avatar.className = 'msg-avatar';
        avatar.textContent = role === 'user' ? '👤' : '🤖';

        const bubble = document.createElement('div');
        bubble.className = 'msg-bubble';
        bubble.innerHTML = role === 'assistant' ? this.renderMarkdown(text) : text
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

        row.appendChild(avatar);
        row.appendChild(bubble);
        container.appendChild(row);
        container.scrollTop = container.scrollHeight;
    }

    showTypingIndicator() {
        const container = document.getElementById('chat-messages');
        if (!container || document.getElementById('chat-typing')) {
            return;
        }

        const row = document.createElement('div');
        row.id = 'chat-typing';
        row.className = 'msg-row assistant typing';

        const avatar = document.createElement('div');
        avatar.className = 'msg-avatar';
        avatar.textContent = '🤖';

        const bubble = document.createElement('div');
        bubble.className = 'msg-bubble typing-bubble';
        bubble.innerHTML = '<span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span>';

        row.appendChild(avatar);
        row.appendChild(bubble);
        container.appendChild(row);
        container.scrollTop = container.scrollHeight;
    }

    hideTypingIndicator() {
        const indicator = document.getElementById('chat-typing');
        if (indicator) {
            indicator.remove();
        }
    }

    loadSettings() {
        try {
            return JSON.parse(localStorage.getItem(this.storageKey) || '{}');
        } catch (error) {
            return {};
        }
    }
}

window.ChatbotController = ChatbotController;