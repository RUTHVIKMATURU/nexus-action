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
    description="FastAPI + LangGraph backend for orchestrating student mentorship workflows.",
    version="1.0.0"
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
    student_id: str

# Output response model
class AnalyzeResponse(BaseModel):
    student_id: str
    history: List[Any]
    retrieved_context: List[Any]
    current_plan: List[Any]
    recommendations: List[Any]
    requires_review: bool

@app.post("/api/engine/analyze", response_model=AnalyzeResponse)
async def analyze_student(request: AnalyzeRequest):
    """
    Invokes the LangGraph orchestration flow for a given student ID.
    Returns the processed state after executing all nodes.
    """
    try:
        # Initialize graph state
        initial_state = {
            "student_id": request.student_id,
            "history": [],
            "retrieved_context": [],
            "current_plan": [],
            "recommendations": [],
            "requires_review": False
        }
        
        # Invoke the LangGraph workflow asynchronously
        # This will run planner -> retriever -> reasoner sequentially
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
