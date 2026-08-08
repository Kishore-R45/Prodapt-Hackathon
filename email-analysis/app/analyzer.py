import os
import json
from groq import Groq
from dotenv import load_dotenv

load_dotenv()

client = Groq(
    api_key=os.getenv("GROQ_API_KEY")
)

MODEL = os.getenv(
    "GROQ_MODEL",
    "llama-3.3-70b-versatile"
)


def analyze_email(email_text: str):

    prompt = f"""
You are an intelligent email analysis system.

Analyze the email below.

Your job is to identify:

1. Whether the message is important.
2. Priority level:
   - HIGH
   - MEDIUM
   - LOW
3. Importance score from 0 to 1.
4. Reason for the priority.
5. All actionable tasks.
6. All deadlines.
7. Which task a deadline belongs to, if clearly stated.

IMPORTANT RULES:

- Do not invent information.
- Do not invent tasks.
- Do not invent deadlines.
- A date mentioned in an email is NOT automatically a deadline.
- Only extract a deadline when the email indicates that an action/date is time-bound.
- If there are no tasks, return an empty array.
- If there are no deadlines, return an empty array.
- If the exact calendar date cannot be determined, keep datetime as null.
- HIGH = urgent, critical, time-sensitive, or important action.
- MEDIUM = requires attention/action but isn't urgent.
- LOW = informational or no meaningful action.

Return ONLY valid JSON.

Use exactly this format:

{{
    "priority": "HIGH",
    "importance_score": 0.95,
    "importance_reason": "The email contains an urgent request with a deadline.",

    "tasks": [
        {{
            "description": "Prepare the project report",
            "status": "PENDING"
        }}
    ],

    "deadlines": [
        {{
            "text": "Friday",
            "datetime": null,
            "task_description": "Prepare the project report"
        }}
    ]
}}

EMAIL:

{email_text}
"""

    response = client.chat.completions.create(
        model=MODEL,

        messages=[
            {
                "role": "system",
                "content": (
                    "You analyze emails and return "
                    "only valid JSON."
                )
            },
            {
                "role": "user",
                "content": prompt
            }
        ],

        temperature=0,

        response_format={
            "type": "json_object"
        }
    )

    content = response.choices[0].message.content

    if not content:
        raise ValueError("Groq returned an empty response.")

    return json.loads(content)