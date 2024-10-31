<script setup lang="ts">
import { onMounted, watch, ref, onUnmounted, computed } from 'vue'
import { Network } from 'vis-network'
import { DataSet } from 'vis-data'
import type { Node, Edge, CBN } from '../types/cbn'
import type { IdType, NodeChosenNodeFunction, NodeChosenLabelFunction } from 'vis-network'
import type { DataInterfaceNodes, DataInterfaceEdges, Data } from 'vis-network'
import type { Options } from 'vis-network'
import { useColorScale } from '../composables/useColorScale'

const props = defineProps<{
    nodes: Node[]
    edges: Edge[]
    editMode?: boolean
    selectedNodeId?: string | null
    selectedEdgeId?: string | null
}>()

const emit = defineEmits<{
    (e: 'node-click', nodeId: string): void
    (e: 'edge-click', edgeId: string): void
    (e: 'node-update', node: Node): void
    (e: 'edge-update', edge: Edge): void
}>()

const network = ref<Network | null>(null)

const nodePositions = ref(new Map<string, { x: number, y: number }>())

const container = ref<HTMLElement | null>(null)

const { getColorForCategory } = useColorScale()

const initNetwork = () => {
    if (!container.value) return

    const formatProbabilities = (edge: Edge) => {
        if (!edge.probability) return ''
        if (typeof edge.probability === 'object') {
            return Object.entries(edge.probability)
                .map(([fromState, toStates]) =>
                    Object.entries(toStates)
                        .map(([toState, prob]) =>
                            `P(${toState}|${fromState}) = ${prob.toFixed(2)}`)
                        .join('\n')
                ).join('\n')
        }
        return `P(${edge.probability.toFixed(2)})`
    }

    const savePositions = () => {
        if (!network.value) return
        const positions = network.value.getPositions()
        Object.entries(positions).forEach(([id, pos]) => {
            nodePositions.value.set(id, pos)
        })
    }

    const setupEvents = () => {
        if (!network.value) return

        network.value.on('click', (params) => {
            if (params.nodes.length > 0) {
                emit('node-click', params.nodes[0])
            } else if (params.edges.length > 0) {
                emit('edge-click', params.edges[0])
            }
        })

        network.value.on('stabilized', () => {
            savePositions()
        })

        network.value.on('doubleClick', (params) => {
            if (params.nodes.length > 0 && props.editMode) {
                handleNodeDblClick(params.nodes[0])
            }
        })
    }

    const formatNodeLabel = (node: Node) => {
        const statesList = node.states.map(state => {
            const probability = node.probabilities?.[state]
            return `${state}: ${probability !== undefined ? probability.toFixed(2) : 'N/A'}`
        }).join('\n')

        const isSelected = node.id === props.selectedNodeId
        const label = `<b>${node.name}</b>\n<i>${node.category}</i>\n${statesList}`
        return isSelected ? `<div style="border: 3px solid var(--color-primary)">${label}</div>` : label
    }

    const formatEdgeLabel = (edge: Edge) => {
        if (!edge.probability) return '';

        if (typeof edge.probability === 'object') {
            return 'CPT';
        }

        return `P: ${edge.probability.toFixed(2)}`;
    }

    const nodes: DataInterfaceNodes = new DataSet(
        props.nodes.map(node => ({
            id: node.id,
            label: formatNodeLabel(node),
            title: `${node.name}\n${node.category}\n\nStates & Probabilities:\n${node.states.map(state => {
                const prob = node.probabilities?.[state]
                return `${state}: ${prob !== undefined ? prob.toFixed(2) : 'N/A'}`
            }).join('\n')}${node.description ? '\n\nDescription:\n' + node.description : ''}`,
            shape: 'box',
            color: {
                background: getColorForCategory(node.category),
                border: '#3b82f6',
                highlight: {
                    background: getColorForCategory(node.category),
                    border: '#60a5fa',
                },
                hover: {
                    background: getColorForCategory(node.category),
                    border: '#60a5fa',
                }
            },
            font: {
                color: '#ffffff',
                size: 14,
                face: 'system-ui',
                multi: true,
                bold: {
                    color: '#ffffff',
                    size: 16,
                    face: 'system-ui'
                }
            },
            widthConstraint: {
                minimum: 200,
                maximum: 250
            },
            margin: {
                top: 10,
                right: 10,
                bottom: 10,
                left: 10
            } as const,
            shadow: {
                enabled: true,
                color: 'rgba(0,0,0,0.5)',
                size: 5,
                x: 2,
                y: 2
            }
        }))
    )

    const edges: DataInterfaceEdges = new DataSet(
        props.edges.map(edge => ({
            id: edge.id,
            from: edge.from,
            to: edge.to,
            arrows: {
                to: {
                    enabled: true,
                    type: 'arrow',
                    scaleFactor: 1
                }
            },
            label: formatEdgeLabel(edge),
            title: formatProbabilities(edge),
            color: {
                color: '#3b82f6',
                highlight: '#60a5fa',
                hover: '#60a5fa',
            },
            font: {
                align: 'middle',
                size: 12,
                color: '#ffffff',
                background: '#2a2a2a',
                strokeWidth: 2,
                strokeColor: '#000000'
            },
            smooth: {
                enabled: true,
                type: 'curvedCW',
                roundness: 0.2
            },
            width: 2
        }))
    )

    const options: Options = {
        layout: {
            improvedLayout: true,
            randomSeed: 2 // Consistent initial layout
        },
        physics: {
            enabled: true,
            solver: 'forceAtlas2Based',
            forceAtlas2Based: {
                gravitationalConstant: -2000,
                centralGravity: 0.005,
                springLength: 300,
                springConstant: 0.18,
                damping: 0.4,
                avoidOverlap: 1.5
            },
            stabilization: {
                enabled: true,
                iterations: 2000
            }
        },
        nodes: {
            font: {
                color: 'var(--color-text)',
                size: 14,
                face: 'system-ui'
            },
            margin: {
                top: 10,
                right: 10,
                bottom: 10,
                left: 10
            },
            widthConstraint: {
                minimum: 200,
                maximum: 250
            },
            borderWidth: 2,
            shadow: {
                enabled: true,
                color: 'rgba(0,0,0,0.5)',
                size: 5,
                x: 2,
                y: 2
            },
            chosen: {
                node: function (values: any, id: IdType, selected: boolean, hovering: boolean) {
                    values.borderWidth = selected ? 3 : 2;
                    values.borderColor = selected ? 'var(--color-primary)' : 'var(--color-border)';
                    values.shadow = true;
                    values.shadowColor = selected ? 'var(--color-primary)' : 'rgba(0,0,0,0.5)';
                },
                label: function (values: any, id: IdType, selected: boolean, hovering: boolean) {
                    values.color = selected ? 'var(--color-primary)' : 'var(--color-text)';
                }
            } as const
        },
        edges: {
            font: {
                color: 'var(--color-text)',
                size: 12,
                face: 'system-ui',
                background: 'var(--color-background-soft)',
                strokeWidth: 0
            },
            smooth: {
                enabled: true,
                type: 'curvedCW',
                roundness: 0.2
            },
            width: 2,
            shadow: {
                enabled: true,
                color: 'rgba(0,0,0,0.5)'
            }
        },
        autoResize: true,
        height: '100%',
        width: '100%',
        manipulation: {
            enabled: true,
            addNode: false,
            addEdge: false,
            deleteNode: false,
            deleteEdge: false,
        },
        interaction: {
            hover: true,
            tooltipDelay: 300,
            zoomView: true,
            navigationButtons: true,
            keyboard: {
                enabled: true,
                speed: { x: 10, y: 10, zoom: 0.1 },
                bindToWindow: false
            }
        }
    }

    network.value = new Network(
        container.value,
        { nodes, edges } as Data,
        options
    )
    setupEvents()

    if (nodePositions.value.size > 0) {
        nodePositions.value.forEach((pos, id) => {
            network.value?.moveNode(id, pos.x, pos.y)
        })
    }

    network.value?.once('stabilized', () => {
        network.value?.setOptions({ physics: { enabled: false } });
    });
}

