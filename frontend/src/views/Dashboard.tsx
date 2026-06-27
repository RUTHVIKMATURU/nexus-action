import React, { useEffect, useState } from 'react';
import {
  fetchStudents,
  fetchStudentDetails,
  submitReviewStatus,
  analyzeStudent,
  createInteractionLog
} from '../services/api';
import type { Student, AnalyzeResponse } from '../services/api';

export const Dashboard: React.FC = () => {
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  // AI Engine States
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<AnalyzeResponse | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  
  // Loading & Action States
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [globalError, setGlobalError] = useState<string | null>(null);

  // Load students on mount
  useEffect(() => {
    loadStudents();
  }, []);

  const loadStudents = async () => {
    try {
      setIsLoadingList(true);
      const data = await fetchStudents();
      setStudents(data);
    } catch (err: any) {
      console.error('Failed to load students:', err);
      const backendMessage = err.response?.data?.message;
      setGlobalError(backendMessage || err.message || 'Failed to load students.');
    } finally {
      setIsLoadingList(false);
    }
  };

  const handleSelectStudent = async (student: Student) => {
    setSelectedStudent(student);
    setIsLoadingDetails(true);
    setAiAnalysis(null);
    setAnalysisError(null);
    setActionMessage(null);
    
    try {
      // 1. Fetch full details (with history from Express)
      const detailedStudent = await fetchStudentDetails(student._id);
      setSelectedStudent(detailedStudent);
      
      // 2. Automatically trigger AI Engine analysis workflow (from FastAPI)
      setIsAnalyzing(true);
      const analysis = await analyzeStudent(student._id);
      setAiAnalysis(analysis);
    } catch (err: any) {
      console.error('Error fetching student details or AI analysis:', err);
      setAnalysisError(err.message || 'Failed to complete AI analysis flow.');
      setGlobalError(err.message || 'Failed to fetch student details or analyze profile. Check authentication.');
    } finally {
      setIsLoadingDetails(false);
      setIsAnalyzing(false);
    }
  };

  const handleAction = async (approve: boolean, recommendationText?: string) => {
    if (!selectedStudent) return;
    
    // Find the first pending review log for this student
    const pendingLog = selectedStudent.logs?.find(
      (log) => log.status === 'pending_review'
    );

    try {
      if (pendingLog) {
        // Approve/Reject shifts status to completed (or similar)
        const updatedStatus = 'completed'; 
        await submitReviewStatus(pendingLog._id, updatedStatus);
      } else {
        if (!approve) {
          setActionMessage({
            type: 'error',
            text: 'No pending recommendation log found to reject.',
          });
          return;
        }
        // If approving and no pending log, create a new log from the AI recommendation
        await createInteractionLog(
          selectedStudent._id, 
          `AI Recommendation Approved: ${recommendationText || 'Next Best Action executed.'}`, 
          'completed'
        );
      }
      
      setActionMessage({
        type: 'success',
        text: `Recommendation successfully ${approve ? 'approved' : 'rejected'}. Log status updated.`,
      });

      // Refresh student details
      const detailedStudent = await fetchStudentDetails(selectedStudent._id);
      setSelectedStudent(detailedStudent);
    } catch (err: any) {
      console.error('Failed to update recommendation status:', err);
      setActionMessage({
        type: 'error',
        text: err.response?.data?.message || 'Failed to update review status.',
      });
    }
  };

  // Filter students by search query
  const filteredStudents = students.filter((student) =>
    student.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    student.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="relative">
      {globalError && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-50 bg-red-100 dark:bg-red-900 border border-red-400 dark:border-red-700 text-red-700 dark:text-red-200 px-4 py-3 rounded-md shadow-lg flex items-center justify-between gap-4 max-w-lg w-full">
          <span>{globalError}</span>
          <button onClick={() => setGlobalError(null)} className="text-red-700 dark:text-red-200 hover:text-red-900 font-bold focus:outline-none">
            &times;
          </button>
        </div>
      )}
      <div className="flex flex-col lg:flex-row min-h-[calc(100vh-80px)] bg-gray-50 dark:bg-[#111216] border border-gray-200 dark:border-[#2e303a] rounded-xl overflow-hidden shadow-md">
      {/* Left Pane: Student Directory */}
      <div className="w-full lg:w-96 border-r border-gray-200 dark:border-[#2e303a] bg-white dark:bg-[#16171d] flex flex-col">
        <div className="p-4 border-b border-gray-200 dark:border-[#2e303a]">
          <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">Student Directory</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Select a student profile to view AI insights.</p>
          <input
            type="text"
            placeholder="Search by name or email..."
            className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-[#1f2028] border border-gray-300 dark:border-[#2e303a] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#aa3bff] text-gray-700 dark:text-gray-200"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="flex-1 overflow-y-auto max-h-[500px] lg:max-h-none divide-y divide-gray-100 dark:divide-[#2e303a]">
          {isLoadingList ? (
            <div className="p-8 text-center text-sm text-gray-500">Loading students...</div>
          ) : filteredStudents.length === 0 ? (
            <div className="p-8 text-center text-sm text-gray-500">No students found.</div>
          ) : (
            filteredStudents.map((student) => (
              <button
                key={student._id}
                onClick={() => handleSelectStudent(student)}
                className={`w-full text-left p-4 hover:bg-gray-50 dark:hover:bg-[#1f2028] transition-colors duration-150 flex flex-col gap-1 ${
                  selectedStudent?._id === student._id ? 'bg-[#aa3bff]/10 border-l-4 border-[#aa3bff]' : ''
                }`}
              >
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-900 dark:text-gray-100 text-sm">{student.name}</span>
                    {selectedStudent?._id === student._id && (isLoadingDetails || isAnalyzing) && (
                      <div className="w-3 h-3 border-2 border-[#aa3bff]/30 border-t-[#aa3bff] rounded-full animate-spin"></div>
                    )}
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 dark:bg-[#2e303a] text-gray-600 dark:text-gray-300">
                    Year {student.currentYear}
                  </span>
                </div>
                <span className="text-xs text-gray-500 dark:text-gray-400 truncate w-full">{student.email}</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {student.skills.slice(0, 3).map((skill) => (
                    <span key={skill} className="text-[10px] px-1.5 py-0.5 rounded bg-purple-50 dark:bg-[#aa3bff]/10 text-[#aa3bff] dark:text-[#c084fc]">
                      {skill}
                    </span>
                  ))}
                  {student.skills.length > 3 && (
                    <span className="text-[9px] text-gray-400 mt-0.5">+{student.skills.length - 3} more</span>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Right Pane: Student Details & AI Recommendations */}
      <div className="flex-1 bg-gray-50 dark:bg-[#111216] flex flex-col overflow-y-auto">
        {!selectedStudent ? (
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
            <svg className="w-16 h-16 text-gray-300 dark:text-[#2e303a] mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300">No Student Selected</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-sm">
              Select a student from the directory to view detailed profile info, previous logs, and real-time AI recommendation plans.
            </p>
          </div>
        ) : (
          <div className="p-6 flex flex-col gap-6 max-w-4xl w-full mx-auto">
            {/* Student Header Card */}
            <div className="bg-white dark:bg-[#16171d] p-6 rounded-xl border border-gray-200 dark:border-[#2e303a] flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 !my-0 !text-left">{selectedStudent.name}</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{selectedStudent.email}</p>
                <div className="flex gap-2 mt-3">
                  <span className="text-xs px-2.5 py-1 bg-gray-100 dark:bg-[#2e303a] text-gray-700 dark:text-gray-300 rounded-full font-medium">
                    Current Year: {selectedStudent.currentYear}
                  </span>
                </div>
              </div>
              <div className="flex flex-col gap-2 min-w-[200px]">
                <span className="text-xs font-semibold text-gray-500 uppercase">Primary Skills</span>
                <div className="flex flex-wrap gap-1">
                  {selectedStudent.skills.map((skill) => (
                    <span key={skill} className="text-xs px-2 py-0.5 rounded bg-purple-50 dark:bg-[#aa3bff]/10 text-[#aa3bff] dark:text-[#c084fc]">
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* AI Engine Analysis Section */}
            <div className="bg-white dark:bg-[#16171d] rounded-xl border border-gray-200 dark:border-[#2e303a] overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-[#2e303a] bg-gradient-to-r from-purple-50/30 to-white dark:from-[#aa3bff]/5 dark:to-[#16171d] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="flex h-2.5 w-2.5 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#aa3bff]"></span>
                  </span>
                  <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">AI Recommendation Engine</h3>
                </div>
                {isAnalyzing && (
                  <span className="text-xs text-[#aa3bff] dark:text-[#c084fc] animate-pulse">Running LangGraph...</span>
                )}
              </div>

              <div className="p-6">
                {isAnalyzing || isLoadingDetails ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-3">
                    <div className="w-8 h-8 border-4 border-[#aa3bff]/20 border-t-[#aa3bff] rounded-full animate-spin"></div>
                    <span className="text-sm text-gray-500">Orchestrating Planner, Retriever, and Reasoner nodes...</span>
                  </div>
                ) : analysisError ? (
                  <div className="p-4 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/30 text-red-700 dark:text-red-300 text-sm">
                    <strong>Error:</strong> {analysisError}
                  </div>
                ) : aiAnalysis ? (
                  <div className="flex flex-col gap-6">
                    {/* Execution Plan & Retex */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Left: Plan Timeline */}
                      <div className="flex flex-col gap-3">
                        <h4 className="text-xs font-bold uppercase text-gray-500 tracking-wider">Dynamic Execution Plan</h4>
                        <div className="flex flex-col gap-3 border-l-2 border-purple-200 dark:border-purple-950 ml-2 pl-4">
                          {aiAnalysis.current_plan.map((step, i) => (
                            <div key={i} className="relative">
                              <span className="absolute -left-[25px] top-0.5 w-3 h-3 bg-[#aa3bff] rounded-full border-2 border-white dark:border-[#16171d]"></span>
                              <p className="text-sm text-gray-700 dark:text-gray-300">{step}</p>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Right: Retrieved Context */}
                      <div className="flex flex-col gap-3">
                        <h4 className="text-xs font-bold uppercase text-gray-500 tracking-wider">Retrieved Context & Playbooks</h4>
                        <div className="flex flex-col gap-2">
                          {aiAnalysis.retrieved_context.map((ctx, i) => (
                            <div key={i} className="p-3 bg-gray-50 dark:bg-[#1f2028] border border-gray-200 dark:border-[#2e303a] rounded-lg">
                              <span className="text-[10px] font-bold uppercase bg-gray-200 dark:bg-[#2e303a] text-gray-600 dark:text-gray-300 px-1.5 py-0.5 rounded">
                                {ctx.category}
                              </span>
                              <h5 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mt-1.5">
                                {ctx.title || 'Matched Criteria'}
                              </h5>
                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                {ctx.content || ctx.criteria}
                              </p>
                              {ctx.matches && (
                                <div className="flex gap-1.5 mt-2">
                                  {ctx.matches.map((m) => (
                                    <span key={m} className="text-[10px] bg-purple-100 dark:bg-purple-950/40 text-[#aa3bff] dark:text-[#c084fc] px-1.5 py-0.5 rounded">
                                      {m}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Next Best Action Card */}
                    {aiAnalysis.recommendations.map((rec, idx) => {
                      const confidencePercent = Math.round(rec.confidence_score * 100);
                      const isHigh = rec.confidence_score >= 0.85;
                      
                      return (
                        <div key={idx} className="p-5 border border-purple-200 dark:border-purple-950 bg-purple-50/20 dark:bg-purple-950/5 rounded-xl flex flex-col gap-4">
                          <div className="flex justify-between items-start gap-4">
                            <div>
                              <span className="text-[10px] bg-purple-100 dark:bg-purple-950/40 text-[#aa3bff] dark:text-[#c084fc] px-2 py-0.5 rounded-full font-bold uppercase">
                                Recommended Next Best Action
                              </span>
                              <h4 className="text-lg font-bold text-gray-900 dark:text-gray-100 mt-2">
                                {rec.recommendation}
                              </h4>
                            </div>
                            
                            {/* Confidence Score Bar */}
                            <div className="flex flex-col items-end min-w-[120px]">
                              <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">Confidence Score</span>
                              <div className="flex items-center gap-2 mt-1">
                                <span className={`text-sm font-bold ${isHigh ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'}`}>
                                  {confidencePercent}%
                                </span>
                                <div className="w-20 bg-gray-200 dark:bg-gray-700 h-2 rounded-full overflow-hidden">
                                  <div 
                                    className={`h-full rounded-full ${isHigh ? 'bg-green-500' : 'bg-amber-500'}`}
                                    style={{ width: `${confidencePercent}%` }}
                                  ></div>
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="border-t border-purple-100 dark:border-purple-950/40 pt-3">
                            <span className="text-xs font-bold text-gray-600 dark:text-gray-400">AI Reasoning:</span>
                            <p className="text-sm text-gray-700 dark:text-gray-300 mt-1 italic">{rec.reasoning}</p>
                          </div>

                          {/* Human in the Loop Warning */}
                          {aiAnalysis.requires_review && (
                            <div className="flex items-center gap-2 px-3 py-2 rounded bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30 text-amber-800 dark:text-amber-300 text-xs">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                              </svg>
                              <span>
                                <strong>Human-in-the-Loop Gatekeeper review required:</strong> This recommendation matches triggers for manual administrative verification.
                              </span>
                            </div>
                          )}

                          {/* Action Feedback Message */}
                          {actionMessage && (
                            <div className={`p-3 rounded-lg text-sm border ${
                              actionMessage.type === 'success' 
                                ? 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900/30 text-green-700 dark:text-green-300' 
                                : 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900/30 text-red-700 dark:text-red-300'
                            }`}>
                              {actionMessage.text}
                            </div>
                          )}

                          {/* Approval / Rejection Buttons */}
                          <div className="flex gap-3 mt-2">
                            <button
                              onClick={() => handleAction(true, rec.recommendation)}
                              className="flex-1 bg-green-600 hover:bg-green-700 text-white font-medium py-2.5 px-4 rounded-lg transition-colors duration-150 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                            >
                              Approve Recommendation
                            </button>
                            <button
                              onClick={() => handleAction(false)}
                              className="flex-1 bg-red-600 hover:bg-red-700 text-white font-medium py-2.5 px-4 rounded-lg transition-colors duration-150 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                            >
                              Reject Recommendation
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-6 text-sm text-gray-500">No active AI analysis.</div>
                )}
              </div>
            </div>

            {/* Interaction Logs History */}
            <div className="bg-white dark:bg-[#16171d] p-6 rounded-xl border border-gray-200 dark:border-[#2e303a]">
              <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 mb-4">Mentorship & Interaction History</h3>
              <div className="flex flex-col gap-3">
                {!selectedStudent.logs || selectedStudent.logs.length === 0 ? (
                  <p className="text-sm text-gray-500 py-4 text-center">No prior interaction logs found for this student.</p>
                ) : (
                  selectedStudent.logs.map((log) => {
                    const isPending = log.status === 'pending_review';
                    return (
                      <div key={log._id} className="p-4 bg-gray-50 dark:bg-[#1f2028] border border-gray-200 dark:border-[#2e303a] rounded-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex-1">
                          <p className="text-sm text-gray-800 dark:text-gray-200 font-medium">{log.summary}</p>
                          <span className="text-[10px] text-gray-400 block mt-1">
                            Logged: {new Date(log.timestamp).toLocaleString()}
                          </span>
                        </div>
                        <div>
                          <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                            isPending 
                              ? 'bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300' 
                              : 'bg-green-100 dark:bg-green-950/40 text-green-800 dark:text-green-300'
                          }`}>
                            {isPending ? 'Pending Review' : 'Completed'}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
    </div>
  );
};
