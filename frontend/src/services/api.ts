import axios from 'axios';

// Pull base URLs from Vite's import.meta.env with safe local fallback defaults
const EXPRESS_API_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';
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

// TypeScript Interfaces for type safety
export interface Student {
  _id: string;
  name: string;
  email: string;
  currentYear: number;
  skills: string[];
  interests: string[];
  logs?: InteractionLog[];
  createdAt?: string;
  updatedAt?: string;
}

export interface InteractionLog {
  _id: string;
  studentId: string;
  summary: string;
  timestamp: string;
  status: 'pending_review' | 'completed';
  createdAt?: string;
  updatedAt?: string;
}

export interface NextBestAction {
  recommendation: string;
  reasoning: string;
  confidence_score: number;
}

export interface AnalyzeResponse {
  student_id: string;
  history: Array<{
    node: string;
    message: string;
    status: string;
    timestamp?: string;
  }>;
  retrieved_context: Array<{
    category: string;
    title?: string;
    content?: string;
    criteria?: string;
    matches?: string[];
  }>;
  current_plan: string[];
  recommendations: NextBestAction[];
  requires_review: boolean;
}

/**
 * Fetches the list of all students from the Express backend.
 */
export const fetchStudents = async (): Promise<Student[]> => {
  const response = await expressApi.get<{ success: boolean; count: number; data: Student[] }>('/students');
  return response.data.data;
};

/**
 * Fetches a single student's details, including populated interaction logs.
 * @param id The Student's unique ID.
 */
export const fetchStudentDetails = async (id: string): Promise<Student> => {
  const response = await expressApi.get<{ success: boolean; data: Student }>(`/students/${id}`);
  return response.data.data;
};

/**
 * Updates an interaction log's status (approving or completing a recommendation).
 * @param logId The ID of the interaction log.
 * @param status The new status value ('pending_review' | 'completed').
 */
export const submitReviewStatus = async (
  logId: string,
  status: 'pending_review' | 'completed'
): Promise<InteractionLog> => {
  const response = await expressApi.patch<{ success: boolean; data: InteractionLog }>(`/logs/${logId}`, {
    status,
  });
  return response.data.data;
};

/**
 * Creates a new interaction log for a student.
 */
export const createInteractionLog = async (
  studentId: string,
  summary: string,
  status: 'pending_review' | 'completed' = 'completed'
): Promise<InteractionLog> => {
  const response = await expressApi.post<{ success: boolean; data: InteractionLog }>('/logs', {
    studentId,
    summary,
    status
  });
  return response.data.data;
};

/**
 * Invokes the AI Engine's LangGraph workflow to analyze a student and generate recommendations.
 * @param studentId The student ID to run the analysis workflow for.
 */
export const analyzeStudent = async (studentId: string): Promise<AnalyzeResponse> => {
  const response = await aiEngineApi.post<AnalyzeResponse>('/analyze', {
    student_id: studentId,
  });
  return response.data;
};