onMounted(() => {
    initNetwork()
})

watch([() => props.nodes, () => props.edges], () => {
    if (network.value) {
        saveCurrentPositions()
        network.value.destroy()
    }
    initNetwork()
}, { deep: true })

onUnmounted(() => {
    if (network.value) {
        network.value.destroy()
    }
})

const handleNodeDblClick = (nodeId: string) => {
    const node = props.nodes.find(n => n.id === nodeId)
    if (node && props.editMode) {
        emit('node-update', {
            ...node,
            // Add edited properties
        })
    }
}

const saveCurrentPositions = () => {
    if (!network.value) return
    const positions = network.value.getPositions()
    Object.entries(positions).forEach(([id, pos]) => {
        nodePositions.value.set(id, pos)
    })
}

const resetView = () => {
    if (network.value) {
        // Enable physics to reorganize nodes
        network.value.setOptions({
            physics: {
                enabled: true,
                stabilization: {
                    enabled: true,
                    iterations: 1000
                }
            }
        });

        // Wait for stabilization, then disable physics and fit view
        network.value.once('stabilized', () => {
            network.value?.setOptions({ physics: { enabled: false } });
            network.value?.fit({
                animation: {
                    duration: 1000,
                    easingFunction: 'easeInOutQuad'
                }
            });
        });
    }
}

const filters = ref({
    category: 'all',
    searchTerm: ''
})

