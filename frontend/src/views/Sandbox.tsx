import React, { useEffect, useState } from 'react';
import {
  fetchLeads,
  createSalesInteraction,
  analyzeLead,
} from '../services/api';
import type { Lead, AnalyzeResponse, SalesInteraction } from '../services/api';

// ---------------------------------------------------------------------------
// Ready-made realistic customer text templates
// ---------------------------------------------------------------------------

const TRANSCRIPT_TEMPLATES = [
  {
    label: 'Pricing Objection — Enterprise Licensing',
    category: 'pricing',
    text: `Hi team,

We have been reviewing your enterprise tier proposal and while the feature set looks strong, the per-seat licensing model is a concern for us. At our current headcount of 350+ users, the annual cost would exceed our allocated budget by roughly 40%. Our CFO is asking whether you can offer volume-based pricing or a flat-rate commitment model for organizations over 200 seats.

We are also comparing against two competitors who are offering a 3-year lock-in discount of 25%. Can you match or exceed this?

Looking forward to your response.`,
  },
  {
    label: 'Technical Scalability Complaint — API Rate Limits',
    category: 'technical',
    text: `Dear Engineering Support,

We have been running your platform in our staging environment for the past 6 weeks and have hit a critical blocker. During peak load testing, our ingestion pipeline consistently hits the 10K requests/minute API rate limit, which causes data loss in our real-time analytics dashboard.

Our production workload requires approximately 45K requests/minute with burst capacity up to 80K. Is there an enterprise API tier that removes these limits? Additionally, we need guaranteed sub-200ms p99 latency for our financial transaction monitoring use case.

This is a deal-breaker for our evaluation. Please advise urgently.`,
  },
  {
    label: 'Competitor Displacement — Migration Concerns',
    category: 'competitor',
    text: `Hello,

We are currently using [Competitor] and our contract expires in Q3. While we are generally satisfied with their core functionality, several pain points are driving us to evaluate alternatives:

1. Their reporting module has not been updated in over 18 months
2. Customer support response times have degraded significantly (now 48+ hours)
3. No native integration with our Salesforce CRM instance

We would need a structured migration plan that includes data export/import tooling, parallel running for at least 30 days, and dedicated onboarding support for our 12-person operations team.

What does your migration program look like?`,
  },
  {
    label: 'Budget Constraint — Startup Tier Request',
    category: 'budget',
    text: `Hi there,

I am the Head of Engineering at a Series A startup. We have been bootstrapping our infrastructure with open-source tools but need something more robust as we scale from 5 to 25 engineers this year.

Our budget is extremely tight — approximately $3,000/month total for all tooling. We need:
- CI/CD pipeline management
- Monitoring and alerting
- On-call rotation scheduling

Is there a startup or growth-stage pricing tier? We would also be open to a case study or co-marketing arrangement in exchange for a deeper discount.

Thanks for considering.`,
  },
  {
    label: 'Compliance & Security — Regulatory Requirements',
    category: 'compliance',
    text: `To whom it may concern,

Our Information Security team is conducting a vendor assessment for your platform. Before we can proceed with the procurement process, we require documentation on the following:

1. SOC 2 Type II certification — current audit report
2. GDPR data processing agreement (DPA)
3. Data residency options — we require all data to remain within EU regions
4. Encryption standards — at-rest and in-transit specifications
5. Penetration test results from the last 12 months

We are on a tight timeline as our board has mandated all vendor assessments be completed by end of quarter. Can you expedite the security questionnaire process?

Regards,
Chief Information Security Officer`,
  },
  {
    label: 'Feature Request — Integration Gap',
    category: 'feature',
    text: `Hi Product Team,

We have been a customer for 8 months and overall our team loves the platform. However, we have identified a critical gap that is blocking us from expanding to additional departments:

We need native bi-directional sync with HubSpot CRM. Currently, our team is manually exporting data and re-importing it weekly, which is costing us approximately 12 hours of engineering time per sprint.

Our contract renewal is in 60 days. If this integration is on your roadmap and deliverable before renewal, we are prepared to upgrade from 50 to 200 seats. If not, we will need to evaluate alternatives that offer this natively.

Can we schedule a call with your product team this week?`,
  },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const Sandbox: React.FC = () => {
  // Lead selection
  const [leads, setLeads] = useState<Lead[]>([]);
  const [selectedLeadId, setSelectedLeadId] = useState('');
  const [isLoadingLeads, setIsLoadingLeads] = useState(true);

  // Template & editor
  const [selectedTemplateIdx, setSelectedTemplateIdx] = useState(-1);
  const [transcriptText, setTranscriptText] = useState('');

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdInteraction, setCreatedInteraction] = useState<SalesInteraction | null>(null);

  // AI Analysis state
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiResult, setAiResult] = useState<AnalyzeResponse | null>(null);
  const [rawJson, setRawJson] = useState('');

  // Feedback
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // ── Load leads from Express backend on mount ────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const data = await fetchLeads();
        setLeads(data);
        if (data.length > 0) setSelectedLeadId(data[0]._id);
      } catch (err: any) {
        setError(err.message || 'Failed to load leads from backend.');
      } finally {
        setIsLoadingLeads(false);
      }
    })();
  }, []);

  // ── Apply template to editor ────────────────────────────────────────────
  const handleSelectTemplate = (idx: number) => {
    setSelectedTemplateIdx(idx);
    setTranscriptText(TRANSCRIPT_TEMPLATES[idx].text);
  };

  // ── Submit: POST to Express + kick off AI Engine ────────────────────────
  const handleSubmit = async () => {
    if (!selectedLeadId) {
      setError('Please select a lead.');
      return;
    }
    if (!transcriptText.trim()) {
      setError('Please enter or select a transcript.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      setSuccessMessage(null);
      setCreatedInteraction(null);
      setAiResult(null);
      setRawJson('');

      // Step 1: Register the interaction in MongoDB via Express
      const interaction = await createSalesInteraction(selectedLeadId, transcriptText.trim());
      setCreatedInteraction(interaction);

      const selectedLead = leads.find((l) => l._id === selectedLeadId);
      if (!selectedLead) throw new Error('Lead not found in local state');

      // Step 2: Kick off the automated agent workflow via FastAPI
      setIsAnalyzing(true);
      const leadForAnalysis = {
        ...selectedLead,
        interactions: [interaction]
      };
      const analysis = await analyzeLead(leadForAnalysis as any);
      setAiResult(analysis);
      setRawJson(JSON.stringify(analysis, null, 2));

      setSuccessMessage(
        `Interaction registered for ${selectedLead.companyName || selectedLeadId} and AI pipeline completed successfully.`
      );
    } catch (err: any) {
      console.error('Sandbox submission error:', err);
      setError(
        err.response?.data?.message ||
        err.response?.data?.detail ||
        err.message ||
        'Submission failed.'
      );
    } finally {
      setIsSubmitting(false);
      setIsAnalyzing(false);
    }
  };

  // ── Derived values ──────────────────────────────────────────────────────
  const selectedLead = leads.find((l) => l._id === selectedLeadId);
  const confidenceScore = aiResult?.next_best_action?.confidence_score ?? 0;
  const confidencePercent = Math.round(confidenceScore * 100);
  const isProcessing = isSubmitting || isAnalyzing;

  return (
    <div className="max-w-5xl mx-auto">
      {/* ── Page Header ─────────────────────────────────────────────────── */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-100 !my-0 !text-left">
          Simulation Sandbox
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Select a lead, compose or choose a customer transcript, and fire the
          full pipeline — the interaction is registered in MongoDB and the AI
          agent workflow generates a Next Best Action recommendation.
        </p>
      </div>

      {/* ── Success Banner ──────────────────────────────────────────────── */}
      {successMessage && (
        <div className="mb-5 p-4 rounded-xl bg-emerald-950/30 border border-emerald-800/40 flex items-start gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="mt-0.5 w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
            <svg className="w-3 h-3 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-emerald-300">Pipeline Complete</p>
            <p className="text-xs text-emerald-400/70 mt-0.5">{successMessage}</p>
          </div>
          <button
            onClick={() => setSuccessMessage(null)}
            className="text-emerald-500 hover:text-emerald-300 text-lg leading-none transition-colors"
          >
            &times;
          </button>
        </div>
      )}

      {/* ── Error Banner ────────────────────────────────────────────────── */}
      {error && (
        <div className="mb-5 p-4 rounded-xl bg-red-950/30 border border-red-900/40 flex items-start gap-3">
          <div className="mt-0.5 w-5 h-5 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
            <svg className="w-3 h-3 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <p className="text-sm text-red-300 flex-1">{error}</p>
          <button
            onClick={() => setError(null)}
            className="text-red-500 hover:text-red-300 text-lg leading-none transition-colors"
          >
            &times;
          </button>
        </div>
      )}

      {/* ── Input Panel ─────────────────────────────────────────────────── */}
      <div className="bg-[#0d0e14] border border-[#1e2030] rounded-xl overflow-hidden mb-5">
        {/* Section header */}
        <div className="px-5 py-3.5 border-b border-[#1e2030] bg-gradient-to-r from-[#aa3bff]/5 to-transparent">
          <h2 className="text-xs font-bold text-gray-300 uppercase tracking-widest">
            Simulation Input
          </h2>
        </div>

        <div className="p-5 flex flex-col gap-5">
          {/* ── Lead Selector ────────────────────────────────────────── */}
          <div>
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block mb-2">
              Target Lead
            </label>
            {isLoadingLeads ? (
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <div className="w-3 h-3 border-2 border-[#aa3bff]/30 border-t-[#aa3bff] rounded-full animate-spin" />
                Loading leads from backend...
              </div>
            ) : (
              <select
                value={selectedLeadId}
                onChange={(e) => setSelectedLeadId(e.target.value)}
                className="w-full bg-[#12131a] border border-[#1e2030] rounded-lg px-4 py-3 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-[#aa3bff]/50 focus:border-[#aa3bff]/50 transition-all"
              >
                {leads.map((lead) => (
                  <option key={lead._id} value={lead._id}>
                    {lead.companyName} — {lead.industry} — {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(lead.estimatedBudget)} budget
                  </option>
                ))}
              </select>
            )}
            {selectedLead && (
              <div className="flex gap-4 mt-2 text-[11px] text-gray-500">
                <span>Decision Maker: <span className="text-gray-400">{selectedLead.decisionMaker}</span></span>
                <span>Incumbent: <span className="text-gray-400">{selectedLead.currentVendor}</span></span>
              </div>
            )}
          </div>

          {/* ── Template Selector ────────────────────────────────────── */}
          <div>
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block mb-2">
              Customer Transcript Templates
            </label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {TRANSCRIPT_TEMPLATES.map((tpl, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSelectTemplate(idx)}
                  className={`text-left p-3 rounded-lg border text-xs transition-all duration-200 ${
                    selectedTemplateIdx === idx
                      ? 'bg-[#aa3bff]/10 border-[#aa3bff]/30 text-[#c084fc]'
                      : 'bg-[#12131a] border-[#1e2030] text-gray-400 hover:border-[#2e303a] hover:text-gray-300'
                  }`}
                >
                  <span className={`text-[9px] uppercase tracking-wider font-bold block mb-1 ${
                    selectedTemplateIdx === idx ? 'text-[#aa3bff]' : 'text-gray-600'
                  }`}>
                    {tpl.category}
                  </span>
                  <span className="font-medium leading-tight line-clamp-2">
                    {tpl.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* ── Text Editor ─────────────────────────────────────────── */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                Raw Transcript Editor
              </label>
              <span className="text-[10px] text-gray-600 tabular-nums">
                {transcriptText.length} characters
              </span>
            </div>
            <textarea
              value={transcriptText}
              onChange={(e) => {
                setTranscriptText(e.target.value);
                setSelectedTemplateIdx(-1);
              }}
              placeholder="Paste or type a customer email, call transcript, or chat log here..."
              rows={12}
              className="w-full bg-[#0a0b0f] border border-[#1e2030] rounded-xl px-4 py-3.5 text-sm text-gray-300 placeholder-gray-700 focus:outline-none focus:ring-2 focus:ring-[#aa3bff]/50 focus:border-[#aa3bff]/50 resize-y leading-relaxed font-mono transition-all"
            />
          </div>

          {/* ── Submit Button ───────────────────────────────────────── */}
          <button
            onClick={handleSubmit}
            disabled={isProcessing || !selectedLeadId || !transcriptText.trim()}
            className="w-full bg-[#aa3bff] hover:bg-[#9333ea] disabled:bg-[#aa3bff]/20 disabled:text-gray-500 text-white font-semibold py-3.5 px-6 rounded-xl transition-all duration-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#aa3bff]/50 flex items-center justify-center gap-2.5 shadow-lg shadow-[#aa3bff]/10"
          >
            {isSubmitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Registering in MongoDB...
              </>
            ) : isAnalyzing ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Running AI Pipeline...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Submit Interaction & Run Pipeline
              </>
            )}
          </button>
        </div>
      </div>

      {/* ── Results Section ──────────────────────────────────────────────── */}
      {(createdInteraction || aiResult) && (
        <div className="flex flex-col gap-5">
          {/* ── MongoDB Registration Confirmation ────────────────────── */}
          {createdInteraction && (
            <div className="bg-[#0d0e14] border border-[#1e2030] rounded-xl p-5">
              <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3">
                MongoDB Registration
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <span className="text-[9px] text-gray-600 uppercase block">Interaction ID</span>
                  <span className="text-xs text-gray-300 font-mono">{createdInteraction._id}</span>
                </div>
                <div>
                  <span className="text-[9px] text-gray-600 uppercase block">Lead ID</span>
                  <span className="text-xs text-gray-300 font-mono">{createdInteraction.leadId}</span>
                </div>
                <div>
                  <span className="text-[9px] text-gray-600 uppercase block">Status</span>
                  <span className="text-xs text-amber-400 font-semibold">{createdInteraction.status}</span>
                </div>
                <div>
                  <span className="text-[9px] text-gray-600 uppercase block">Timestamp</span>
                  <span className="text-xs text-gray-300">{new Date(createdInteraction.timestamp).toLocaleString()}</span>
                </div>
              </div>
            </div>
          )}

          {/* ── AI Output Cards ──────────────────────────────────────── */}
          {aiResult && (
            <>
              {/* NBA + Confidence */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2 bg-[#0d0e14] border border-[#1e2030] rounded-xl p-5">
                  <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">
                    Next Best Action
                  </h3>
                  <p className="text-base font-semibold text-gray-100 leading-snug">
                    {aiResult.next_best_action?.action || 'N/A'}
                  </p>
                </div>
                <div className="bg-[#0d0e14] border border-[#1e2030] rounded-xl p-5 flex flex-col items-center justify-center">
                  <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">
                    Confidence
                  </h3>
                  <span className={`text-3xl font-bold tabular-nums ${
                    confidenceScore >= 0.85 ? 'text-emerald-400' :
                    confidenceScore >= 0.60 ? 'text-amber-400' : 'text-red-400'
                  }`}>
                    {confidencePercent}%
                  </span>
                  <div className="w-full bg-[#1e2030] h-2.5 rounded-full mt-2.5 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ease-out ${
                        confidenceScore >= 0.85 ? 'bg-emerald-500' :
                        confidenceScore >= 0.60 ? 'bg-amber-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${confidencePercent}%` }}
                    />
                  </div>
                  <span className="text-[9px] text-gray-600 mt-1.5">budget×0.40 + urgency×0.35 + history×0.25</span>
                </div>
              </div>

              {/* Reasoning */}
              <div className="bg-[#0d0e14] border border-[#1e2030] rounded-xl p-5">
                <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">
                  Reasoning Justification
                </h3>
                <p className="text-sm text-gray-400 leading-relaxed whitespace-pre-wrap">
                  {aiResult.next_best_action?.reasoning_justification || 'N/A'}
                </p>
              </div>

              {/* Pipeline Trace */}
              <div className="bg-[#0d0e14] border border-[#1e2030] rounded-xl p-5">
                <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3">
                  Pipeline Execution Trace
                </h3>
                <div className="flex flex-col gap-2">
                  {aiResult.history.map((entry, i) => (
                    <div key={i} className="flex items-start gap-3 text-xs">
                      <span className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${
                        entry.status === 'success' ? 'bg-emerald-500' :
                        entry.status === 'warning' ? 'bg-amber-500' : 'bg-gray-600'
                      }`} />
                      <div className="flex-1 min-w-0">
                        <span className="text-[#c084fc] font-semibold">{entry.node}</span>
                        <span className="text-gray-600 mx-1.5">→</span>
                        <span className="text-gray-400">{entry.message}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Signals + Playbooks */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-[#0d0e14] border border-[#1e2030] rounded-xl p-5">
                  <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3">
                    Extracted Signals ({aiResult.extracted_signals.length})
                  </h3>
                  {aiResult.extracted_signals.length === 0 ? (
                    <p className="text-xs text-gray-600">No signals extracted.</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {aiResult.extracted_signals.map((sig, i) => (
                        <span key={i} className="text-[10px] px-2 py-1 rounded-md bg-[#12131a] border border-[#1e2030] text-gray-400">
                          <span className="text-[#c084fc] font-semibold">{sig.signal_type}</span>
                          <span className="text-gray-600 mx-1">→</span>
                          {sig.detail}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="bg-[#0d0e14] border border-[#1e2030] rounded-xl p-5">
                  <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3">
                    Matched Playbooks ({aiResult.sales_playbooks.length})
                  </h3>
                  {aiResult.sales_playbooks.length === 0 ? (
                    <p className="text-xs text-gray-600">No playbooks matched.</p>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {aiResult.sales_playbooks.map((pb, i) => (
                        <div key={i} className="text-xs bg-[#12131a] border border-[#1e2030] rounded-lg px-3 py-2">
                          <span className="text-[#c084fc] font-semibold">{pb.scenario_name}</span>
                          <span className="text-gray-600 block mt-0.5">
                            {pb.target_industry} · Max {pb.discount_cap}% discount
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Raw JSON */}
              <div className="bg-[#0d0e14] border border-[#1e2030] rounded-xl overflow-hidden">
                <div className="px-5 py-3 border-b border-[#1e2030] flex items-center justify-between">
                  <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                    Raw JSON Response
                  </h3>
                  <button
                    onClick={() => navigator.clipboard.writeText(rawJson)}
                    className="text-[10px] text-[#c084fc] hover:text-[#aa3bff] font-medium transition-colors"
                  >
                    Copy to clipboard
                  </button>
                </div>
                <pre className="p-5 text-xs text-gray-400 overflow-x-auto max-h-[400px] overflow-y-auto leading-relaxed font-mono">
                  {rawJson}
                </pre>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};
