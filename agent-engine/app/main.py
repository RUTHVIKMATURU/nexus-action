from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Any, Dict
import uvicorn
import os
from fastapi.middleware.cors import CORSMiddleware

from app.graphs.graph import compiled_graph
from app.config import settings

app = FastAPI(
    title="NexusAction AI Engine",
    description="FastAPI + LangGraph backend for orchestrating B2B sales intelligence workflows.",
    version="2.0.0"
)

# Configure CORS
frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[frontend_url],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Input payload model
class AnalyzeRequest(BaseModel):
    lead_id: str

# Output response model
class AnalyzeResponse(BaseModel):
    lead_id: str
    history: List[Any]
    lead_context: Dict[str, Any] = {}
    sales_playbooks: List[Any] = []
    extracted_signals: List[Any] = []
    next_best_action: Dict[str, Any] = {}
    requires_review: bool = False

@app.post("/api/engine/analyze", response_model=AnalyzeResponse)
async def analyze_lead(request: AnalyzeRequest):
    """
    Invokes the LangGraph orchestration flow for a given lead ID.
    Returns the processed state after executing all nodes:
    planner -> retriever (firmographic data + playbook matching) -> reasoner.
    """
    try:
        # Initialize graph state with B2B sales fields
        initial_state = {
            "lead_id": request.lead_id,
            "history": [],
            "lead_context": {},
            "sales_playbooks": [],
            "extracted_signals": [],
            "next_best_action": {},
            "requires_review": False,
        }
        
        # Invoke the LangGraph workflow asynchronously
        # planner -> retriever -> reasoner
        result = await compiled_graph.ainvoke(initial_state)
        
        return result
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"LangGraph orchestration failed: {str(e)}"
        )

@app.get("/health")
def health_check():
    """
    Basic service health check endpoint.
    """
    return {"status": "healthy", "service": "NexusAction AI Engine"}

if __name__ == "__main__":
    # Allow running the engine directly
    uvicorn.run("app.main:app", host="0.0.0.0", port=settings.PORT, reload=True)
