import json
import logging
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Union
from google import genai
from app.schemas.state import (
    AgentState,
    LeadContext,
    SalesPlaybookEntry,
    ExtractedSignal,
)
from app.config import settings


# ---------------------------------------------------------------------------
# Structured LLM output schema
# ---------------------------------------------------------------------------

class NextBestAction(BaseModel):
    """
    Algorithmic Next Best Action compiled by the reasoner node.
    The LLM must return this exact JSON shape with a weighted confidence score.
    """
    action: str = Field(
        ...,
        description="The single, specific, actionable next step to progress the deal."
    )
    reasoning_justification: str = Field(
        ...,
        description=(
            "A detailed justification that cross-references the raw transcript "
            "against the matched SalesPlaybook, citing specific evidence."
        )
    )
    confidence_score: float = Field(
        ...,
        ge=0.0,
        le=1.0,
        description=(
            "Weighted confidence score calculated as: "
            "(budget_alignment_score * 0.40) + (urgency_signal_score * 0.35) + "
            "(historical_playbook_success_rate * 0.25). Each sub-score is 0.0–1.0."
        )
    )


# ---------------------------------------------------------------------------
# Simulated MongoDB data (mirrors seed_sales_db.js)
# ---------------------------------------------------------------------------

_SIMULATED_LEADS: Dict[str, Dict[str, Any]] = {
    "lead_001": {
        "lead_id": "lead_001",
        "company_name": "Apex Analytics Inc.",
        "industry": "FinTech",
        "estimated_budget": 120000,
        "current_vendor": "Datadog",
        "decision_maker": "Priya Sharma, VP Engineering",
        "interactions": [
            {
                "interaction_id": "int_001",
                "raw_transcript": (
                    "We are currently using Datadog for our observability stack but their API rate limits "
                    "are bottlenecking our deployment pipeline. We process roughly 2.3M events per minute "
                    "during peak hours. What is your enterprise pricing for a comparable ingestion rate? "
                    "Also, do you support custom metric aggregation windows?"
                ),
                "status": "pending_review",
                "timestamp": "2026-06-15T00:00:00Z",
            }
        ],
    },
    "lead_002": {
        "lead_id": "lead_002",
        "company_name": "BrightPath Health",
        "industry": "HealthTech",
        "estimated_budget": 250000,
        "current_vendor": "Salesforce Health Cloud",
        "decision_maker": "James Chen, CTO",
        "interactions": [
            {
                "interaction_id": "int_002",
                "raw_transcript": (
                    "James here from BrightPath Health. We have been evaluating alternatives to Salesforce "
                    "Health Cloud because the per-seat licensing model does not scale for our 400+ clinician "
                    "user base. Can you walk us through your HIPAA compliance certifications and whether your "
                    "platform supports HL7 FHIR data interoperability out of the box?"
                ),
                "status": "pending_review",
                "timestamp": "2026-06-14T00:00:00Z",
            }
        ],
    },
    "lead_003": {
        "lead_id": "lead_003",
        "company_name": "DataWeave Solutions",
        "industry": "FinTech",
        "estimated_budget": 310000,
        "current_vendor": "Splunk",
        "decision_maker": "Raj Patel, CIO",
        "interactions": [
            {
                "interaction_id": "int_003",
                "raw_transcript": (
                    "Our Splunk license renewal is coming up in Q3 and we are exploring more cost-effective "
                    "log analytics solutions. Our primary requirements are real-time alerting on financial "
                    "transaction anomalies and SOC 2 Type II compliance. Could you share a technical "
                    "comparison document and arrange a proof-of-concept in our staging environment?"
                ),
                "status": "pending_review",
                "timestamp": "2026-06-12T00:00:00Z",
            }
        ],
    },
    "lead_004": {
        "lead_id": "lead_004",
        "company_name": "EduSpark Global",
        "industry": "EdTech",
        "estimated_budget": 60000,
        "current_vendor": "Canvas LMS",
        "decision_maker": "Sarah Kim, Head of Product",
        "interactions": [
            {
                "interaction_id": "int_004",
                "raw_transcript": (
                    "I lead product at EduSpark. We are looking for a lightweight LMS integration layer "
                    "that can plug into our existing Canvas setup without replacing it. Budget is tight — "
                    "around $60K annually — but we need SSO, custom analytics dashboards, and a student "
                    "engagement API. Is there a starter plan that fits?"
                ),
                "status": "completed",
                "timestamp": "2026-06-11T00:00:00Z",
            }
        ],
    },
    "lead_005": {
        "lead_id": "lead_005",
        "company_name": "HyperLoop AI",
        "industry": "AI/ML",
        "estimated_budget": 450000,
        "current_vendor": "AWS SageMaker",
        "decision_maker": "Alex Novak, CEO",
        "interactions": [
            {
                "interaction_id": "int_005",
                "raw_transcript": (
                    "Alex Novak, CEO of HyperLoop AI. We are scaling our ML training infrastructure beyond "
                    "what SageMaker can handle — specifically, we need multi-region GPU cluster orchestration "
                    "with spot instance failover. Our monthly compute spend is approximately $37K and growing "
                    "20% QoQ. Looking for a managed platform that reduces our MLOps overhead."
                ),
                "status": "pending_review",
                "timestamp": "2026-06-09T00:00:00Z",
            }
        ],
    },
}