const filteredNodes = computed(() => {
    return props.nodes.filter(node => {
        if (filters.value.category !== 'all' && node.category !== filters.value.category) return false
        if (filters.value.searchTerm && !node.name.toLowerCase().includes(filters.value.searchTerm.toLowerCase())) return false
        return true
    })
})

const categories = computed(() => ['all', ...new Set(props.nodes.map(n => n.category))])

const handleZoom = (direction: 'in' | 'out') => {
    if (!network.value) return
    const scale = direction === 'in' ? 1.2 : 0.8
    network.value.moveTo({
        scale: network.value.getScale() * scale,
        animation: {
            duration: 200,
            easingFunction: 'easeInOutQuad'
        }
    })
}
</script>

<template>
    <div class="graph-container">
        <div class="toolbar">
            <div class="toolbar-group">
                <button @click="resetView" title="Reset View">
                    <i class="fas fa-compress-arrows-alt"></i>
                </button>
                <button @click="handleZoom('in')" title="Zoom In">
                    <i class="fas fa-search-plus"></i>
                </button>
                <button @click="handleZoom('out')" title="Zoom Out">
                    <i class="fas fa-search-minus"></i>
                </button>
            </div>

            <div class="toolbar-group">
                <select v-model="filters.category">
                    <option v-for="category in categories" :key="category" :value="category">
                        {{ category === 'all' ? 'All Categories' : category }}
                    </option>
                </select>
                <input type="search" v-model="filters.searchTerm" placeholder="Search nodes..." class="search-input">
            </div>
        </div>

        <div v-if="props.selectedNodeId" class="node-info-overlay">
            <div class="node-info-content">
                <h3>{{ props.nodes.find(n => n.id === props.selectedNodeId)?.name }}</h3>
                <div class="node-states">
                    <div v-for="state in props.nodes.find(n => n.id === props.selectedNodeId)?.states" :key="state"
                        class="state-item">
                        <span>{{ state }}:</span>
                        <span>{{ props.nodes.find(n => n.id ===
                            props.selectedNodeId)?.probabilities?.[state]?.toFixed(2) || 'N/A' }}</span>
                    </div>
                </div>
            </div>
        </div>

        <div id="network" ref="container"></div>

        <div class="minimap">
            <!-- Add minimap implementation -->
        </div>

        <div class="legend">
            <h4>Categories</h4>
            <div v-for="category in categories.filter(c => c !== 'all')" :key="category" class="legend-item">
                <span class="color-dot" :style="{ background: getColorForCategory(category) }"></span>
                <span>{{ category }}</span>
            </div>
        </div>
    </div>
</template>

<style scoped>
.graph-container {
    height: 100%;
    width: 100%;
    background: var(--color-background);
    position: relative;
    overflow: hidden;
    min-height: 500px;
    min-width: 100%;
}

.toolbar {
    display: flex;
    justify-content: space-between;
    width: 100%;
    max-width: 800px;
    margin: 0 auto;
    padding: 1rem;
    background: var(--color-background-soft);
    border-radius: 8px;
    box-shadow: var(--shadow-md);
}

.toolbar-group {
    display: flex;
    gap: 0.5rem;
}

.search-input {
    padding: 0.5rem;
    border-radius: 6px;
    border: 1px solid var(--color-border);
    background: var(--color-background);
    color: var(--color-text);
    width: 200px;
}

.legend {
    position: absolute;
    bottom: 1rem;
    right: 1rem;
    background: var(--color-background-soft);
    padding: 1rem;
    border-radius: 8px;
    border: 1px solid var(--color-border);
    box-shadow: var(--shadow-md);
}

.legend-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin: 0.25rem 0;
}

.color-dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
}

.minimap {
    position: absolute;
    bottom: 1rem;
    left: 1rem;
    width: 200px;
    height: 150px;
    background: var(--color-background-soft);
    border: 1px solid var(--color-border);
    border-radius: 8px;
    overflow: hidden;
}

#network {
    height: 100%;
    width: 100%;
    position: absolute;
    top: 0;
    left: 0;
    min-height: 500px;
}

.node-info-overlay {
    position: absolute;
    top: 1rem;
    left: 1rem;
    z-index: 1;
    background: var(--color-background-soft);
    border: 1px solid var(--color-border);
    border-radius: 8px;
    padding: 1rem;
    box-shadow: var(--shadow-md);
    max-width: 300px;
    animation: fadeIn 0.2s ease-in-out;
}

.node-info-content h3 {
    margin-bottom: 0.5rem;
    color: var(--color-primary);
}

.node-states {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}

.state-item {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
}

@keyframes fadeIn {
    from {
        opacity: 0;
        transform: translateY(-10px);
    }

    to {
        opacity: 1;
        transform: translateY(0);
    }
}
</style>