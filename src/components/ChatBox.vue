<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'

// Add structured message types
interface Message {
    text: string;
    sender: 'user' | 'bot';
    type?: 'suggestion' | 'analysis' | 'question' | 'error';
    metadata?: {
        nodeId?: string;
        edgeId?: string;
        confidence?: number;
        references?: string[];
    };
}

const props = defineProps<{
    messages: Array<Message>,
    isLoading?: boolean,
    currentContext?: {
        selectedNode?: string;
        selectedEdge?: string;
        focusArea?: 'probability' | 'structure' | 'validation'
    }
}>()

const emit = defineEmits<{
    (e: 'send-message', message: string): void
}>()

const newMessage = ref('')

const sendMessage = () => {
    if (newMessage.value.trim()) {
        emit('send-message', newMessage.value)
        newMessage.value = ''
    }
}

const autoResize = (event: Event) => {
    const textarea = event.target as HTMLTextAreaElement
    textarea.style.height = 'auto'
    const newHeight = Math.min(textarea.scrollHeight, 150) // 150px max height
    textarea.style.height = newHeight + 'px'
}

watch(newMessage, () => {
    nextTick(() => {
        const textarea = document.querySelector('.input-area textarea') as HTMLTextAreaElement
        if (textarea) {
            const event = new Event('input') as Event & { target: HTMLTextAreaElement }
            Object.defineProperty(event, 'target', { value: textarea })
            autoResize(event)
        }
    })
})

const suggestions = ref([
    "Tell me about the relationship between Water Quality and Seagrass Biomass",
    "What factors influence Local Support?",
    "Update the probability of Restoration Investment affecting Water Quality"
])

const formatBotMessage = (message: Message) => {
    if (message.type === 'error') {
        return `<div class="error-message">${message.text}</div>`;
    }

    // Split into sections and format based on message type
    const sections = message.text.split('\n\n').filter(p => p.trim());

    return sections.map(section => {
        // Format suggestions with checkboxes
        if (section.includes('•') && message.type === 'suggestion') {
            return `<div class="suggestion-list">
                ${section.split('\n').map(line => {
                if (line.includes('•')) {
                    return `<label class="suggestion-item">
                            <input type="checkbox">
                            <span>${line.replace('•', '').trim()}</span>
                        </label>`;
                }
                return `<p>${line.trim()}</p>`;
            }).join('')}
            </div>`;
        }

        // Format analysis with highlights
        if (message.type === 'analysis') {
            return `<div class="analysis-section">
                ${section.includes(':')
                    ? `<h4>${section.split(':')[0]}</h4>
                       <p>${section.split(':')[1].trim()}</p>`
                    : `<p>${section}</p>`}
            </div>`;
        }

        // Format questions to encourage interaction
        if (message.type === 'question') {
            return `<div class="reflection-question">
                <span class="question-icon">?</span>
                <p>${section}</p>
            </div>`;
        }

        return `<p>${section}</p>`;
    }).join('');
}
</script>

<template>
    <div class="chat-container">
        <div class="messages">
            <div v-for="(message, index) in messages" :key="index" :class="['message', message.sender]">
                <template v-if="message.sender === 'bot'">
                    <div class="message-content" v-html="formatBotMessage(message)"></div>
                </template>
                <template v-else>
                    {{ message.text }}
                </template>
            </div>
            <div v-if="isLoading" class="message bot loading">
                <div class="dot-typing"></div>
            </div>
        </div>
        <div class="input-area">
            <textarea v-model="newMessage" @keyup.enter.exact="sendMessage" @keydown.enter.exact.prevent
                placeholder="Type your message..." rows="1"></textarea>
            <button @click="sendMessage">Send</button>
        </div>
        <div class="suggestions">
            <button v-for="(suggestion, index) in suggestions" :key="index" class="suggestion-btn"
                @click="newMessage = suggestion">
                {{ suggestion }}
            </button>
        </div>
    </div>
</template>

<style scoped>
.chat-container {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--color-background);
    border-radius: 12px;
    border: 1px solid var(--color-border);
    box-shadow: var(--shadow-md);
}

.messages {
    flex: 1;
    overflow-y: auto;
    padding: 1.5rem;
    scroll-behavior: smooth;
}

.message {
    margin: 0.75rem 0;
    padding: 0.75rem 1rem;
    border-radius: 12px;
    max-width: 80%;
    line-height: 1.5;
    box-shadow: var(--shadow-sm);
    animation: fadeIn 0.3s ease-in-out;
}

.message.bot {
    background: var(--color-background-soft);
    align-self: flex-start;
    border-bottom-left-radius: 4px;
}