_SIMULATED_PLAYBOOKS: List[Dict[str, Any]] = [
    {
        "scenario_name": "Aggressive Competitor Displacement",
        "target_industry": "FinTech",
        "recommended_action": (
            "Offer a free 90-day migration program with dedicated onboarding engineer "
            "and guaranteed SLA parity with incumbent vendor."
        ),
        "discount_cap": 25,
    },
    {
        "scenario_name": "Enterprise Upsell",
        "target_industry": "HealthTech",
        "recommended_action": (
            "Present ROI analysis showing cost savings at scale, bundle compliance "
            "modules, and propose a multi-year commitment discount."
        ),
        "discount_cap": 15,
    },
    {
        "scenario_name": "Startup Land-and-Expand",
        "target_industry": "EdTech",
        "recommended_action": (
            "Start with a free-tier pilot for one department, then expand with "
            "usage-based pricing after demonstrating value in the first quarter."
        ),
        "discount_cap": 40,
    },
]


# ---------------------------------------------------------------------------
# Helper: state accessor (handles both dict and Pydantic)
# ---------------------------------------------------------------------------

def _get(state: Union[AgentState, Dict[str, Any]], key: str, default: Any = None) -> Any:
    if isinstance(state, dict):
        return state.get(key, default)
    return getattr(state, key, default)


# ---------------------------------------------------------------------------
# Graph nodes
# ---------------------------------------------------------------------------

async def planner_node(state: Union[AgentState, Dict[str, Any]]) -> Dict[str, Any]:
    """
    Analyzes the incoming lead ID, validates it exists in the simulated data,
    and sets the execution plan for the downstream retriever and reasoner nodes.
    """
    lead_id = _get(state, "lead_id", "unknown")
    history = list(_get(state, "history", []))

    lead_exists = lead_id in _SIMULATED_LEADS

    plan_steps = [
        "Retrieve target lead firmographic data and interaction transcripts from MongoDB",
        "Match the lead's industry against available SalesPlaybooks",
        "Extract competitor objection signals from raw transcripts",
        "Compile a Next Best Action recommendation with confidence scoring",
    ]

    history.append({
        "node": "planner_node",
        "message": (
            f"Analyzed lead '{lead_id}' — "
            f"{'found in database' if lead_exists else 'NOT found, will use fallback'}. "
            f"Generated {len(plan_steps)}-step execution plan."
        ),
        "status": "success" if lead_exists else "warning",
    })

    return {
        "history": history,
    }


