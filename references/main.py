import os
import gradio as gr
import json
import logging

from cbning.llm import interpret_cbn
from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

initial_cbn = {
    "nodes": [
        {"name": "Water Quality", "states": ["Poor", "Good"], "observable": True},
        {
            "name": "Seagrass Biomass",
            "states": ["Low", "Medium", "High"],
            "observable": True,
        },
        {"name": "Carbon Sequestration", "states": ["Low", "High"], "observable": True},
        {
            "name": "Restoration Investment",
            "states": ["Limited", "Adequate"],
            "observable": True,
        },
        {"name": "Local Support", "states": ["Weak", "Strong"], "observable": True},
    ],
    "edges": [
        {"from": "Water Quality", "to": "Seagrass Biomass"},
        {"from": "Seagrass Biomass", "to": "Carbon Sequestration"},
        {"from": "Restoration Investment", "to": "Water Quality"},
        {"from": "Restoration Investment", "to": "Seagrass Biomass"},
        {"from": "Local Support", "to": "Restoration Investment"},
    ],
    "cpds": {
        "Local Support": {
            "parents": [],
            "probabilities": {
                "": [0.6, 0.4]
            },  # Prior probability of Weak vs Strong support
        },
        "Restoration Investment": {
            "parents": ["Local Support"],
            "probabilities": {
                "Weak": [0.8, 0.2],  # [Limited, Adequate] given Weak support
                "Strong": [0.3, 0.7],  # [Limited, Adequate] given Strong support
            },
        },
        "Water Quality": {
            "parents": ["Restoration Investment"],
            "probabilities": {
                "Limited": [0.7, 0.3],  # [Poor, Good] given Limited investment
                "Adequate": [0.3, 0.7],  # [Poor, Good] given Adequate investment
            },
        },
        "Seagrass Biomass": {
            "parents": ["Water Quality", "Restoration Investment"],
            "probabilities": {
                "Poor_Limited": [0.7, 0.2, 0.1],  # [Low, Medium, High]
                "Poor_Adequate": [0.5, 0.3, 0.2],
                "Good_Limited": [0.3, 0.4, 0.3],
                "Good_Adequate": [0.2, 0.3, 0.5],
            },
        },
        "Carbon Sequestration": {
            "parents": ["Seagrass Biomass"],
            "probabilities": {
                "Low": [0.9, 0.1],  # [Low, High] given Low biomass
                "Medium": [0.5, 0.5],  # [Low, High] given Medium biomass
                "High": [0.2, 0.8],  # [Low, High] given High biomass
            },
        },
    },
}


def get_layer(node, G):
    """Determine the layer of each node for hierarchical layout"""
    layers = {
        "Local Support": 0,
        "Restoration Investment": 1,
        "Water Quality": 2,
        "Seagrass Biomass": 3,
        "Carbon Sequestration": 4,
    }
    return layers.get(node, 0)


def format_probabilities(probs):
    """Format probability distributions more compactly"""
    if isinstance(probs, dict):
        if "" in probs:  # Prior probability
            return f"Prior: {probs['']}"
        return "P(" + " | ".join(f"{k}={v}" for k, v in probs.items()) + ")"
    return str(probs)


def visualize_cbn(cbn):
    # Create Mermaid diagram definition
    mermaid_diagram = """
    flowchart TD
        classDef default fill:#BAE6FD,stroke:#0369A1,stroke-width:2px;
        
        LS[Local Support<br/>States: Weak, Strong<br/>CPD: Prior [0.6, 0.4]] --> RI[Restoration Investment]
        RI[Restoration Investment<br/>States: Limited, Adequate<br/>CPD: P(Weak=[0.8, 0.2] | Strong=[0.3, 0.7])] --> WQ[Water Quality]
        RI --> SB[Seagrass Biomass]
        WQ[Water Quality<br/>States: Poor, Good<br/>CPD: P(Limited=[0.7, 0.3] | Adequate=[0.3, 0.7])] --> SB[Seagrass Biomass]
        SB[Seagrass Biomass<br/>States: Low, Medium, High<br/>CPD: Complex] --> CS[Carbon Sequestration<br/>States: Low, High<br/>CPD: P(Low=[0.9, 0.1] | Medium=[0.5, 0.5] | High=[0.2, 0.8])]
    """

    # Wrap the Mermaid diagram in proper HTML with initialization
    html = f"""
    <div class="mermaid">
    {mermaid_diagram}
    </div>
    <script type="module">
        import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.esm.min.mjs';
        mermaid.initialize({{ 
            startOnLoad: true,
            theme: 'default',
            flowchart: {{
                useMaxWidth: true,
                htmlLabels: true,
                curve: 'basis'
            }}
        }});
    </script>
    """
    return html


