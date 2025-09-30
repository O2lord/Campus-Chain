"use client";
import React from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableCaption } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Play, CheckCircle, XCircle, Loader2, BookOpen, ChevronLeft, ChevronRight, Clock, ArrowLeft, Timer } from "lucide-react";
import { useSupabaseClient, useUser } from '@supabase/auth-helpers-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from "sonner";
import { useState, useEffect, useCallback } from 'react';
import { getAllPublishedExams, Exam, getExamById } from '@/services/examService';
import { getAttemptsByStudent, startAttempt, submitAnswers } from '@/services/attemptService';
import { getExamQuestionsByExamPubkey } from '@/services/examQuestionService';
import { getStudentById } from '@/services/studentIdentityService';
import { useRouter } from 'next/navigation';
import { useWallet } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import useExaminatorProgram from '@/hooks/useExaminator';


interface ExamQuestionWithDetails {
  id?: string;
  exam_pubkey: string;
  question_id: string;
  question_order: number;
  created_at?: string;
  questions?: {
    question_text: string;
    question_type: 'SBA' | 'SHORT';
    options?: string[];
    course_code: string;
  };
}

const ExamPage = () => {
  const supabaseClient = useSupabaseClient();
  const queryClient = useQueryClient();
  const user = useUser();
  const { publicKey } = useWallet();
  const router = useRouter();

  
  const [currentView, setCurrentView] = useState<'list' | 'preview' | 'active'>('list');
  const [selectedExamForPreviewId, setSelectedExamForPreviewId] = useState<string | null>(null);
  
  
  const [isTimerBlurred, setIsTimerBlurred] = useState<boolean>(false);
  
  
  const [showSubmitConfirmDialog, setShowSubmitConfirmDialog] = useState<boolean>(false);

  const [activeExamId, setActiveExamId] = useState<string | null>(null);
  const [currentAttemptId, setCurrentAttemptId] = useState<string | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState<number>(0);
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [examStartTime, setExamStartTime] = useState<Date | null>(null);
  
  
  const [sbaAnswers, setSbaAnswers] = useState<{ [key: number]: number }>({});
  const [shortAnswers, setShortAnswers] = useState<{ [key: number]: string }>({});

  const { 
    startStudentAttempt, 
    submitStudentAnswers,
    getStudentProfilePda, 
    getExamMetadataPda,
    getStudentAttemptPda,
    getLecturerProfilePda,
  } = useExaminatorProgram();

  useEffect(() => {
    const fetchSession = async () => {
      const { data: { session } } = await supabaseClient.auth.getSession();
      if (session) {
        console.log("Current Session:", session);
        console.log("Access Token (JWT):", session.access_token);
        
        try {
          const payload = JSON.parse(atob(session.access_token.split('.')[1]));
          console.log("JWT Payload:", payload);
        } catch (e) {
          console.error("Error decoding JWT:", e);
        }
      } else {
        console.log("No active session.");
      }
    };

    if (supabaseClient) {
      fetchSession();
    }
  }, [supabaseClient, user]);


  
  const { data: studentData, isLoading: isLoadingStudent } = useQuery({
    queryKey: ['studentData', user?.id],
    queryFn: () => getStudentById(user!.id, supabaseClient),
    enabled: !!user?.id && !!supabaseClient,
  });

  
  const { 
    data: exams, 
    isLoading: isLoadingExams, 
    isError: isErrorExams 
  } = useQuery({
    queryKey: ['published-exams', studentData?.set],
    queryFn: () => getAllPublishedExams(supabaseClient, studentData?.set),
    enabled: !!supabaseClient && !!studentData?.set
  });

  
  const { 
    data: attempts, 
    isLoading: isLoadingAttempts, 
    isError: isErrorAttempts,
  } = useQuery({
    queryKey: ['student-attempts', user?.id],
    queryFn: () => getAttemptsByStudent(user!.id, supabaseClient),
    enabled: !!user?.id && !!supabaseClient
  });

  
  const {
    data: examQuestions,
    isLoading: isLoadingExamQuestions,
    isError: isErrorExamQuestions,
  } = useQuery<ExamQuestionWithDetails[]>({
    queryKey: ['exam-questions', activeExamId],
    queryFn: () => getExamQuestionsByExamPubkey(activeExamId!, supabaseClient) as Promise<ExamQuestionWithDetails[]>,
    enabled: !!activeExamId && !!supabaseClient,
  });

  
  const startAttemptMutation = useMutation({
    mutationFn: ({ examId }: { examId: string }) => 
      startAttempt(examId, user!.id, supabaseClient),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['student-attempts', user?.id] });
    }
  });

  
  const submitAnswersMutation = useMutation({
    mutationFn: ({ attemptId, sbaAnswers, shortAnswers }: { 
      attemptId: string; 
      sbaAnswers: number[]; 
      shortAnswers: string[] 
    }) => 
      submitAnswers(attemptId, sbaAnswers, shortAnswers, supabaseClient),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['student-attempts', user?.id] });
    }
  });