async def retriever_node(state: Union[AgentState, Dict[str, Any]]) -> Dict[str, Any]:
    """
    Simulates querying the MongoDB backend (/api/sales/leads/:id) to retrieve:
      1. The target lead's firmographic data (company, industry, budget, vendor, decision-maker)
         plus their SalesInteraction history.
      2. The specific SalesPlaybook(s) that match the lead's industry.

    Also performs lightweight signal extraction from the raw transcripts to identify
    competitor objections, budget concerns, and feature requests.
    """
    lead_id = _get(state, "lead_id", "unknown")
    history = list(_get(state, "history", []))

    # ── 1. Retrieve lead firmographic data + interactions ──────────────────
    lead_data = _SIMULATED_LEADS.get(lead_id)

    if lead_data:
        lead_context = LeadContext(
            lead_id=lead_data["lead_id"],
            company_name=lead_data["company_name"],
            industry=lead_data["industry"],
            estimated_budget=lead_data["estimated_budget"],
            current_vendor=lead_data["current_vendor"],
            decision_maker=lead_data["decision_maker"],
            interactions=lead_data["interactions"],
        )
    else:
        # Fallback: empty context so downstream nodes can handle gracefully
        lead_context = LeadContext(lead_id=lead_id)
        history.append({
            "node": "retriever_node",
            "message": f"Lead '{lead_id}' not found in simulated MongoDB. Using empty context.",
            "status": "warning",
        })

    # ── 2. Match SalesPlaybooks by industry ────────────────────────────────
    matched_playbooks: List[SalesPlaybookEntry] = []
    for pb in _SIMULATED_PLAYBOOKS:
        if pb["target_industry"].lower() == lead_context.industry.lower():
            matched_playbooks.append(SalesPlaybookEntry(**pb))

    # If no direct industry match, include all playbooks as fallback context
    if not matched_playbooks and lead_context.industry:
        matched_playbooks = [SalesPlaybookEntry(**pb) for pb in _SIMULATED_PLAYBOOKS]
        history.append({
            "node": "retriever_node",
            "message": (
                f"No playbook matched industry '{lead_context.industry}'. "
                f"Loaded all {len(matched_playbooks)} playbooks as fallback context."
            ),
            "status": "info",
        })

    # ── 3. Extract signals from interaction transcripts ────────────────────
    extracted_signals: List[ExtractedSignal] = []

    # Keyword-based signal extraction (deterministic, no LLM needed)
    _SIGNAL_PATTERNS = {
        "competitor_objection": [
            "rate limits", "bottleneck", "does not scale", "maintenance burden",
            "overkill", "eroding our margins", "too slow", "learning curve",
            "licensing model", "cost-effective", "alternatives",
        ],
        "budget_concern": [
            "budget is tight", "budget is constrained", "cost savings",
            "pricing", "per-tb pricing", "enterprise pricing",
        ],
        "feature_request": [
            "do you support", "do you offer", "can you", "can your",
            "is there a", "does your platform support", "out of the box",
            "integration with", "native integration",
        ],
        "compliance_requirement": [
            "hipaa", "soc 2", "pci dss", "iso 27001", "fda 510",
            "compliance", "hl7 fhir",
        ],
    }

    for interaction in lead_context.interactions:
        transcript_lower = interaction.get("raw_transcript", "").lower()
        interaction_id = interaction.get("interaction_id", "")

        for signal_type, keywords in _SIGNAL_PATTERNS.items():
            for keyword in keywords:
                if keyword in transcript_lower:
                    extracted_signals.append(ExtractedSignal(
                        signal_type=signal_type,
                        detail=keyword,
                        source_interaction_id=interaction_id,
                        confidence=0.85,
                    ))
                    break  # one signal per type per interaction

    # ── Finalise history ───────────────────────────────────────────────────
    history.append({
        "node": "retriever_node",
        "message": (
            f"Retrieved firmographic data for '{lead_context.company_name}' "
            f"(industry: {lead_context.industry}, budget: ${lead_context.estimated_budget:,.0f}, "
            f"vendor: {lead_context.current_vendor}). "
            f"Matched {len(matched_playbooks)} playbook(s). "
            f"Extracted {len(extracted_signals)} signal(s) from "
            f"{len(lead_context.interactions)} interaction transcript(s)."
        ),
        "status": "success",
    })

    return {
        "lead_context": lead_context.model_dump() if hasattr(lead_context, "model_dump") else lead_context.dict(),
        "sales_playbooks": [
            pb.model_dump() if hasattr(pb, "model_dump") else pb.dict()
            for pb in matched_playbooks
        ],
        "extracted_signals": [
            sig.model_dump() if hasattr(sig, "model_dump") else sig.dict()
            for sig in extracted_signals
        ],
        "history": history,
    }


# ---------------------------------------------------------------------------
# Historical playbook success rates (simulated from past deal outcomes)
# ---------------------------------------------------------------------------

_PLAYBOOK_SUCCESS_RATES: Dict[str, float] = {
    "Aggressive Competitor Displacement": 0.72,
    "Enterprise Upsell": 0.81,
    "Startup Land-and-Expand": 0.65,
}


