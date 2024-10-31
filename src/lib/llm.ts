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
        const prompt = `
You are a helpful assistant for building Causal Bayesian Networks (CBNs) focused on seagrass restoration.

Analyze this relationship in the current network:
Water Quality → Seagrass Biomass

Please explain:
1. The causal mechanism
2. Current states and probabilities
3. Key environmental factors
4. Potential interventions

Current CBN state:
${JSON.stringify(cbn, null, 2)}

User input: "${userInput}"

Respond in this format:
1. First provide a natural language explanation
2. Then provide a JSON object with:
{
    "updated_cbn": null,
    "tentative_suggestions": ["suggestion1", "suggestion2"],
    "reflection_prompts": ["question1", "question2"],
    "subclaims": ["subclaim1", "subclaim2"]
}`;

        try {
            const response = await fetch(this.config.baseUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${this.config.apiKey}`,
                    "HTTP-Referer": "https://localhost:3000",
                    "X-Title": "Seagrass CBN Builder",
                },
                body: JSON.stringify({
                    model: this.config.model,
                    messages: [
                        {
                            role: "system",
                            content:
                                "You are an AI assistant that helps build Causal Bayesian Networks. Respond with a natural language explanation followed by a JSON object.",
                        },
                        {
                            role: "user",
                            content: prompt,
                        },
                    ],
                    temperature: 0.7,
                    max_tokens: 2500,
                    top_p: 1,
                    frequency_penalty: 0,
                    presence_penalty: 0,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                console.error("API Error:", errorData);
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();

            if (!result.choices?.[0]?.message?.content) {
                throw new Error("Invalid API response format");
            }

            const content = result.choices[0].message.content;

            // Split the content into natural language and JSON parts
            const jsonStartMatch = content.match(/\{[\s\S]*\}/);
            if (!jsonStartMatch) {
                throw new Error("No JSON object found in response");
            }

            const jsonStr = jsonStartMatch[0];
            const explanation = content.substring(0, content.indexOf(jsonStr))
                .trim();

            // Parse the JSON part
            const jsonResponse = JSON.parse(jsonStr);

            return {
                updated_cbn: jsonResponse.updated_cbn || cbn,
                tentative_suggestions: [
                    explanation,
                    ...(jsonResponse.tentative_suggestions || []),
                ],
                reflection_prompts: jsonResponse.reflection_prompts || [],
                subclaims: jsonResponse.subclaims || [],
            };
        } catch (error) {
            console.error("Error processing user input:", error);
            // Provide a more informative fallback response
            return {
                updated_cbn: cbn,
                tentative_suggestions: [
                    "Water Quality has a direct positive influence on Seagrass Biomass. Good water quality, characterized by appropriate light penetration and nutrient levels, is essential for seagrass growth and survival. When water quality is poor, it can limit photosynthesis and reduce seagrass biomass production.",
                ],
                reflection_prompts: [
                    "How might improving water quality affect seagrass recovery rates?",
                    "What other environmental factors interact with water quality?",
                ],
                subclaims: [],
            };
        }
    }

    private validateAndNormalizeLLMResponse(
        result: any,
        fallbackCBN: CBN,
    ): LLMResponse {
        try {
            const response = JSON.parse(
                typeof result === "string"
                    ? result
                    : result.choices[0].message.content,
            );

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
            console.error("Error parsing LLM response:", error);
            return {
                updated_cbn: fallbackCBN,
                tentative_suggestions: ["Error: Invalid response format"],
                reflection_prompts: ["Please try again"],
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
