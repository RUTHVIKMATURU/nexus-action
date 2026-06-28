import React, { useEffect, useState } from 'react';
import {
  fetchLeads,
  fetchLeadDetails,
  updateInteractionStatus,
  analyzeLead,
} from '../services/api';
import type {
  Lead,
  LeadWithInteractions,
  AnalyzeResponse,
  SalesInteraction,
} from '../services/api';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const INDUSTRY_COLORS: Record<string, string> = {
  FinTech:               'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  HealthTech:            'bg-sky-500/10 text-sky-400 border-sky-500/20',
  DevTools:              'bg-violet-500/10 text-violet-400 border-violet-500/20',
  EdTech:                'bg-amber-500/10 text-amber-400 border-amber-500/20',
  'Supply Chain':        'bg-orange-500/10 text-orange-400 border-orange-500/20',
  CleanTech:             'bg-lime-500/10 text-lime-400 border-lime-500/20',
  'AI/ML':               'bg-fuchsia-500/10 text-fuchsia-400 border-fuchsia-500/20',
  AdTech:                'bg-pink-500/10 text-pink-400 border-pink-500/20',
  Cybersecurity:         'bg-red-500/10 text-red-400 border-red-500/20',
  Telecom:               'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
  'HR Tech':             'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
  'Cloud Infrastructure':'bg-blue-500/10 text-blue-400 border-blue-500/20',
};

const getIndustryClasses = (industry: string) =>
  INDUSTRY_COLORS[industry] || 'bg-gray-500/10 text-gray-400 border-gray-500/20';

const formatBudget = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

const getConfidenceColor = (score: number) => {
  if (score >= 0.85) return { bar: 'bg-emerald-500', text: 'text-emerald-400', glow: 'shadow-emerald-500/20', border: 'border-emerald-500/30' };
  if (score >= 0.60) return { bar: 'bg-amber-500',   text: 'text-amber-400',   glow: 'shadow-amber-500/20', border: 'border-amber-500/30' };
  return                       { bar: 'bg-red-500',     text: 'text-red-400',     glow: 'shadow-red-500/20', border: 'border-red-500/30' };
};

const getStatusBadge = (status: string) => {
  switch (status) {
    case 'approved':       return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
    case 'rejected':       return 'bg-red-500/15 text-red-400 border-red-500/30';
    case 'completed':      return 'bg-blue-500/15 text-blue-400 border-blue-500/30';
    case 'pending_review': return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
    default:               return 'bg-gray-500/15 text-gray-400 border-gray-500/30';
  }
};

