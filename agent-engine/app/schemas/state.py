from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional


class LeadContext(BaseModel):
    """Firmographic and commercial data for a target B2B lead."""
    lead_id: str = ""
    company_name: str = ""
    industry: str = ""
    estimated_budget: float = 0.0
    current_vendor: str = ""
    decision_maker: str = ""
    interactions: List[Dict[str, Any]] = Field(default_factory=list)


class SalesPlaybookEntry(BaseModel):
    """A matched playbook scenario with recommended tactics."""
    scenario_name: str = ""
    target_industry: str = ""
    recommended_action: str = ""
    discount_cap: float = 0.0


class ExtractedSignal(BaseModel):
    """A signal extracted from a sales interaction transcript."""
    signal_type: str = ""          # e.g. "competitor_objection", "budget_concern", "feature_request"
    detail: str = ""               # the raw extracted text / paraphrase
    source_interaction_id: str = ""
    confidence: float = Field(default=0.0, ge=0.0, le=1.0)


class AgentState(BaseModel):
    """
    Central graph state for the B2B Sales AI agent.
    Tracks lead context, matched playbooks, extracted signals,
    and the compiled next-best-action recommendation.
    """
    lead_id: str
    lead_data: Optional[Dict[str, Any]] = None
    history: List[Dict[str, Any]] = Field(default_factory=list)
    lead_context: LeadContext = Field(default_factory=LeadContext)
    sales_playbooks: List[SalesPlaybookEntry] = Field(default_factory=list)
    extracted_signals: List[ExtractedSignal] = Field(default_factory=list)
    next_best_action: Dict[str, Any] = Field(default_factory=dict)
    requires_review: bool = False