def format_json(cbn):
    return json.dumps(cbn, indent=2)


def chatbot_interface(user_input, state, chat_history, chatbot):
    if chat_history is None:
        chat_history = []

    user_message = (
        f"<div style='background-color: #e6f3ff; padding: 10px; border-radius: 5px;'>{user_input}</div>"
        if user_input
        else None
    )
    ai_message = None

    if not chat_history:
        initial_message = """Welcome to the Causal Bayesian Network Builder!

We're starting with a simple scenario about marine ecosystem restoration and carbon sequestration.

You can:
• Add new factors
• Modify relationships
• Update probabilities
• Ask questions about the model

What would you like to explore?"""

        ai_message = f"<div style='background-color: #f0f0f0; padding: 10px; border-radius: 5px;'>{initial_message}</div>"
        chat_history.append((None, ai_message))
        logger.info("Initialized chat with welcome message")

        # Generate diagram and interpretation using current state
        diagram = visualize_cbn(state)
        interpretation = interpret_cbn(state)

        return (
            state,
            diagram,
            chat_history,
            chatbot + [(None, ai_message)],
            "",
            interpretation,
        )

    logger.info(f"Processing user input: {user_input}")

    try:
        # Generate diagram and interpretation using current state
        diagram = visualize_cbn(state)
        interpretation = interpret_cbn(state)

        ai_message = f"<div style='background-color: #f0f0f0; padding: 10px; border-radius: 5px;'>{interpretation}</div>"

        return (
            state,
            diagram,
            chat_history + [(user_message, ai_message)],
            chatbot + [(user_message, ai_message)],
            "",
            interpretation,
        )

    except Exception as e:
        logger.error(f"Error processing user input: {str(e)}", exc_info=True)
        ai_message = f"<div style='background-color: #ffcccc; padding: 10px; border-radius: 5px;'>Error: {str(e)}</div>"

        return (
            state,
            visualize_cbn(state),
            chat_history + [(user_message, ai_message)],
            chatbot + [(user_message, ai_message)],
            "",
            interpret_cbn(state),
        )


def create_demo():
    logger.info("Creating Gradio demo")
    with gr.Blocks() as demo:
        gr.Markdown("# Causal Bayesian Network Builder")

        with gr.Row():
            with gr.Column(scale=1):
                chatbot = gr.Chatbot(height=800)
                user_input = gr.Textbox(
                    show_label=False, placeholder="Enter your message here..."
                )

            with gr.Column(scale=1):
                # Replace Plot with HTML
                graph_output = gr.HTML()
                interpretation = gr.Textbox(
                    label="CBN Interpretation",
                    interactive=False,
                    elem_classes="custom-interpretation",
                )

        state = gr.State(initial_cbn)
        chat_history = gr.State([])

        # Update the interface function to use the new visualization
        def chatbot_interface(user_input, state, chat_history, chatbot):
            if chat_history is None:
                chat_history = []

            user_message = (
                f"<div style='background-color: #e6f3ff; padding: 10px; border-radius: 5px;'>{user_input}</div>"
                if user_input
                else None
            )

            try:
                # Generate diagram and interpretation using current state
                diagram = visualize_cbn(state)
                interpretation = interpret_cbn(state)

                ai_message = f"<div style='background-color: #f0f0f0; padding: 10px; border-radius: 5px;'>{interpretation}</div>"

                return (
                    state,
                    diagram,
                    chat_history + [(user_message, ai_message)],
                    chatbot + [(user_message, ai_message)],
                    "",
                    interpretation,
                )

            except Exception as e:
                logger.error(f"Error processing user input: {str(e)}", exc_info=True)
                ai_message = f"<div style='background-color: #ffcccc; padding: 10px; border-radius: 5px;'>Error: {str(e)}</div>"

                return (
                    state,
                    visualize_cbn(state),
                    chat_history + [(user_message, ai_message)],
                    chatbot + [(user_message, ai_message)],
                    "",
                    interpret_cbn(state),
                )

        demo.load(
            chatbot_interface,
            [user_input, state, chat_history, chatbot],
            [state, graph_output, chat_history, chatbot, user_input, interpretation],
        )
        user_input.submit(
            chatbot_interface,
            [user_input, state, chat_history, chatbot],
            [state, graph_output, chat_history, chatbot, user_input, interpretation],
        )

    return demo


demo = create_demo()
if __name__ == "__main__":
    debug = os.getenv("DEBUG", "false").lower() == "true"
    share = os.getenv("SHARE", "false").lower() == "true"
    logger.info(f"Launching demo with debug={debug}, share={share}")
    demo.launch(
        debug=debug,
        share=share,
        server_name="0.0.0.0",
        ssl_keyfile=None,
        ssl_certfile=None,
    )
