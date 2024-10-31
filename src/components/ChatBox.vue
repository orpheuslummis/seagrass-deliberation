<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'

const props = defineProps<{
    messages: Array<{ text: string, sender: string }>
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
</script>

<template>
    <div class="chat-container">
        <div class="messages">
            <div v-for="(message, index) in messages" :key="index" :class="['message', message.sender]">
                {{ message.text }}
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
</style>