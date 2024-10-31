<script setup lang="ts">
import { ref, computed } from 'vue'
import ChatBox from './components/ChatBox.vue'
import NetworkGraph from './components/NetworkGraph.vue'
import type { CBN, Node, Edge } from './types/cbn'
import LLMService from './lib/llm'

interface DialogueState {
  currentFocus: 'nodes' | 'edges' | 'probabilities' | null;
  selectedNode: string | null;
  selectedEdge: string | null;
}

const dialogueState = ref<DialogueState>({
  currentFocus: null,
  selectedNode: null,
  selectedEdge: null
})

// Initial CBN state from NOTES.md
const initialCBN: CBN = {
  nodes: [
    { id: '1', name: 'Local Support', states: ['Weak', 'Strong'], category: 'Social' },
    { id: '2', name: 'Restoration Investment', states: ['Limited', 'Adequate'], category: 'Management' },
    { id: '3', name: 'Water Quality', states: ['Poor', 'Good'], category: 'Environmental' },
    { id: '4', name: 'Seagrass Biomass', states: ['Low', 'Medium', 'High'], category: 'Environmental' },
    { id: '5', name: 'Carbon Sequestration', states: ['Low', 'High'], category: 'Environmental' },
    { id: '6', name: 'Light Availability', states: ['Limited', 'Optimal'], category: 'Environmental' },
    { id: '7', name: 'Sediment Conditions', states: ['Poor', 'Good'], category: 'Environmental' },
    { id: '8', name: 'Carbon Credits', states: ['Unavailable', 'Available'], category: 'Economic' },
    { id: '9', name: 'Economic Benefits', states: ['Low', 'Medium', 'High'], category: 'Economic' }
  ],
  edges: [
    { id: 'e1', from: '1', to: '2' },
    { id: 'e2', from: '2', to: '3' },
    { id: 'e3', from: '3', to: '4' },
    { id: 'e4', from: '4', to: '5' },
    { id: 'e5', from: '3', to: '6' },
    { id: 'e6', from: '6', to: '4' },
    { id: 'e7', from: '7', to: '4' },
    { id: 'e8', from: '5', to: '8' },
    { id: 'e9', from: '8', to: '9' },
    { id: 'e10', from: '9', to: '1' }
  ],
  cpds: {} // To be implemented
}

const cbn = ref<CBN>(initialCBN)
const messages = ref([
  {
    text: 'Welcome to the Seagrass CBN Builder! How can I help you explore and refine the causal network?',
    sender: 'bot'
  }
])

const llmService = new LLMService({
  apiKey: import.meta.env.VITE_OPENROUTER_API_KEY,
  model: import.meta.env.VITE_AI_MODEL || 'openrouter/qwen/qwen-2.5-72b-instruct',
  baseUrl: 'https://openrouter.ai/api/v1/chat/completions'
})

const handleSendMessage = async (message: string) => {
  messages.value.push({ text: message, sender: 'user' });

  // Show loading state
  const loadingMessage = { text: 'Processing...', sender: 'bot' };
  messages.value.push(loadingMessage);

  try {
    const response = await llmService.processUserInput(cbn.value, message);

    // Find and remove the loading message
    const loadingIndex = messages.value.findIndex(msg => msg === loadingMessage);
    if (loadingIndex !== -1) {
      messages.value.splice(loadingIndex, 1);
    }

    // Always show the first suggestion as it contains the main explanation
    if (response.tentative_suggestions.length > 0) {
      messages.value.push({
        text: response.tentative_suggestions[0],
        sender: 'bot'
      });
    }

    // Show additional suggestions if any
    if (response.tentative_suggestions.length > 1) {
      messages.value.push({
        text: 'Additional insights:\n' + response.tentative_suggestions.slice(1).join('\n'),
        sender: 'bot'
      });
    }

    // Show reflection prompts if any
    if (response.reflection_prompts.length > 0) {
      messages.value.push({
        text: 'Consider these aspects:\n• ' + response.reflection_prompts.join('\n• '),
        sender: 'bot'
      });
    }
  } catch (error) {
    console.error('Chat Error:', error);

    // Find and remove the loading message
    const loadingIndex = messages.value.findIndex(msg => msg === loadingMessage);
    if (loadingIndex !== -1) {
      messages.value.splice(loadingIndex, 1);
    }

    messages.value.push({
      text: 'I understand you\'re asking about the relationship between Water Quality and Seagrass Biomass. Water Quality directly affects seagrass growth and survival through light availability and nutrient levels. Would you like to explore specific aspects of this relationship?',
      sender: 'bot'
    });
  }
}

// Helper function to compare networks and identify changes
const compareNetworks = (oldCBN: CBN, newCBN: CBN): string[] => {
  const changes: string[] = [];

  // Check for new or modified nodes
  newCBN.nodes.forEach(newNode => {
    const oldNode = oldCBN.nodes.find(n => n.id === newNode.id);
    if (!oldNode) {
      changes.push(`Added new node: ${newNode.name}`);
    } else if (JSON.stringify(oldNode) !== JSON.stringify(newNode)) {
      changes.push(`Updated node: ${newNode.name}`);
    }
  });

  // Check for new or modified edges
  newCBN.edges.forEach(newEdge => {
    const oldEdge = oldCBN.edges.find(e => e.id === newEdge.id);
    if (!oldEdge) {
      const fromNode = newCBN.nodes.find(n => n.id === newEdge.from)?.name;
      const toNode = newCBN.nodes.find(n => n.id === newEdge.to)?.name;
      changes.push(`Added new relationship: ${fromNode} → ${toNode}`);
    } else if (JSON.stringify(oldEdge) !== JSON.stringify(newEdge)) {
      changes.push(`Updated relationship probabilities`);
    }
  });

  return changes;
}

const handleNodeClick = (nodeId: string) => {
  const node = cbn.value.nodes.find(n => n.id === nodeId)
  if (node) {
    messages.value.push({
      text: `Selected node: ${node.name}\nStates: ${node.states.join(', ')}`,
      sender: 'bot'
    })
  }
}

const handleEdgeClick = (edgeId: string) => {
  const edge = cbn.value.edges.find(e => e.id === edgeId)
  if (edge) {
    const fromNode = cbn.value.nodes.find(n => n.id === edge.from)
    const toNode = cbn.value.nodes.find(n => n.id === edge.to)
    messages.value.push({
      text: `Selected relationship: ${fromNode?.name} → ${toNode?.name}`,
      sender: 'bot'
    })
  }
}
</script>

<template>
  <div class="app-container">
    <div class="chat-section">
      <ChatBox :messages="messages" @send-message="handleSendMessage" />
    </div>
    <div class="graph-section">
      <NetworkGraph :nodes="cbn.nodes" :edges="cbn.edges" :edit-mode="true" :hierarchical-layout="false"
        @node-click="handleNodeClick" @edge-click="handleEdgeClick" />
    </div>
  </div>
</template>

<style scoped>
.app-container {
  display: flex;
  height: 100vh;
  width: 100vw;
  overflow: hidden;
}

.chat-section {
  flex: 1;
  border-right: 1px solid var(--color-border);
  max-width: 400px;
  overflow-y: auto;
}

.graph-section {
  flex: 2;
  background: var(--color-background-soft);
  overflow: hidden;
}
</style>