const handleSubmitAnswers = useCallback(async (isAutoSubmit: boolean = false) => {
  if (!activeExamId || !currentAttemptId || !examQuestions || !user?.id || !publicKey) {
    toast.error("Missing data for submission.");
    return;
  }

  try {
    const sbaAnswersArray: number[] = [];
    const shortAnswersArray: string[] = [];

    examQuestions.forEach((question, index) => {
      if (question.questions?.question_type === 'SBA') {
        sbaAnswersArray.push(sbaAnswers[index] ?? 0);
      } else if (question.questions?.question_type === 'SHORT') {
        shortAnswersArray.push(shortAnswers[index] ?? '');
      }
    });

    
    await submitAnswersMutation.mutateAsync({
      attemptId: currentAttemptId,
      sbaAnswers: sbaAnswersArray,
      shortAnswers: shortAnswersArray,
    });

    
    const studentProfilePubkey = getStudentProfilePda(publicKey, user.id);
    const currentExam = exams?.find(e => e.id === activeExamId);

    if (!currentExam) {
      throw new Error("Active exam details not found for Solana submission.");
    }

    
    try {
      const { data: lecturerWallet, error: lecturerFetchError } = await supabaseClient
        .rpc('get_lecturer_wallet_for_exam', { exam_id: activeExamId });
      
      if (lecturerFetchError) {
        console.error("Lecturer wallet fetch error:", lecturerFetchError);
        throw new Error(`Cannot retrieve lecturer wallet: ${lecturerFetchError.message}`);
      }
      
      if (!lecturerWallet) {
        throw new Error(`No lecturer wallet configured for exam: ${activeExamId}`);
      }

      const lecturerWalletPubkey = new PublicKey(lecturerWallet);
      const lecturerProfilePubkey = getLecturerProfilePda(lecturerWalletPubkey, currentExam.authority_id);
      const examMetadataPubkey = getExamMetadataPda(lecturerProfilePubkey, activeExamId);
      const studentAttemptPubkey = getStudentAttemptPda(studentProfilePubkey, examMetadataPubkey, currentAttemptId);

      
      const answersForHash = {
        sbaAnswers: sbaAnswersArray,
        shortAnswers: shortAnswersArray,
      };

      
      await submitStudentAnswers.mutateAsync({
        studentAttemptPubkey: studentAttemptPubkey.toBase58(),
        supabaseAttemptId: currentAttemptId,
        answers: answersForHash,
      });

      if (isAutoSubmit) {
        toast.warning("Time's up! Your answers have been automatically submitted.");
      } else {
        toast.success("Answers submitted successfully!");
      }

      
      setActiveExamId(null);
      setCurrentAttemptId(null);
      setCurrentQuestionIndex(0);
      setSbaAnswers({});
      setShortAnswers({});
      setTimeRemaining(0);
      setExamStartTime(null);
      setCurrentView('list');
      router.push('/student/results');

    } catch (lecturerError) {
      console.error("Error fetching lecturer details:", lecturerError);
      
      
      if (isAutoSubmit) {
        toast.warning("Time's up! Answers submitted to database, but blockchain sync failed.");
      } else {
        toast.error(`Answers saved but blockchain sync failed: ${lecturerError instanceof Error ? lecturerError.message : 'Unknown error'}`);
      }
      
      
      setActiveExamId(null);
      setCurrentAttemptId(null);
      setCurrentQuestionIndex(0);
      setSbaAnswers({});
      setShortAnswers({});
      setTimeRemaining(0);
      setExamStartTime(null);
      setCurrentView('list');
      router.push('/student/results');
    }

  } catch (error) {
    console.error("Error submitting answers:", error);
    toast.error(`Failed to submit answers: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}, [
  activeExamId,
  currentAttemptId,
  examQuestions,
  sbaAnswers,
  shortAnswers,
  submitAnswersMutation,
  exams,
  router,
  user?.id,
  publicKey,
  submitStudentAnswers,
  getStudentProfilePda,
  getExamMetadataPda,
  getStudentAttemptPda,
  getLecturerProfilePda,
  supabaseClient,
]);


  
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    
    const currentExam = exams?.find(e => e.id === activeExamId);
    
    if (activeExamId && examStartTime && timeRemaining > 0 && currentExam) {
      interval = setInterval(() => {
        const now = new Date();
        const elapsed = Math.floor((now.getTime() - examStartTime.getTime()) / 1000);
        const remaining = currentExam.duration_secs - elapsed;
        
        if (remaining <= 0) {
          
          handleSubmitAnswers(true);
          clearInterval(interval);
        } else {
          setTimeRemaining(remaining);
        }
      }, 1000);
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [activeExamId, examStartTime, timeRemaining, exams, handleSubmitAnswers]);

  useEffect(() => {
    if (attempts && !activeExamId && exams) { 
      const activeAttempt = attempts.find(
        (att) => att.student_id === user?.id && att.status === 'in_progress'
      );
      if (activeAttempt) {
        const correspondingExam = exams.find(exam => exam.id === activeAttempt.exam_id);

        if (correspondingExam) {
          const startTime = new Date(activeAttempt.start_ts);
          const now = new Date();
          const elapsedSeconds = Math.floor((now.getTime() - startTime.getTime()) / 1000);
          const remaining = Math.max(0, correspondingExam.duration_secs - elapsedSeconds);

          setActiveExamId(activeAttempt.exam_id);
          setCurrentAttemptId(activeAttempt.id);
          setCurrentView('active'); 
          setExamStartTime(startTime); 
          setTimeRemaining(remaining); 
        }
      }
    }
  }, [attempts, user?.id, activeExamId, exams]);

  
  const formatTimeRemaining = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  
  const isValidTimestamp = (timestamp: string): boolean => {
    return Boolean(timestamp && timestamp !== '0' && !isNaN(new Date(timestamp).getTime()));
  };

  
  const isExamCurrentlyActive = (exam: Exam): boolean => {
    if (!exam.published || !isValidTimestamp(exam.start_ts) || !isValidTimestamp(exam.end_ts)) {
      return false;
    }
    
    const now = new Date();
    const startTime = new Date(exam.start_ts);
    const endTime = new Date(exam.end_ts);
    
    return now >= startTime && now <= endTime;
  };

  
  const getEligibilityStatus = (exam: Exam): string => {
    if (!studentData) return "Loading...";
    if (!studentData.eligible) return "Not Eligible";
    return "Eligible";
  };


const handleStartAttempt = async (examId: string) => {
  if (!user?.id || !publicKey || !studentData) {
    toast.error("User not authenticated, wallet not connected, or student data missing.");
    return;
  }

  try {
  
    const supabaseAttempt = await startAttempt(examId, user.id, supabaseClient);


  
    const examDetails = await getExamById(examId, supabaseClient);
    
    
    if (!examDetails) {
      throw new Error("Exam details not found for on-chain interaction.");
    }

 
   

    const { data: lecturerWallet, error } = await supabaseClient
      .rpc('get_lecturer_wallet_for_exam', { exam_id: examId });

    if (error) {
     
      throw new Error(`Cannot retrieve lecturer wallet: ${error.message}`);
    }

    if (!lecturerWallet) {
      
      throw new Error("Lecturer wallet not configured for this exam");
    }
 
    const lecturerWalletPubkey = new PublicKey(lecturerWallet);
    const lecturerProfilePubkey = getLecturerProfilePda(lecturerWalletPubkey, examDetails.authority_id);
    const studentProfilePubkey = getStudentProfilePda(publicKey, user.id);
    const examMetadataPubkey = getExamMetadataPda(lecturerProfilePubkey, examId);

  
    await startStudentAttempt.mutateAsync({
      studentProfilePubkey: studentProfilePubkey.toBase58(),
      examMetadataPubkey: examMetadataPubkey.toBase58(),
      supabaseAttemptId: supabaseAttempt.id,
    });
    
  
    const startedExam = exams?.find(e => e.id === examId);
    setActiveExamId(examId);
    setCurrentView('active');
    setCurrentAttemptId(supabaseAttempt.id);
    setCurrentQuestionIndex(0);
    setSbaAnswers({});
    setShortAnswers({});
    
    const startTime = new Date();
    setExamStartTime(startTime);
    if (startedExam) {
      setTimeRemaining(startedExam.duration_secs);
    }
    
    toast.success("Exam attempt started successfully!");
    queryClient.invalidateQueries({ queryKey: ['student-attempts', user?.id] });
    queryClient.invalidateQueries({ queryKey: ['exam-questions', examId] });
    
  } catch (error) {
    console.error("[DEBUG] Error starting attempt:", error);
    

    if (error instanceof Error) {
      if (error.message.includes('Lecturer details not found') || error.message.includes('lecturer wallet')) {
        toast.error("Cannot start exam: Lecturer profile not found or incomplete. Please contact your instructor.");
      } else if (error.message.includes('wallet')) {
        toast.error("Cannot start exam: Lecturer's wallet not configured. Please contact your instructor.");
      } else {
        toast.error(`Failed to start exam: ${error.message}`);
      }
    } else {
      toast.error("Failed to start exam: Unknown error occurred");
    }
  }
};

  const handleNextQuestion = () => {
    if (examQuestions && currentQuestionIndex < examQuestions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    }
  };

  const handlePreviousQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    }
  };

  const handleSbaAnswerChange = (questionIndex: number, optionIndex: number) => {
    setSbaAnswers(prev => ({
      ...prev,
      [questionIndex]: optionIndex
    }));
  };

  const handleShortAnswerChange = (questionIndex: number, answer: string) => {
    setShortAnswers(prev => ({
      ...prev,
      [questionIndex]: answer
    }));
  };

  if (!user) {
    return (
      <div className="max-w-4xl mx-auto p-6 text-center">
        <Loader2 className="w-8 h-8 animate-spin mx-auto" />
        <p className="mt-4">Loading user data...</p>
      </div>
    );
  }

  if (isLoadingExams || isLoadingAttempts || isLoadingExamQuestions || isLoadingStudent) {
    return (
      <div className="max-w-4xl mx-auto p-6 text-center">
        <Loader2 className="w-8 h-8 animate-spin mx-auto" />
        <p className="mt-4">Loading exam simulator...</p>
      </div>
    );
  }

  if (isErrorExams || isErrorAttempts || isErrorExamQuestions) {
    return (
      <div className="max-w-4xl mx-auto p-6 text-center text-red-500">
        <XCircle className="w-8 h-8 mx-auto" />
        <p className="mt-4">Error loading exam data.</p>
      </div>
    );
  }

  const getAttemptStatus = (examId: string) => {
    const attempt = attempts?.find(att => att.exam_id === examId);
    if (!attempt) return "not_started";
    return attempt.status;
  };

  const handlePreviewExam = (examId: string) => {
    setSelectedExamForPreviewId(examId);
    setCurrentView('preview');
  };

  const handleBackToList = () => {
    setCurrentView('list');
    setSelectedExamForPreviewId(null);
  };

  const selectedExamForPreview = exams?.find(e => e.id === selectedExamForPreviewId);

  const formatStatus = (status: string) => {
    switch (status) {
      case 'not_started':
        return 'Not Started';
      case 'in_progress':
        return 'Active';
      case 'submitted':
        return 'Submitted';
      case 'graded':
        return 'Graded';
      case 'expired':
        return 'Expired';
      default:
        return status;
    }
  };

  const hasActiveAttempt = activeExamId !== null;
  const currentQuestion = examQuestions?.[currentQuestionIndex];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">Exam Simulator</h1>
          <p className="text-lg text-gray-600">Practice with real exam conditions</p>
          {studentData && (
            <div className="mt-4 p-4 bg-white rounded-lg shadow-sm">
             <p className="text-sm text-gray-600">
                Welcome, <span className="font-medium">{studentData.name}</span>
              </p>
              <p className="text-sm">
                {!studentData.eligible && (
                  <span className="text-xs text-gray-500 ml-2">
                  Your Attendance for this session is {studentData.attendance}%  (Min required is 75%)
                  </span>
                )}
              </p>
            </div>
          )}
        </div>

     {/* Timer Display - Only show when there's an active attempt */}
        {hasActiveAttempt && timeRemaining > 0 && currentView === 'active' && (
          <Card className="shadow-lg border-red-200 bg-red-50">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Exam Timer</CardTitle>
                <div className="text-sm text-gray-500">
                  {isTimerBlurred ? 'Click timer to unblur' : 'Click timer to blur'}
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div 
                className={`flex items-center justify-center gap-3 cursor-pointer transition-all duration-200 hover:bg-red-100 rounded-lg p-3 ${isTimerBlurred ? 'blur-sm' : ''}`}
                onClick={() => setIsTimerBlurred(prev => !prev)}
                title={isTimerBlurred ? 'Click to unblur timer' : 'Click to blur timer'}
              >
                <Clock className={`w-6 h-6 ${timeRemaining <= 300 ? 'text-red-600' : 'text-orange-600'}`} />
                <span className={`text-2xl font-bold ${timeRemaining <= 300 ? 'text-red-600' : 'text-orange-600'}`}>
                  Time Remaining: {formatTimeRemaining(timeRemaining)}
                </span>
              </div>
              {timeRemaining <= 300 && (
                <p className="text-center text-red-600 text-sm mt-2">
                  ⚠️ Less than 5 minutes remaining! Your answers will be automatically submitted when time expires.
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Exam Preview Screen */}
        {currentView === 'preview' && selectedExamForPreview && (
          <Card className="shadow-lg border-blue-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-blue-700">
                <BookOpen className="w-6 h-6" />
                Exam Preview: {selectedExamForPreview.course_title}
              </CardTitle>
              <CardDescription>
                Review the exam details before starting your practice session.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-800 mb-2">Exam Details</h3>
                    <div className="space-y-2 text-sm">
                      <p><span className="font-medium">Course:</span> {selectedExamForPreview.course_code}</p>
                      <p><span className="font-medium">Title:</span> {selectedExamForPreview.course_title}</p>
                      <p><span className="font-medium">Duration:</span> {Math.round(selectedExamForPreview.duration_secs / 60)} minutes</p>
                      <p><span className="font-medium">Total Questions:</span> {examQuestions?.length || 'Loading...'}</p>
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-800 mb-2">Instructions</h3>
                    <div className="p-4 bg-gray-50 rounded-lg text-sm text-gray-700">
                      {selectedExamForPreview.instructions || (
                        <div className="space-y-2">
                          <p>• Read each question carefully before answering</p>
                          <p>• You can navigate between questions using the navigation buttons</p>
                          <p>• Your answers are automatically saved as you progress</p>
                          <p>• Submit your exam before the time expires</p>
                          <p>• Once submitted, you cannot make changes to your answers</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="flex justify-between items-center pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={handleBackToList}
                  className="flex items-center gap-2"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back to List
                </Button>
                
                <Button
                  onClick={() => handleStartAttempt(selectedExamForPreview.id)}
                  disabled={startAttemptMutation.isPending}
                  className="bg-blue-600 hover:bg-blue-700 flex items-center gap-2"
                >
                  {startAttemptMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Timer className="w-4 h-4" />
                  )}
                  Start Exam
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Question Display and Answer Input - Only show when there's an active attempt */}
        {currentView === 'active' && hasActiveAttempt && examQuestions && examQuestions.length > 0 && (
          <Card className="shadow-lg border-purple-200">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-purple-700">
                  <BookOpen className="w-6 h-6" />
                  Question {currentQuestionIndex + 1} of {examQuestions.length}
                </div>
                <div className="flex items-center gap-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleBackToList}
                    className="text-gray-600"
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Exit Exam
                  </Button>
                  <div className="text-sm text-gray-600">
                    Attempt ID: {currentAttemptId}
                  </div>
                </div>
              </CardTitle>
              <CardDescription>
                Answer the current question and use navigation to move between questions.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {currentQuestion && (
                <>
                  {/* Question Display */}
                  <div className="p-6 bg-gray-50 rounded-lg border">
                    <h3 className="text-xl font-semibold text-gray-800 mb-4">
                      {currentQuestion.questions?.question_text}
                    </h3>

                    {/* SBA Options */}
                    {currentQuestion.questions?.question_type === 'SBA' && currentQuestion.questions?.options && (
                      <div className="space-y-3">
                        {currentQuestion.questions.options.map((option: string, optIndex: number) => (
                          <label key={optIndex} className="flex items-center gap-3 p-3 text-black border rounded-lg hover:bg-white cursor-pointer">
                            <input
                              type="radio"
                              name={`sba-${currentQuestionIndex}`}
                              value={optIndex}
                              checked={sbaAnswers[currentQuestionIndex] === optIndex}
                              onChange={() => handleSbaAnswerChange(currentQuestionIndex, optIndex)}
                              className="w-4 h-4 text-blue-600"
                            />
                            <span className="font-medium">{String.fromCharCode(65 + optIndex)}.</span>
                            <span>{option}</span>
                          </label>
                        ))}
                      </div>
                    )}

                    {/* Short Answer Input */}
                    {currentQuestion.questions?.question_type === 'SHORT' && (
                      <div className="space-y-2">
                        <label htmlFor={`short-${currentQuestionIndex}`} className="block text-sm font-medium text-gray-700">
                          Your Answer:
                        </label>
                        <textarea
                          id={`short-${currentQuestionIndex}`}
                          placeholder="Enter your answer here..."
                          value={shortAnswers[currentQuestionIndex] || ''}
                          onChange={(e) => handleShortAnswerChange(currentQuestionIndex, e.target.value)}
                          className="w-full px-4 py-3 text-black border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          rows={4}
                        />
                      </div>
                    )}
                  </div>

                  {/* Navigation and Submit */}
                  <div className="flex justify-between items-center">
                    <Button
                      onClick={handlePreviousQuestion}
                      disabled={currentQuestionIndex === 0}
                      variant="outline"
                    >
                      <ChevronLeft className="w-4 h-4 mr-2" />
                      Previous
                    </Button>

                    <div className="flex gap-2">
                      {examQuestions.map((_, index) => (
                        <button
                          key={index}
                          onClick={() => setCurrentQuestionIndex(index)}
                          className={`w-8 h-8 rounded-full text-sm font-medium ${
                            index === currentQuestionIndex
                              ? 'bg-blue-600 text-white'
                              : (sbaAnswers[index] !== undefined || shortAnswers[index])
                              ? 'bg-green-100 text-green-800'
                              : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {index + 1}
                        </button>
                      ))}
                    </div>

                    <div className="flex gap-2">
                      <Button
                        onClick={handleNextQuestion}
                        disabled={currentQuestionIndex === examQuestions.length - 1}
                        variant="outline"
                      >
                        Next
                        <ChevronRight className="w-4 h-4 ml-2" />
                      </Button>

                      <Button
                        onClick={() => setShowSubmitConfirmDialog(true)}
                        disabled={submitAnswersMutation.isPending}
                        className="bg-green-500 hover:bg-green-600"
                      >
                        {submitAnswersMutation.isPending ? (
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        ) : (
                          <CheckCircle className="w-4 h-4 mr-2" />
                        )}
                        Submit All Answers
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* Available Exams List - Only show when in list view */}
        {currentView === 'list' && (
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="w-6 h-6" />
                Available Practice Exams
              </CardTitle>
              <CardDescription>
                Select an exam to start your practice session. Only exams for your set and eligible students are shown.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableCaption>List of published exams available for practice.</TableCaption>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Course Code</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Eligibility Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {exams && exams.length > 0 ? (
                    exams.filter(exam => {
                      const status = getAttemptStatus(exam.id);
                      return status === "not_started" || status === "in_progress";
                    }).map((exam) => {
                      const status = getAttemptStatus(exam.id);
                      const isExamActive = isExamCurrentlyActive(exam);
                      const canStart = isExamActive && studentData?.eligible && status === "not_started";
                      const isAttemptActive = status === "in_progress";

                      return (
                        <TableRow key={exam.id}>
                          <TableCell className="font-medium">{exam.course_title}</TableCell>
                          <TableCell>{exam.course_code}</TableCell>
                          <TableCell>{Math.round(exam.duration_secs / 60)} minutes</TableCell>
                          <TableCell>
                            <span className={`inline-flex px-2 py-1 text-xs rounded-full ${
                              isAttemptActive ? "bg-blue-100 text-blue-800" :
                              status === "submitted" ? "bg-yellow-100 text-yellow-800" :
                              status === "graded" ? "bg-green-100 text-green-800" :
                              "bg-gray-100 text-gray-800"
                            }`}>
                              {formatStatus(status)}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className={`font-medium ${
                              getEligibilityStatus(exam) === "Eligible" ? "text-green-600" : "text-red-600"
                            }`}>
                              {getEligibilityStatus(exam)}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            {canStart && (
                              <Button
                                size="sm"
                                onClick={() => handlePreviewExam(exam.id)}
                                className="bg-blue-600 hover:bg-blue-700"
                              >
                                <Play className="w-4 h-4 mr-2" />
                                Start Practice
                              </Button>
                            )}
                            {isAttemptActive && activeExamId === exam.id && (
                              <Button
                                size="sm"
                                onClick={() => setCurrentView('active')}
                                className="bg-green-600 hover:bg-green-700"
                              >
                                Continue Exam
                              </Button>
                            )}
                            {!isExamActive && status === "not_started" && (
                              <span className="text-sm text-gray-500">Not available</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center">
                        {studentData?.eligible ? "No active practice exams available for your set." : "No exams available - eligibility required."}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Submission Confirmation Dialog */}
        <Dialog open={showSubmitConfirmDialog} onOpenChange={setShowSubmitConfirmDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirm Exam Submission</DialogTitle>
            </DialogHeader>
            <div className="py-4">
              <p>Are you sure you want to submit your answers? You will not be able to make changes after submission.</p>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowSubmitConfirmDialog(false)}
                disabled={submitAnswersMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  handleSubmitAnswers(false);
                  setShowSubmitConfirmDialog(false);
                }}
                disabled={submitAnswersMutation.isPending}
                className="bg-green-500 hover:bg-green-600"
              >
                {submitAnswersMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <CheckCircle className="w-4 h-4 mr-2" />
                )}
                Confirm Submission
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default ExamPage;