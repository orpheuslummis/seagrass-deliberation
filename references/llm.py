import json
import os
import logging
from dotenv import load_dotenv
from litellm import completion
from json.decoder import JSONDecodeError

load_dotenv()

logger = logging.getLogger(__name__)

openrouter_api_key = os.getenv("OPENROUTER_API_KEY")
ai_model = os.getenv("AI_MODEL", "openrouter/qwen/qwen-2.5-72b-instruct")

if not openrouter_api_key:
    logger.error("OPENROUTER_API_KEY is not set in the .env file")
    raise ValueError("OPENROUTER_API_KEY is not set in the .env file")


def process_user_input(cbn, user_input):
    logger.info(f"Processing user input: {user_input}")
    logger.info(f"Current CBN state: {json.dumps(cbn, indent=2)}")

    prompt = f"""
    You are a helpful assistant for building Causal Bayesian Networks (CBNs).
    The current CBN is represented as follows:
    {json.dumps(cbn, indent=2)}
    
    The user input is: "{user_input}"
    
    Based on this:
    1. Update the CBN JSON schema accordingly.
    2. Provide tentative suggestions for incomplete relationships.
    3. Generate reflection prompts to ensure completeness and consistency.
    4. If the claim is complex, break it down into subclaims.
    
    Provide your response in the following JSON format, ensuring it is valid JSON without any comments:
    {{
        "updated_cbn": {{
            "nodes": [...],
            "edges": [...],
            "cpds": {{
                "NodeName": {{
                    "states": [...],
                    "probabilities": {{...}},
                    "parents": [...]
                }},
                ...
            }}
        }},
        "tentative_suggestions": [...],
        "reflection_prompts": [...],
        "subclaims": [...]
    }}

    Ensure all property names are in double quotes and avoid using comments in the JSON.
    If a CPD has many combinations, you may include a subset for brevity, but ensure the JSON remains valid.
    """

    logger.info(f"Generated prompt: {prompt}")

    try:
        logger.info("Sending request to AI model")
        response = completion(
            model=ai_model,
            messages=[
                {
                    "role": "system",
                    "content": "You are an AI assistant that helps build Causal Bayesian Networks. Always respond with valid JSON.",
                },
                {"role": "user", "content": prompt},
            ],
            temperature=0.3,
            max_tokens=2500,
        )
        logger.info("Received response from AI model")

        content = response.choices[0].message.content
        logger.info(f"Raw AI response: {content}")

        # Improved JSON extraction
        if content.strip().startswith("```"):
            content = content.strip().split("```", 2)[1]
            if content.lower().startswith("json"):
                content = content[4:].strip()

        # Attempt to parse the JSON
        try:
            result = json.loads(content)
        except JSONDecodeError as e:
            logger.warning(f"Failed to parse complete JSON: {str(e)}")
            # Attempt to parse partial JSON
            try:
                partial_content = content[: e.pos] + "}"
                result = json.loads(partial_content)
                logger.info("Successfully parsed partial JSON")
            except JSONDecodeError:
                raise ValueError("Unable to parse even partial JSON")

        logger.info("Successfully parsed AI model response")
        logger.debug(f"Parsed result: {json.dumps(result, indent=2)}")

        # Validate the required keys in the result
        required_keys = [
            "updated_cbn",
            "tentative_suggestions",
            "reflection_prompts",
            "subclaims",
        ]
        for key in required_keys:
            if key not in result:
                raise KeyError(f"Missing required key in AI response: {key}")

        # Ensure all nodes have corresponding CPDs
        updated_cbn = result["updated_cbn"]
        for node in updated_cbn["nodes"]:
            if node["name"] not in updated_cbn["cpds"]:
                logger.warning(
                    f"Node '{node['name']}' is missing CPD. Adding default CPD."
                )
                updated_cbn["cpds"][node["name"]] = {
                    "parents": [],
                    "probabilities": {
                        "": [1.0 / len(node["states"]) for _ in node["states"]]
                    },
                }

        return (
            updated_cbn,
            result["tentative_suggestions"],
            result["reflection_prompts"],
            result["subclaims"],
        )
    except (json.JSONDecodeError, ValueError) as e:
        logger.error(f"Failed to parse AI model response: {str(e)}")
        logger.error(f"Content attempted to parse: {content}")
        return (
            cbn,
            ["Error: Invalid or incomplete JSON response from AI model"],
            ["Please try again"],
            [],
        )
    except KeyError as e:
        logger.error(f"Invalid AI model response structure: {str(e)}")
        return cbn, [f"Error: {str(e)}"], ["Please try again"], []
    except Exception as e:
        logger.error(f"Unexpected error in process_user_input: {str(e)}", exc_info=True)
        return cbn, ["Error: An unexpected error occurred"], ["Please try again"], []


def interpret_cbn(cbn):
    logger.info("Generating LLM interpretation of CBN")
    prompt = f"""
    Given the following Causal Bayesian Network (CBN):
    
    Nodes: {cbn['nodes']}
    Edges: {cbn['edges']}
    
    Please provide a brief interpretation of this network. Explain the relationships between the nodes
    and any insights that can be drawn from the structure. Keep your explanation concise and clear.
    """

    try:
        response = completion(
            model=ai_model,
            messages=[
                {
                    "role": "system",
                    "content": "You are an AI assistant that interprets Causal Bayesian Networks.",
                },
                {"role": "user", "content": prompt},
            ],
            temperature=0.3,
            max_tokens=150,
        )

        interpretation = response.choices[0].message.content.strip()
        logger.info(
            f"Raw AI interpretation: {interpretation}"
        )  # Log the raw AI interpretation
        logger.info("Successfully generated CBN interpretation")
        return interpretation
    except Exception as e:
        logger.error(f"Error generating CBN interpretation: {str(e)}", exc_info=True)
        return "Error: Unable to generate interpretation."
