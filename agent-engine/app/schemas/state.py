from pydantic import BaseModel, Field
from typing import List, Any

class AgentState(BaseModel):
    student_id: str
    history: List[Any] = Field(default_factory=list)
    retrieved_context: List[Any] = Field(default_factory=list)
    current_plan: List[Any] = Field(default_factory=list)
    recommendations: List[Any] = Field(default_factory=list)
    requires_review: bool = False
