class ChatbotController {
    constructor() {
        this.storageKey = 'lr-simulator-chatbot-settings';
        const savedSettings = this.loadSettings();
        this.apiKey = savedSettings.apiKey || '';
        this.provider = savedSettings.provider || 'openai';
        this.messages = [];
        this.systemPrompt = 'Eres un asistente educativo especializado en Machine Learning, regresión lineal simple y descenso por gradiente. Explica los conceptos de forma clara y simple para estudiantes universitarios. Usa ejemplos cuando sea útil.';
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
            this.appendMessage('assistant', 'Primero guarda una API key válida para OpenAI o Gemini.');
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
            this.appendMessage('assistant', `No pude completar la consulta: ${error.message}`);
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
                temperature: 0.7
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
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${encodeURIComponent(this.apiKey)}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: [
                    {
                        role: 'user',
                        parts: [{ text: `Contexto del sistema: ${this.systemPrompt}` }]
                    },
                    ...this.messages.map((entry) => ({
                        role: entry.role === 'assistant' ? 'model' : 'user',
                        parts: [{ text: entry.content }]
                    }))
                ],
                generationConfig: {
                    temperature: 0.7,
                    maxOutputTokens: 600
                }
            })
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error?.message || 'Error al consultar Gemini.');
        }

        return data.candidates?.[0]?.content?.parts?.map((part) => part.text).join(' ').trim() || 'No recibí respuesta del modelo.';
    }

    appendMessage(role, text) {
        const container = document.getElementById('chat-messages');
        if (!container) {
            return;
        }

        const row = document.createElement('div');
        row.className = `message-row ${role}`;

        const bubble = document.createElement('div');
        bubble.className = 'message-bubble';
        bubble.textContent = text;

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
        row.className = 'message-row assistant typing';

        const bubble = document.createElement('div');
        bubble.className = 'message-bubble';
        bubble.textContent = 'Escribiendo respuesta...';

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