// Sub-score parser
const parseSubScores = (text: string) => {
  let budget = 0, urgency = 0, history = 0;
  const budgetMatch = text.match(/([0-9]*\.?[0-9]+)\s*[\*×x]\s*0\.40/i);
  const urgencyMatch = text.match(/([0-9]*\.?[0-9]+)\s*[\*×x]\s*0\.35/i);
  const historyMatch = text.match(/([0-9]*\.?[0-9]+)\s*[\*×x]\s*0\.25/i);
  
  if (budgetMatch) budget = parseFloat(budgetMatch[1]);
  if (urgencyMatch) urgency = parseFloat(urgencyMatch[1]);
  if (historyMatch) history = parseFloat(historyMatch[1]);
  
  return { budget, urgency, history };
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const Dashboard: React.FC = () => {
  // Data state
  const [leads, setLeads] = useState<Lead[]>([]);
  const [selectedLead, setSelectedLead] = useState<LeadWithInteractions | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // AI Engine state
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<AnalyzeResponse | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  // Loading & action state
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<'approve' | 'reject' | null>(null);

  // ── Load leads on mount ─────────────────────────────────────────────────
  useEffect(() => {
    loadLeads();
  }, []);

  const loadLeads = async () => {
    try {
      setIsLoadingList(true);
      const data = await fetchLeads();
      setLeads(data);
    } catch (err: any) {
      console.error('Failed to load leads:', err);
      const backendMessage = err.response?.data?.message;
      setGlobalError(backendMessage || err.message || 'Failed to load leads.');
    } finally {
      setIsLoadingList(false);
    }
  };

  // ── Select lead → fetch details + trigger AI analysis ───────────────────
  const handleSelectLead = async (lead: Lead) => {
    setSelectedLead(null);
    setAiAnalysis(null);
    setAnalysisError(null);
    setActionMessage(null);
    setIsLoadingDetails(true);

    try {
      const detailedLead = await fetchLeadDetails(lead._id);
      setSelectedLead(detailedLead);

      // Auto-trigger AI Engine analysis
      setIsAnalyzing(true);
      const analysis = await analyzeLead(lead._id);
      setAiAnalysis(analysis);
    } catch (err: any) {
      console.error('Error fetching lead details or AI analysis:', err);
      setAnalysisError(err.message || 'Failed to complete AI analysis flow.');
      setGlobalError(err.message || 'Failed to fetch lead details. Check authentication.');
    } finally {
      setIsLoadingDetails(false);
      setIsAnalyzing(false);
    }
  };

  // ── Approve / Reject — PATCH to /api/sales/interactions/:id/status ──────
  const handleAction = async (action: 'approve' | 'reject') => {
    if (!selectedLead) return;

    const latestInteraction = selectedLead.interactions?.[0];
    if (!latestInteraction) {
      setActionMessage({ type: 'error', text: 'No pending interaction found to update.' });
      return;
    }

    try {
      setPendingAction(action);
      const newStatus = action === 'approve' ? 'approved' : 'rejected';
      await updateInteractionStatus(latestInteraction._id, newStatus as 'approved' | 'rejected');

      setActionMessage({
        type: 'success',
        text: `Interaction successfully ${newStatus}. Workflow state updated.`,
      });

      // Refresh lead details (updates selectedLead immediately without full page reload)
      const refreshed = await fetchLeadDetails(selectedLead._id);
      setSelectedLead(refreshed);
    } catch (err: any) {
      console.error('Failed to update interaction status:', err);
      setActionMessage({
        type: 'error',
        text: err.response?.data?.message || 'Failed to update interaction status.',
      });
    } finally {
      setPendingAction(null);
    }
  };

  // ── Filter leads by search ──────────────────────────────────────────────
  const filteredLeads = leads.filter(
    (lead) =>
      lead.companyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lead.industry.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // ── AI output accessors ─────────────────────────────────────────────────
  const nba = aiAnalysis?.next_best_action;
  const confidenceScore = nba?.confidence_score ?? 0;
  const confidencePercent = Math.round(confidenceScore * 100);
  const colors = getConfidenceColor(confidenceScore);
  const subScores = parseSubScores(nba?.reasoning_justification || '');

  // ── Determine Active Status ─────────────────────────────────────────────
  const latestInteraction = selectedLead?.interactions?.[0];
  const isPendingReview = latestInteraction?.status === 'pending_review';

  return (
    <div className="relative">
      {/* ── Global Error Banner ─────────────────────────────────────────── */}
      {globalError && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-50 bg-red-950/90 border border-red-800 text-red-200 px-5 py-3 rounded-xl shadow-2xl shadow-red-900/30 flex items-start gap-4 max-w-lg w-full backdrop-blur-sm text-left">
          <span className="text-sm">{globalError}</span>
          <button
            onClick={() => setGlobalError(null)}
            className="text-red-400 hover:text-white font-bold text-lg leading-none focus:outline-none transition-colors ml-auto"
          >
            &times;
          </button>
        </div>
      )}

      <div className="flex flex-col lg:flex-row min-h-[calc(100vh-80px)] bg-[#050508] border border-[#1e2030] rounded-2xl overflow-hidden shadow-2xl shadow-black/60">
        {/* ════════════════════════════════════════════════════════════════ */}
        {/* LEFT PANEL — Lead Directory                                     */}
        {/* ════════════════════════════════════════════════════════════════ */}
        <div className="w-full lg:w-[380px] border-r border-[#1e2030] bg-[#0a0b0f] flex flex-col z-10 shadow-[4px_0_24px_rgba(0,0,0,0.4)] text-left">
          {/* Header */}
          <div className="p-6 border-b border-[#1e2030] bg-[#0d0e14]">
            <div className="flex items-start gap-2 mb-1">
              <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)] animate-pulse mt-1" />
              <h2 className="text-sm font-bold text-gray-100 uppercase tracking-widest">
                Lead Pipeline
              </h2>
            </div>
            <p className="text-[11px] text-gray-500 mb-4">
              {leads.length} active opportunities
            </p>
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search pipeline..."
                className="w-full pl-9 pr-4 py-2.5 text-sm bg-[#15161f] border border-[#1e2030] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#aa3bff]/50 text-gray-200 placeholder-gray-600 transition-all shadow-inner"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {/* Lead List */}
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {isLoadingList ? (
              <div className="p-10 text-left flex flex-col items-start gap-3">
                <div className="w-6 h-6 border-2 border-[#aa3bff]/20 border-t-[#aa3bff] rounded-full animate-spin" />
                <span className="text-xs text-gray-500 font-medium">Loading pipeline...</span>
              </div>
            ) : filteredLeads.length === 0 ? (
              <div className="p-10 text-left text-sm text-gray-600">No leads found.</div>
            ) : (
              filteredLeads.map((lead) => {
                const isSelected = selectedLead?._id === lead._id;
                return (
                  <button
                    key={lead._id}
                    onClick={() => handleSelectLead(lead)}
                    className={`w-full text-left p-4 transition-all duration-200 border-b border-[#1e2030]/50 relative ${
                      isSelected
                        ? 'bg-[#15161f] border-l-2 border-l-[#aa3bff]'
                        : 'hover:bg-[#12131a] border-l-2 border-l-transparent'
                    }`}
                  >
                    {isSelected && (
                      <div className="absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-[#aa3bff]/10 to-transparent pointer-events-none" />
                    )}
                    <div className="flex items-start justify-between gap-3 relative z-10">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start gap-2">
                          <h3 className={`font-semibold text-sm truncate ${isSelected ? 'text-gray-100' : 'text-gray-300'}`}>
                            {lead.companyName}
                          </h3>
                          {isSelected && (isLoadingDetails || isAnalyzing) && (
                            <div className="w-3 h-3 border-2 border-[#aa3bff]/30 border-t-[#aa3bff] rounded-full animate-spin flex-shrink-0 mt-0.5" />
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mt-1 truncate">
                          {lead.decisionMaker}
                        </p>
                      </div>
                      <span className={`text-[10px] px-2 py-0.5 rounded-md border font-semibold flex-shrink-0 ${getIndustryClasses(lead.industry)}`}>
                        {lead.industry}
                      </span>
                    </div>
                    <div className="flex items-start justify-between mt-3 relative z-10">
                      <span className="text-xs font-medium text-gray-400">
                        {formatBudget(lead.estimatedBudget)}
                      </span>
                      <span className="text-[10px] text-gray-500 uppercase tracking-wider">
                        vs {lead.currentVendor}
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* RIGHT PANEL — AI Output & Command Center                        */}
        {/* ════════════════════════════════════════════════════════════════ */}
        <div className="flex-1 flex flex-col overflow-y-auto bg-gradient-to-b from-[#0a0b0f] to-[#050508] relative text-left">
          {!selectedLead ? (
            /* ── Empty state ──────────────────────────────────────────── */
            <div className="flex-1 flex flex-col items-start justify-center p-12 text-left">
              <div className="w-24 h-24 rounded-full bg-[#0d0e14] border border-[#1e2030] shadow-[0_0_40px_rgba(0,0,0,0.5)] flex items-center justify-center mb-6">
                <svg className="w-10 h-10 text-[#aa3bff]/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-200 tracking-wide">Enterprise Sales Engine</h3>
              <p className="text-sm text-gray-500 mt-3 max-w-md leading-relaxed">
                Select an active opportunity from the pipeline. The LangGraph orchestration engine will process real-time transcripts against organizational playbooks to synthesize the optimal engagement strategy.
              </p>
            </div>
          ) : (
            /* ── Active lead view ─────────────────────────────────────── */
            <div className="p-6 md:p-8 flex flex-col gap-6 max-w-5xl w-full mx-auto min-h-full">
              
              {/* ── Top Header Section ──────────────────────────────────── */}
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 pb-6 border-b border-[#1e2030]/60">
                <div className="flex-1">
                  <span className={`text-[10px] px-2.5 py-1 rounded-md border font-semibold uppercase tracking-wider mb-3 inline-block ${getIndustryClasses(selectedLead.industry)}`}>
                    {selectedLead.industry}
                  </span>
                  <h1 className="text-3xl font-bold text-gray-100 tracking-tight mt-1">
                    {selectedLead.companyName}
                  </h1>
                  <div className="flex items-start gap-4 mt-3 text-sm text-gray-400">
                    <span className="flex items-center gap-1.5">
                      <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                      {selectedLead.decisionMaker}
                    </span>
                    <span className="w-1 h-1 rounded-full bg-gray-700 mt-2" />
                    <span className="flex items-center gap-1.5 text-gray-300 font-medium">
                      <svg className="w-4 h-4 text-emerald-500/70" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      {formatBudget(selectedLead.estimatedBudget)}
                    </span>
                  </div>
                </div>
                
                <div className="bg-[#12131a] border border-[#1e2030] rounded-xl px-5 py-3 shadow-inner flex flex-col items-start min-w-[200px]">
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold mb-1">Incumbent Vendor</p>
                  <p className="text-base font-bold text-gray-200 flex items-start gap-2 mt-1">
                    <span className="w-2 h-2 rounded-full bg-red-500/50 mt-1" />
                    {selectedLead.currentVendor}
                  </p>
                </div>
              </div>

              {/* ── Main Engine Layout ──────────────────────────────────── */}
              <div className="flex flex-col lg:flex-row gap-6 flex-1 min-h-[500px]">
                
                {/* AI ACTION PANEL (Left Column, Large) */}
                <div className="flex-1 flex flex-col gap-6 text-left">
                  {/* Clean Card Container with subtle background separation */}
                  <div className="bg-[#0d0e14] border border-[#1e2030] rounded-2xl shadow-2xl flex flex-col relative overflow-hidden h-full">
                    
                    {/* Subtle Top Gradient */}
                    <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-[#aa3bff]/30 to-transparent opacity-50" />
                    
                    {isAnalyzing || isLoadingDetails ? (
                      <div className="flex-1 flex flex-col items-start justify-center p-12">
                        <div className="relative mb-6">
                          <div className="w-16 h-16 border-4 border-[#1e2030] rounded-full shadow-inner" />
                          <div className="absolute inset-0 w-16 h-16 border-4 border-transparent border-t-[#aa3bff] rounded-full animate-spin shadow-[0_0_15px_rgba(170,59,255,0.4)]" />
                        </div>
                        <h4 className="text-gray-200 font-semibold mb-2">Synthesizing Strategy</h4>
                        <p className="text-xs text-gray-500 max-w-xs text-left">Processing firmographic context and interaction history through algorithmic reasoning layer...</p>
                      </div>
                    ) : analysisError ? (
                      <div className="p-8 text-left">
                        <div className="p-5 rounded-xl bg-red-950/20 border border-red-900/40 flex items-start gap-3">
                          <svg className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                          <div>
                            <h5 className="text-red-300 font-semibold mb-1">Engine Fault</h5>
                            <p className="text-sm text-red-400/80">{analysisError}</p>
                          </div>
                        </div>
                      </div>
                    ) : nba ? (
                      <div className="flex flex-col flex-1 p-6 md:p-8 text-left">
                        
                        {/* Primary Next Best Action in Bold Headline Block */}
                        <div className="mb-8 flex flex-col items-start">
                          <div className="flex items-start gap-3 mb-4">
                            <span className="flex h-2.5 w-2.5 relative mt-1">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#aa3bff] opacity-50" />
                              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#aa3bff]" />
                            </span>
                            <span className="text-[11px] font-bold text-[#c084fc] uppercase tracking-[0.2em]">
                              Next Best Action
                            </span>
                          </div>
                          <h2 className="text-2xl md:text-3xl font-extrabold text-white leading-tight tracking-tight drop-shadow-sm text-left">
                            {nba.action}
                          </h2>
                        </div>

                        {/* Visual Confidence Meter below the action */}
                        <div className="mb-10 bg-[#12131a] border border-[#1e2030] rounded-xl p-5 shadow-inner">
                          <div className="flex flex-row items-end justify-between mb-3 w-full">
                            <div className="flex flex-col items-start">
                              <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Algorithmic Confidence</h4>
                              <p className="text-[10px] text-gray-600 mt-1">Weighted probability of success</p>
                            </div>
                            <span className={`text-4xl font-extrabold tabular-nums tracking-tighter ${colors.text} drop-shadow-lg`}>
                              {confidencePercent}%
                            </span>
                          </div>
                          <div className="w-full bg-[#0a0b0f] h-4 rounded-full overflow-hidden shadow-inner border border-[#1e2030]/50">
                            <div
                              className={`h-full rounded-full transition-all duration-1000 ease-out relative overflow-hidden ${colors.bar}`}
                              style={{ width: `${confidencePercent}%` }}
                            >
                              {/* Glint effect */}
                              <div className="absolute top-0 left-0 bottom-0 w-full bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full animate-[shimmer_2s_infinite]" />
                            </div>
                          </div>
                          
                          {/* Sub-scores broken into a clean vertical stack of subtle rows */}
                          <div className="mt-5 flex flex-col gap-3">
                            <div className="flex flex-col gap-1 p-3 rounded-lg border border-[#1e2030]/60 bg-[#0d0e14] text-left">
                              <span className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">Budget Alignment</span>
                              <div className="flex items-center justify-between w-full">
                                <span className="text-sm font-bold text-gray-300">{(subScores.budget * 100).toFixed(0)}%</span>
                                <span className="text-[9px] text-gray-600 font-medium bg-[#1a1c26] px-1.5 py-0.5 rounded">wt: 40%</span>
                              </div>
                            </div>
                            <div className="flex flex-col gap-1 p-3 rounded-lg border border-[#1e2030]/60 bg-[#0d0e14] text-left">
                              <span className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">Urgency Signal</span>
                              <div className="flex items-center justify-between w-full">
                                <span className="text-sm font-bold text-gray-300">{(subScores.urgency * 100).toFixed(0)}%</span>
                                <span className="text-[9px] text-gray-600 font-medium bg-[#1a1c26] px-1.5 py-0.5 rounded">wt: 35%</span>
                              </div>
                            </div>
                            <div className="flex flex-col gap-1 p-3 rounded-lg border border-[#1e2030]/60 bg-[#0d0e14] text-left">
                              <span className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">Historical Success</span>
                              <div className="flex items-center justify-between w-full">
                                <span className="text-sm font-bold text-gray-300">{(subScores.history * 100).toFixed(0)}%</span>
                                <span className="text-[9px] text-gray-600 font-medium bg-[#1a1c26] px-1.5 py-0.5 rounded">wt: 25%</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Reasoning block */}
                        <div className="mb-8">
                          <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3 flex items-start gap-2">
                            <svg className="w-3 h-3 text-gray-600 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                            Reasoning Justification
                          </h4>
                          <p className="text-sm text-gray-400 leading-relaxed bg-[#12131a]/50 p-4 rounded-xl border border-[#1e2030]/50 whitespace-pre-wrap font-medium text-left">
                            {nba.reasoning_justification}
                          </p>
                        </div>

                        {/* Push buttons to absolute bottom */}
                        <div className="mt-auto">
                          {actionMessage && (
                            <div className={`mb-4 p-3.5 rounded-xl text-sm border font-medium flex items-start gap-3 ${
                              actionMessage.type === 'success'
                                ? 'bg-emerald-950/30 border-emerald-900/50 text-emerald-300'
                                : 'bg-red-950/30 border-red-900/50 text-red-300'
                            }`}>
                              {actionMessage.type === 'success' ? (
                                <svg className="w-4 h-4 text-emerald-400 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                              ) : (
                                <svg className="w-4 h-4 text-red-400 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                              )}
                              <span className="text-left">{actionMessage.text}</span>
                            </div>
                          )}

                          {aiAnalysis!.requires_review && !actionMessage && (
                            <div className="mb-4 flex items-start gap-3 px-4 py-3 rounded-xl bg-amber-950/30 border border-amber-900/50 text-amber-300 text-xs font-medium text-left">
                              <svg className="w-4 h-4 flex-shrink-0 text-amber-500 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                              <span>Human review required due to sub-85% confidence score.</span>
                            </div>
                          )}

                          {/* Conditional render of Approve/Reject buttons or Status Badge */}
                          {isPendingReview ? (
                            <div className="flex flex-col sm:flex-row gap-3">
                              <button
                                onClick={() => handleAction('approve')}
                                disabled={pendingAction !== null}
                                className="flex-1 bg-emerald-600/90 hover:bg-emerald-500 text-white font-bold py-3.5 px-6 rounded-xl transition-all duration-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 flex items-start justify-center sm:justify-start gap-2.5 shadow-[0_4px_14px_rgba(16,185,129,0.2)] hover:shadow-[0_6px_20px_rgba(16,185,129,0.3)] disabled:opacity-50 disabled:cursor-not-allowed border border-emerald-500/50"
                              >
                                {pendingAction === 'approve' ? (
                                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mt-0.5" />
                                ) : (
                                  <svg className="w-4 h-4 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                                )}
                                <span>{pendingAction === 'approve' ? 'Approving...' : 'Approve Execution'}</span>
                              </button>
                              <button
                                onClick={() => handleAction('reject')}
                                disabled={pendingAction !== null}
                                className="flex-1 bg-transparent hover:bg-red-950/40 text-red-400 font-bold py-3.5 px-6 rounded-xl transition-all duration-300 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/50 flex items-start justify-center sm:justify-start gap-2.5 border border-red-900/50 hover:border-red-500/50 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {pendingAction === 'reject' ? (
                                  <div className="w-4 h-4 border-2 border-red-400/30 border-t-red-400 rounded-full animate-spin mt-0.5" />
                                ) : (
                                  <svg className="w-4 h-4 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                                )}
                                <span>{pendingAction === 'reject' ? 'Rejecting...' : 'Reject Action'}</span>
                              </button>
                            </div>
                          ) : (
                            <div className="flex flex-col sm:flex-row gap-3">
                              <div className={`flex-1 flex items-start gap-2.5 px-6 py-3.5 rounded-xl border font-bold text-sm ${
                                latestInteraction?.status === 'approved' 
                                  ? 'bg-emerald-950/30 border-emerald-900/50 text-emerald-400' 
                                  : latestInteraction?.status === 'rejected'
                                    ? 'bg-red-950/30 border-red-900/50 text-red-400'
                                    : 'bg-gray-950/30 border-gray-900/50 text-gray-400'
                              }`}>
                                {latestInteraction?.status === 'approved' ? (
                                  <svg className="w-4 h-4 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                                ) : latestInteraction?.status === 'rejected' ? (
                                  <svg className="w-4 h-4 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                                ) : (
                                  <svg className="w-4 h-4 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                                )}
                                <span className="text-left">
                                  Action {latestInteraction?.status ? latestInteraction.status.charAt(0).toUpperCase() + latestInteraction.status.slice(1) : 'Processed'}
                                </span>
                              </div>
                            </div>
                          )}
                        </div>

                      </div>
                    ) : (
                      <div className="flex-1 flex items-start justify-center p-12 text-sm text-gray-600 text-left">
                        No AI analysis output available.
                      </div>
                    )}
                  </div>
                </div>

                {/* META PANEL (Right Column, Narrow) */}
                <div className="w-full lg:w-[280px] flex flex-col gap-6 text-left">
                  {/* Playbooks & Signals */}
                  {aiAnalysis && !isAnalyzing && nba && (
                    <div className="flex flex-col gap-6">
                      
                      {/* Playbooks */}
                      <div className="bg-[#0d0e14] border border-[#1e2030] rounded-xl p-5 shadow-lg flex flex-col items-start">
                        <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-4">
                          Matched Playbooks
                        </h4>
                        <div className="flex flex-col gap-3 w-full">
                          {aiAnalysis.sales_playbooks.length === 0 ? (
                            <p className="text-xs text-gray-600">No playbooks matched.</p>
                          ) : (
                            aiAnalysis.sales_playbooks.map((pb, i) => (
                              <div key={i} className="flex items-start gap-3 bg-[#15161f] p-3 rounded-lg border border-[#1e2030]/50 w-full text-left">
                                <div className="mt-0.5 p-1.5 rounded bg-[#aa3bff]/10 text-[#c084fc] flex-shrink-0">
                                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>
                                </div>
                                <div>
                                  <p className="text-xs font-semibold text-gray-200 leading-tight mb-1">{pb.scenario_name}</p>
                                  <p className="text-[10px] text-gray-500">Max {pb.discount_cap}% discount</p>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                      {/* Signals */}
                      <div className="bg-[#0d0e14] border border-[#1e2030] rounded-xl p-5 shadow-lg flex flex-col items-start">
                        <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-4">
                          Extracted Signals
                        </h4>
                        <div className="flex flex-col gap-2 w-full text-left">
                          {aiAnalysis.extracted_signals.length === 0 ? (
                            <p className="text-xs text-gray-600">No signals found.</p>
                          ) : (
                            aiAnalysis.extracted_signals.map((sig, i) => (
                              <div key={i} className="px-3 py-2 bg-[#15161f] border border-[#1e2030]/50 rounded-lg">
                                <span className="text-[10px] font-bold text-[#c084fc] block mb-1">{sig.signal_type}</span>
                                <span className="text-xs text-gray-400 leading-tight block">{sig.detail}</span>
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                    </div>
                  )}

                  {/* Interaction History */}
                  <div className="bg-[#0d0e14] border border-[#1e2030] rounded-xl p-5 shadow-lg flex-1 overflow-y-auto flex flex-col items-start text-left">
                    <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-4 flex items-start justify-between w-full">
                      Activity Log
                      <span className="bg-[#1e2030] text-gray-400 px-2 py-0.5 rounded-full text-[9px] flex-shrink-0">
                        {selectedLead.interactions?.length || 0}
                      </span>
                    </h4>
                    <div className="flex flex-col gap-4 relative w-full">
                      <div className="absolute left-3 top-2 bottom-2 w-px bg-[#1e2030]" />
                      {!selectedLead.interactions || selectedLead.interactions.length === 0 ? (
                        <p className="text-xs text-gray-600 text-left py-4 relative z-10 bg-[#0d0e14]">
                          No prior interactions.
                        </p>
                      ) : (
                        selectedLead.interactions.map((interaction: SalesInteraction, idx) => (
                          <div key={interaction._id} className="relative z-10 flex items-start gap-4 text-left">
                            <div className="w-6 h-6 rounded-full bg-[#15161f] border-2 border-[#1e2030] flex items-center justify-center flex-shrink-0 mt-0.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-gray-500" />
                            </div>
                            <div className="flex-1 bg-[#15161f] border border-[#1e2030]/50 rounded-lg p-3">
                              <div className="flex items-start justify-between mb-2 gap-2">
                                <span className="text-[9px] text-gray-500 uppercase font-medium mt-0.5">
                                  {new Date(interaction.timestamp).toLocaleDateString()}
                                </span>
                                <span className={`text-[8px] px-1.5 py-0.5 rounded uppercase font-bold tracking-wider flex-shrink-0 ${getStatusBadge(interaction.status)}`}>
                                  {interaction.status.replace('_', ' ')}
                                </span>
                              </div>
                              <p className="text-xs text-gray-300 leading-relaxed line-clamp-4 font-mono">
                                {interaction.rawTranscript}
                              </p>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>

              </div>
            </div>
          )}
        </div>
      </div>
      
      <style>{`
        @keyframes shimmer {
          100% { transform: translateX(100%); }
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #1e2030;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #2e303a;
        }
      `}</style>
    </div>
  );
};
