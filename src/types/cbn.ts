export interface Node {
    id: string;
    name: string;
    states: string[];
    category: string;
    probabilities?: Record<string, number>;
    description?: string;
}

export interface Edge {
    id: string;
    from: string;
    to: string;
    probability?: number | Record<string, Record<string, number>>;
    description?: string;
}

export interface CPD {
    parents: string[];
    probabilities: Record<string, number[]>;
}

export interface CBN {
    nodes: Node[];
    edges: Edge[];
    cpds: Record<string, CPD>;
}

export interface Message {
    text: string;
    sender: "user" | "bot";
    action?: {
        type: "UPDATE_NODE" | "ADD_EDGE" | "UPDATE_PROBABILITY";
        payload: any;
    };
}