.message.user {
    background: var(--gradient-blue);
    color: white;
    align-self: flex-end;
    border-bottom-right-radius: 4px;
}

.input-area {
    padding: 1rem;
    border-top: 1px solid var(--color-border);
    display: flex;
    gap: 0.75rem;
    align-items: flex-end;
}

.input-area textarea {
    flex: 1;
    padding: 0.75rem 1rem;
    border-radius: 8px;
    border: 1px solid var(--color-border);
    background: var(--color-background-soft);
    color: var(--color-text);
    font-size: 0.95rem;
    transition: all 0.2s ease;
    resize: none;
    min-height: 44px;
    max-height: 150px;
    line-height: 1.5;
    font-family: inherit;
    overflow: hidden;
    display: block;
}

.input-area textarea:focus {
    outline: none;
    border-color: var(--color-primary-light);
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
}

.input-area button {
    padding: 0.75rem 1.5rem;
    border-radius: 8px;
    border: none;
    background: var(--gradient-blue);
    color: white;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
}

.input-area button:hover {
    opacity: 0.9;
    transform: translateY(-1px);
}

@keyframes fadeIn {
    from {
        opacity: 0;
        transform: translateY(8px);
    }

    to {
        opacity: 1;
        transform: translateY(0);
    }
}

/* Custom scrollbar */
.messages::-webkit-scrollbar {
    width: 6px;
}

.messages::-webkit-scrollbar-track {
    background: transparent;
}

.messages::-webkit-scrollbar-thumb {
    background: var(--color-border);
    border-radius: 3px;
}

.messages::-webkit-scrollbar-thumb:hover {
    background: var(--color-primary-light);
}

.suggestions {
    padding: 0.75rem 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    border-top: 1px solid var(--color-border);
}

.suggestion-btn {
    text-align: left;
    padding: 0.5rem 0.75rem;
    border-radius: 6px;
    border: 1px solid var(--color-border);
    background: var(--color-background-soft);
    color: var(--color-text);
    font-size: 0.9rem;
    cursor: pointer;
    transition: all 0.2s ease;
}

.suggestion-btn:hover {
    background: var(--color-background-mute);
    border-color: var(--color-primary-light);
}

/* Add loading animation styles */
.loading {
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 60px;
    padding: 1rem !important;
}

.dot-typing {
    position: relative;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background-color: var(--color-text);
    animation: dot-typing 1s infinite linear;
}

.dot-typing::before,
.dot-typing::after {
    content: '';
    position: absolute;
    top: 0;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background-color: var(--color-text);
    animation: dot-typing 1s infinite linear;
}

.dot-typing::before {
    left: -12px;
    animation-delay: -0.32s;
}

.dot-typing::after {
    left: 12px;
    animation-delay: -0.16s;
}

@keyframes dot-typing {

    0%,
    60%,
    100% {
        transform: translateY(0);
    }

    30% {
        transform: translateY(-4px);
    }
}

.message-content {
    white-space: pre-wrap;
}

.message-bullets {
    margin-top: 0.5rem;
    margin-left: 1.5rem;
}

.message-bullets li {
    margin-bottom: 0.25rem;
}

.message-section {
    margin-bottom: 0.75rem;
}

.message-section:last-child {
    margin-bottom: 0;
}

.message-section p {
    margin-bottom: 0.5rem;
}

.message-bullets {
    margin: 0.5rem 0 0 1.5rem;
    list-style-type: disc;
}

.message-bullets li {
    margin-bottom: 0.25rem;
}

.message-bullets li:last-child {
    margin-bottom: 0;
}

/* Add to existing styles */
.suggestion-list {
    background: var(--color-background-soft);
    padding: 0.75rem;
    border-radius: 8px;
    margin: 0.5rem 0;
}

.suggestion-item {
    display: flex;
    align-items: flex-start;
    gap: 0.5rem;
    margin: 0.5rem 0;
    cursor: pointer;
}

.analysis-section {
    border-left: 3px solid var(--color-primary);
    padding-left: 1rem;
    margin: 0.75rem 0;
}

.reflection-question {
    display: flex;
    gap: 0.75rem;
    align-items: flex-start;
    background: rgba(37, 99, 235, 0.1);
    padding: 0.75rem;
    border-radius: 8px;
    margin: 0.5rem 0;
}

.question-icon {
    background: var(--color-primary);
    color: white;
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    font-weight: bold;
}

.error-message {
    color: #ef4444;
    background: rgba(239, 68, 68, 0.1);
    padding: 0.75rem;
    border-radius: 8px;
    margin: 0.5rem 0;
}
</style>