import type { CBN, Edge, Node } from "../types/cbn";

interface LLMResponse {
    updated_cbn: CBN;
    tentative_suggestions: string[];
    reflection_prompts: string[];
    subclaims: string[];
}

interface LLMConfig {
    apiKey: string;
    model: string;
    baseUrl: string;
}

interface DialogueState {
    currentFocus: "nodes" | "edges" | "probabilities" | null;
    selectedNode: string | null;
    selectedEdge: string | null;
}

class LLMService {
    private config: LLMConfig;
    private basePrompt: string;

    constructor(config: LLMConfig) {
        this.config = config;
        this.basePrompt = `
You are a helpful assistant for building Causal Bayesian Networks (CBNs) focused on seagrass restoration.
The CBN models relationships between environmental, economic, and social factors.`;
    }

    async processUserInput(cbn: CBN, userInput: string): Promise<LLMResponse> {
        try {
            const response = await fetch(this.config.baseUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${this.config.apiKey}`,
                    "HTTP-Referer": window.location.origin,
                    "X-Title": "Seagrass CBN Builder",
                },
                body: JSON.stringify({
                    model: this.config.model,
                    messages: [
                        {
                            role: "system",
                            content: `${this.basePrompt}
You analyze Causal Bayesian Networks (CBNs) for seagrass restoration.
Respond with a raw JSON object (no markdown formatting) containing these fields:
{
    "updated_cbn": CBN | null,
    "tentative_suggestions": string[],
    "reflection_prompts": string[],
    "subclaims": string[]
}
Do not include markdown code blocks or any other formatting in your response.`,
                        },
                        {
                            role: "user",
                            content:
                                `Analyze this relationship in the CBN: ${userInput}\nCurrent network state: ${
                                    JSON.stringify(cbn, null, 2)
                                }`,
                        },
                    ],
                    temperature: 0.7,
                    max_tokens: 1000,
                    response_format: { type: "json_object" },
                }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(
                    `API error: ${response.status} - ${
                        JSON.stringify(errorData)
                    }`,
                );
            }

            const result = await response.json();
            return this.validateAndNormalizeLLMResponse(result, cbn);
        } catch (error) {
            console.error("LLM Service Error:", error);
            throw error;
        }
    }

    private validateAndNormalizeLLMResponse(
        result: any,
        fallbackCBN: CBN,
    ): LLMResponse {
        try {
            // Extract content from the LLM response
            let content = typeof result === "string"
                ? result
                : result.choices[0].message.content;

            // Clean up markdown formatting if present
            if (content.includes("```json")) {
                content = content.replace(/```json\n|\n```/g, "");
            } else if (content.includes("```")) {
                content = content.replace(/```\n|\n```/g, "");
            }

            // Parse the cleaned JSON
            const response = JSON.parse(content.trim());

            // Ensure the updated_cbn maintains the correct structure
            if (response.updated_cbn) {
                // Validate nodes
                response.updated_cbn.nodes = response.updated_cbn.nodes.map((
                    node: Node,
                ) => ({
                    ...node,
                    states: Array.isArray(node.states) ? node.states : [],
                    probabilities: node.probabilities || {},
                }));

                // Validate edges
                response.updated_cbn.edges = response.updated_cbn.edges.map((
                    edge: Edge,
                ) => ({
                    ...edge,
                    probability: edge.probability || null,
                }));
            }

            return {
                updated_cbn: response.updated_cbn || fallbackCBN,
                tentative_suggestions: response.tentative_suggestions || [],
                reflection_prompts: response.reflection_prompts || [],
                subclaims: response.subclaims || [],
            };
        } catch (error) {
            console.error(
                "Error parsing LLM response:",
                error,
                "\nRaw response:",
                result,
            );
            return {
                updated_cbn: fallbackCBN,
                tentative_suggestions: [
                    "Error: Could not process the response",
                ],
                reflection_prompts: ["Please try rephrasing your question"],
                subclaims: [],
            };
        }
    }

    async interpretCBN(cbn: CBN): Promise<string> {
        const prompt = `
Analyze this seagrass restoration CBN:

1. Key pathways:
${this.identifyKeyPathways(cbn)}

2. Feedback loops:
${this.identifyFeedbackLoops(cbn)}

3. Intervention points:
${this.identifyInterventionPoints(cbn)}

Provide a concise interpretation focusing on practical implications.`;

        try {
            const response = await fetch(this.config.baseUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${this.config.apiKey}`,
                },
                body: JSON.stringify({
                    model: this.config.model,
                    messages: [
                        {
                            role: "system",
                            content:
                                "You are an AI assistant that interprets Causal Bayesian Networks.",
                        },
                        {
                            role: "user",
                            content: prompt,
                        },
                    ],
                    temperature: 0.3,
                    max_tokens: 150,
                }),
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            return result.choices[0].message.content.trim();
        } catch (error) {
            console.error("Error interpreting CBN:", error);
            return "Error: Unable to generate interpretation.";
        }
    }

    private formatNodesForPrompt(nodes: Node[]): string {
        const categoryMap: Record<string, string[]> = {};

        nodes.forEach((node) => {
            if (!categoryMap[node.category]) {
                categoryMap[node.category] = [];
            }
            categoryMap[node.category].push(
                `${node.name} (${node.states.join("/")})`,
            );
        });

        return Object.entries(categoryMap)
            .map(([category, nodeList]) =>
                `${category}: ${nodeList.join(", ")}`
            )
            .join("\n");
    }

    private formatEdgesForPrompt(edges: Edge[], nodes: Node[]): string {
        return edges
            .map((edge) => {
                const from = nodes.find((n) => n.id === edge.from)?.name;
                const to = nodes.find((n) => n.id === edge.to)?.name;
                return `${from} → ${to}${
                    edge.probability ? ` (p=${edge.probability})` : ""
                }`;
            })
            .join("\n");
    }

    private generateStructuredPrompt(
        cbn: CBN,
        userInput: string,
        dialogueState: DialogueState,
    ): string {
        let focusedPrompt = "";

        switch (dialogueState.currentFocus) {
            case "probabilities":
                focusedPrompt = `
Focus on updating conditional probabilities.
Current node: ${dialogueState.selectedNode}
Consider:
- Evidence from similar ecosystems
- Expert knowledge
- Uncertainty ranges`;
                break;

            case "edges":
                focusedPrompt = `
Focus on causal relationships.
Consider:
- Direct vs indirect effects
- Mediating variables
- Feedback loops`;
                break;

            default:
                focusedPrompt = `
Consider all aspects of the network:
- New variables to add
- Missing relationships
- Probability updates`;
        }

        return `
${this.basePrompt}
${focusedPrompt}

User input: "${userInput}"
Current network state: ${JSON.stringify(cbn, null, 2)}
`;
    }

    private identifyKeyPathways(cbn: CBN): string {
        // Basic implementation
        return cbn.edges
            .map((edge) => {
                const from = cbn.nodes.find((n) => n.id === edge.from)?.name;
                const to = cbn.nodes.find((n) => n.id === edge.to)?.name;
                return `${from} → ${to}`;
            })
            .join("\n");
    }

    private identifyFeedbackLoops(cbn: CBN): string {
        // Basic implementation
        return "Feedback loops analysis pending";
    }

    private identifyInterventionPoints(cbn: CBN): string {
        // Basic implementation
        return "Intervention points analysis pending";
    }
}

export default LLMService;
