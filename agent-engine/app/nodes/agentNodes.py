import json
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Union
from google import genai
from pydantic import BaseModel
from app.schemas.state import AgentState
from app.config import settings

class NextBestAction(BaseModel):
    """
    Typed Next Best Action object compiled by the reasoner node.
    """
    recommendation: str
    reasoning: str
    confidence_score: float = Field(..., ge=0.0, le=1.0)

async def planner_node(state: Union[AgentState, Dict[str, Any]]) -> Dict[str, Any]:
    """
    Analyzes the student's background and sets an execution plan.
    """
    if isinstance(state, dict):
        student_id = state.get("student_id", "unknown")
        history = list(state.get("history", []))
    else:
        student_id = getattr(state, "student_id", "unknown")
        history = list(getattr(state, "history", []))

    plan = [
        "Analyze student interests and skills profile",
        "Retrieve matching enterprise playbooks and mentor criteria",
        "Generate recommended next best actions with confidence scores"
    ]

    history.append({
        "node": "planner_node",
        "message": f"Analyzed background for student '{student_id}' and generated execution plan.",
        "status": "success"
    })

    return {
        "current_plan": plan,
        "history": history
    }

async def retriever_node(state: Union[AgentState, Dict[str, Any]]) -> Dict[str, Any]:
    """
    Simulates fetching target enterprise playbooks/matching mentor criteria.
    """
    if isinstance(state, dict):
        student_id = state.get("student_id", "unknown")
        history = list(state.get("history", []))
    else:
        student_id = getattr(state, "student_id", "unknown")
        history = list(getattr(state, "history", []))

    retrieved_context = [
        {
            "category": "playbook",
            "title": "Enterprise Onboarding & Technical Alignment",
            "content": "Step-by-step guidelines for aligning university graduates with high-growth engineering teams."
        },
        {
            "category": "mentor_match",
            "criteria": "Looking for active software engineers with mentorship experience in web technologies.",
            "matches": ["Jane Doe (Tech Lead)", "John Smith (Senior Engineer)"]
        }
    ]

    history.append({
        "node": "retriever_node",
        "message": f"Retrieved enterprise onboarding playbooks and matched mentor criteria for student '{student_id}'.",
        "status": "success"
    })

    return {
        "retrieved_context": retrieved_context,
        "history": history
    }

async def reasoner_node(state: Union[AgentState, Dict[str, Any]]) -> Dict[str, Any]:
    """
    Uses the OpenAI LLM to compile a typed Next Best Action object
    containing a recommendation, reasoning justification, and a confidence_score.
    """
    if isinstance(state, dict):
        student_id = state.get("student_id", "unknown")
        history = list(state.get("history", []))
        retrieved_context = list(state.get("retrieved_context", []))
        recommendations = list(state.get("recommendations", []))
    else:
        student_id = getattr(state, "student_id", "unknown")
        history = list(getattr(state, "history", []))
        retrieved_context = list(getattr(state, "retrieved_context", []))
        recommendations = list(getattr(state, "recommendations", []))

    try:
        # Securely instantiate standard Gemini client
        client = genai.Client(api_key=settings.LLM_API_KEY)
        
        system_prompt = f"""
You are an AI mentorship coordinator orchestrating learning tracks.
Based on the student's background (ID: {student_id}), past interaction history, and the retrieved enterprise context playbooks, you must recommend the absolute Next Best Action for the student's development.
"""
        
        user_prompt = f"State History: {json.dumps(history)}\nRetrieved Context: {json.dumps(retrieved_context)}"

        # Execute LLM call enforcing structured JSON output mode
        response = client.models.generate_content(
            model="gemini-3.5-flash",
            contents=[
                system_prompt,
                user_prompt
            ],
            config={
                "response_mime_type": "application/json",
                "response_schema": NextBestAction,
                "temperature": 0.2
            }
        )

        result_str = response.text
        if not result_str:
            raise ValueError("Empty response from LLM")
            
        result_data = json.loads(result_str)

        # Validate structured output using our Pydantic model
        nba = NextBestAction(**result_data)
    except Exception as e:
        # Graceful fallback compilation in case of missing API keys, rate limits, or parse errors
        nba = NextBestAction(
            recommendation="Manual review required due to complex context",
            reasoning=f"Error details: {str(e)}",
            confidence_score=0.0
        )

    # Convert Pydantic object to dictionary for storage/JSON compatibility
    nba_dict = nba.model_dump() if hasattr(nba, "model_dump") else nba.dict()
    recommendations.append(nba_dict)

    # Determine if human/admin review is required based on confidence threshold (e.g., < 0.85)
    confidence_score = nba_dict["confidence_score"]
    requires_review = confidence_score < 0.85

    history.append({
        "node": "reasoner_node",
        "message": f"Compiled Next Best Action recommendation via OpenAI LLM (confidence: {confidence_score}). Requires review: {requires_review}.",
        "status": "success"
    })

    return {
        "recommendations": recommendations,
        "requires_review": requires_review,
        "history": history
    }
