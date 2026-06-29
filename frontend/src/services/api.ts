import axios from 'axios';

// Pull base URLs from Vite's import.meta.env with safe local fallback defaults
const EXPRESS_API_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api/sales';
const AI_ENGINE_URL = import.meta.env.VITE_ENGINE_BASE_URL || 'http://localhost:8000/api/engine';

// Axios instance for the Express Core Backend
export const expressApi = axios.create({
  baseURL: EXPRESS_API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Axios instance for the FastAPI + LangGraph AI Engine
export const aiEngineApi = axios.create({
  baseURL: AI_ENGINE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

import { auth } from './firebase';

// Add Firebase Auth token interceptor to Express API
expressApi.interceptors.request.use(async (config) => {
  const user = auth.currentUser;
  if (user) {
    const token = await user.getIdToken();
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => Promise.reject(error));

// Add Firebase Auth token interceptor to AI Engine API (if needed)
aiEngineApi.interceptors.request.use(async (config) => {
  const user = auth.currentUser;
  if (user) {
    const token = await user.getIdToken();
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => Promise.reject(error));

// ---------------------------------------------------------------------------
// TypeScript Interfaces — B2B Sales Domain
// ---------------------------------------------------------------------------

export interface Lead {
  _id: string;
  companyName: string;
  industry: string;
  estimatedBudget: number;
  currentVendor: string;
  decisionMaker: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface SalesInteraction {
  _id: string;
  leadId: string;
  rawTranscript: string;
  timestamp: string;
  status: 'pending_review' | 'approved' | 'rejected' | 'completed';
  createdAt?: string;
  updatedAt?: string;
}

export interface LeadWithInteractions extends Lead {
  interactions: SalesInteraction[];
}

export interface NextBestAction {
  action: string;
  reasoning_justification: string;
  confidence_score: number;
}

export interface SalesPlaybookEntry {
  scenario_name: string;
  target_industry: string;
  recommended_action: string;
  discount_cap: number;
}

export interface ExtractedSignal {
  signal_type: string;
  detail: string;
  source_interaction_id: string;
  confidence: number;
}

export interface AnalyzeResponse {
  lead_id: string;
  history: Array<{
    node: string;
    message: string;
    status: string;
    timestamp?: string;
  }>;
  lead_context: {
    lead_id: string;
    company_name: string;
    industry: string;
    estimated_budget: number;
    current_vendor: string;
    decision_maker: string;
    interactions: Array<{
      interaction_id: string;
      raw_transcript: string;
      status: string;
      timestamp: string;
    }>;
  };
  sales_playbooks: SalesPlaybookEntry[];
  extracted_signals: ExtractedSignal[];
  next_best_action: NextBestAction;
  requires_review: boolean;
}

// ---------------------------------------------------------------------------
// Express Backend API calls — B2B Sales
// ---------------------------------------------------------------------------

/**
 * Fetches the list of all leads from the Express backend.
 */
export const fetchLeads = async (): Promise<Lead[]> => {
  const response = await expressApi.get<{ success: boolean; count: number; data: Lead[] }>('/leads');
  return response.data.data;
};

/**
 * Fetches a single lead's details, including populated SalesInteraction history.
 * @param id The Lead's unique ID.
 */
export const fetchLeadDetails = async (id: string): Promise<LeadWithInteractions> => {
  const response = await expressApi.get<{ success: boolean; data: LeadWithInteractions }>(`/leads/${id}`);
  return response.data.data;
};

/**
 * Updates a SalesInteraction's workflow status (approve or reject).
 * @param interactionId The ID of the SalesInteraction.
 * @param status The new status value ('approved' | 'rejected').
 */
export const updateInteractionStatus = async (
  interactionId: string,
  status: 'approved' | 'rejected'
): Promise<SalesInteraction> => {
  const response = await expressApi.patch<{ success: boolean; data: SalesInteraction }>(
    `/interactions/${interactionId}/status`,
    { status }
  );
  return response.data.data;
};

/**
 * Creates a new SalesInteraction (registers an incoming event in MongoDB).
 * @param leadId The Lead's MongoDB _id.
 * @param rawTranscript The raw interaction transcript text.
 */
export const createSalesInteraction = async (
  leadId: string,
  rawTranscript: string
): Promise<SalesInteraction> => {
  const response = await expressApi.post<{ success: boolean; data: SalesInteraction }>(
    '/interactions',
    { leadId, rawTranscript }
  );
  return response.data.data;
};

// ---------------------------------------------------------------------------
// AI Engine API calls
// ---------------------------------------------------------------------------

export const analyzeLead = async (lead: LeadWithInteractions): Promise<AnalyzeResponse> => {
  const response = await aiEngineApi.post<AnalyzeResponse>('/analyze', {
    lead_id: lead._id,
    lead_data: {
      lead_id: lead._id,
      company_name: lead.companyName,
      industry: lead.industry,
      estimated_budget: lead.estimatedBudget,
      current_vendor: lead.currentVendor,
      decision_maker: lead.decisionMaker,
      interactions: lead.interactions.map(i => ({
        interaction_id: i._id,
        raw_transcript: i.rawTranscript,
        status: i.status,
        timestamp: i.timestamp
      }))
    }
  });
  return response.data;
};