async def reasoner_node(state: Union[AgentState, Dict[str, Any]]) -> Dict[str, Any]:
    """
    Algorithmic reasoner that compiles a Next Best Action by instructing the LLM to:

    1. Cross-reference each rawTranscript line against the matched SalesPlaybook's
       recommendedAction, citing specific phrases as evidence.
    2. Calculate a NON-ARBITRARY confidence_score using three weighted factors:
         - budget_alignment_score  (weight: 0.40) — how well the lead's estimatedBudget
           aligns with the playbook's discountCap and typical deal size for the industry.
         - urgency_signal_score    (weight: 0.35) — density and strength of urgency
           indicators in the raw transcript (e.g., renewal deadlines, scaling pressure,
           competitor pain, explicit timeline mentions).
         - historical_playbook_success_rate (weight: 0.25) — pre-computed win rate for
           the matched playbook scenario, injected directly into the prompt.

    Output schema: { "action": str, "reasoning_justification": str, "confidence_score": float }
    """
    lead_id = _get(state, "lead_id", "unknown")
    history = list(_get(state, "history", []))
    lead_context = _get(state, "lead_context", {})
    sales_playbooks = _get(state, "sales_playbooks", [])
    extracted_signals = _get(state, "extracted_signals", [])

    # Serialise sub-models if they're Pydantic objects
    if hasattr(lead_context, "model_dump"):
        lead_context = lead_context.model_dump()
    elif hasattr(lead_context, "dict"):
        lead_context = lead_context.dict()

    # Serialise playbooks / signals the same way
    def _to_dict(obj: Any) -> Any:
        if hasattr(obj, "model_dump"):
            return obj.model_dump()
        if hasattr(obj, "dict"):
            return obj.dict()
        return obj

    sales_playbooks_ser = [_to_dict(pb) for pb in sales_playbooks]
    extracted_signals_ser = [_to_dict(sig) for sig in extracted_signals]

    # Look up historical success rate for the primary matched playbook
    primary_playbook_name = ""
    historical_success_rate = 0.50  # neutral default
    if sales_playbooks_ser:
        primary_playbook_name = sales_playbooks_ser[0].get("scenario_name", "")
        historical_success_rate = _PLAYBOOK_SUCCESS_RATES.get(
            primary_playbook_name, 0.50
        )

    # ── Build the algorithmic system prompt ─────────────────────────────
    system_prompt = f"""You are an algorithmic B2B Sales Reasoner. You MUST output a single JSON object with EXACTLY this schema:

{{
  "action": "<string: the single, specific, actionable next step to progress the deal>",
  "reasoning_justification": "<string: detailed justification cross-referencing the rawTranscript against the SalesPlaybook>",
  "confidence_score": <float: 0.0 to 1.0, calculated using the weighted formula below>
}}

## STRICT RULES

1. **Cross-Reference Requirement**: In "reasoning_justification", you MUST:
   - Quote at least TWO specific phrases from the rawTranscript.
   - Explicitly cite which SalesPlaybook "recommendedAction" those phrases map to.
   - Explain why the recommended action from the playbook addresses the lead's stated pain points.

2. **Confidence Score Calculation**: The "confidence_score" MUST be calculated as a weighted average of three sub-scores. Each sub-score is a float between 0.0 and 1.0. Apply these EXACT weights:

   confidence_score = (budget_alignment_score × 0.40) + (urgency_signal_score × 0.35) + (historical_playbook_success_rate × 0.25)

   **budget_alignment_score** (weight: 40%):
   - 1.0 = The lead's estimatedBudget comfortably exceeds the expected deal size after discountCap is applied.
   - 0.7 = Budget is within range but tight; discount may be needed.
   - 0.4 = Budget is significantly below typical deal size; creative structuring required.
   - 0.1 = Budget is severely misaligned; unlikely to close without executive escalation.

   **urgency_signal_score** (weight: 35%):
   - 1.0 = Explicit deadline or renewal date mentioned, active vendor evaluation in progress.
   - 0.8 = Strong pain language ("bottleneck", "does not scale", "eroding margins") with growth pressure.
   - 0.5 = General dissatisfaction expressed but no timeline pressure.
   - 0.2 = Exploratory inquiry only, no urgency indicators.

   **historical_playbook_success_rate** (weight: 25%):
   - This value is pre-computed and provided to you: {historical_success_rate}
   - Use this value EXACTLY as the third sub-score. Do NOT estimate or override it.

3. In "reasoning_justification", you MUST show your work:
   - State the three sub-scores you assigned and why.
   - Show the weighted calculation that produces the final confidence_score.

4. Do NOT output anything outside the JSON object. No markdown, no commentary, no wrapping."""

    # ── Build the user prompt with all context ──────────────────────────
    user_prompt = (
        f"## Lead Firmographic Profile\n"
        f"{json.dumps(lead_context, indent=2, default=str)}\n\n"
        f"## Raw Interaction Transcripts\n"
    )

    # Inline each raw transcript for direct cross-referencing
    interactions = lead_context.get("interactions", []) if isinstance(lead_context, dict) else []
    for idx, interaction in enumerate(interactions, 1):
        user_prompt += (
            f"--- Transcript {idx} (ID: {interaction.get('interaction_id', 'N/A')}) ---\n"
            f"{interaction.get('raw_transcript', '[No transcript available]')}\n\n"
        )

    user_prompt += (
        f"## Matched SalesPlaybook(s)\n"
        f"{json.dumps(sales_playbooks_ser, indent=2, default=str)}\n\n"
        f"## Extracted Signals (pre-processed)\n"
        f"{json.dumps(extracted_signals_ser, indent=2, default=str)}\n\n"
        f"## Pre-Computed Values\n"
        f"- Historical playbook success rate for '{primary_playbook_name}': {historical_success_rate}\n"
        f"- Lead estimated budget: ${lead_context.get('estimated_budget', 0):,.0f}\n"
        f"- Playbook discount cap: {sales_playbooks_ser[0].get('discount_cap', 'N/A')}%\n"
        if sales_playbooks_ser else
        f"## Pre-Computed Values\n"
        f"- Historical playbook success rate: {historical_success_rate} (no playbook matched)\n"
        f"- Lead estimated budget: ${lead_context.get('estimated_budget', 0):,.0f}\n"
    )

    user_prompt += (
        "\n## INSTRUCTION\n"
        "Cross-reference the raw transcript text against the SalesPlaybook's recommendedAction. "
        "Calculate the confidence_score using the three weighted sub-scores as defined in your instructions. "
        "Output ONLY the JSON object."
    )

    logger = logging.getLogger(__name__)
    api_keys = [k.strip() for k in settings.LLM_API_KEYS.split(",") if k.strip()]
    nba = None
    last_error = None

    for key in api_keys:
        try:
            client = genai.Client(api_key=key)

            response = client.models.generate_content(
                model="gemini-2.5-flash-lite",
                contents=[system_prompt, user_prompt],
                config={
                    "response_mime_type": "application/json",
                    "response_schema": NextBestAction,
                    "temperature": 0.15,  # Low temperature for deterministic scoring
                },
            )

            result_str = response.text
            if not result_str:
                raise ValueError("Empty response from LLM")

            result_data = json.loads(result_str)
            nba = NextBestAction(**result_data)
            break  # Success, exit the retry loop

        except Exception as e:
            last_error = e
            err_str = str(e).lower()
            safe_key = key[-4:] if len(key) >= 4 else "..."
            if "503" in err_str or "429" in err_str or "rate limit" in err_str or "unavailable" in err_str:
                logger.warning(f"HTTP error encountered with API key (ending in ...{safe_key}): {e}. Trying next key...")
                continue
            else:
                logger.warning(f"API call failed with key (ending in ...{safe_key}): {e}. Trying next key...")
                continue

    if not nba:
        # Graceful fallback: compute a rule-based confidence when LLM is unavailable
        fallback_budget_score = 0.5
        fallback_urgency_score = 0.3
        fallback_confidence = (
            (fallback_budget_score * 0.40)
            + (fallback_urgency_score * 0.35)
            + (historical_success_rate * 0.25)
        )

        nba = NextBestAction(
            action="Escalate to senior sales engineer for manual deal review",
            reasoning_justification=(
                f"Automated reasoning unavailable (error: {str(last_error)}). "
                f"Fallback confidence calculated as: "
                f"({fallback_budget_score} × 0.40) + ({fallback_urgency_score} × 0.35) + "
                f"({historical_success_rate} × 0.25) = {fallback_confidence:.2f}. "
                f"Manual review is required to cross-reference the transcript against "
                f"playbook '{primary_playbook_name}' and validate deal progression."
            ),
            confidence_score=round(fallback_confidence, 2),
        )

    nba_dict = nba.model_dump() if hasattr(nba, "model_dump") else nba.dict()
    confidence_score = nba_dict["confidence_score"]
    requires_review = confidence_score < 0.85

    history.append({
        "node": "reasoner_node",
        "message": (
            f"Compiled algorithmic Next Best Action for lead '{lead_id}' "
            f"using weighted confidence formula. "
            f"Score: {confidence_score:.2f} "
            f"(budget×0.40 + urgency×0.35 + playbook_history×0.25). "
            f"Requires review: {requires_review}."
        ),
        "status": "success",
    })

    return {
        "next_best_action": nba_dict,
        "requires_review": requires_review,
        "history": history,
    }
