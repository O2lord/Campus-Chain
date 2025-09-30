"use client";
import React from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableCaption } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Play, CheckCircle, XCircle, Loader2, BookOpen } from "lucide-react";
import { useSupabaseClient } from '@supabase/auth-helpers-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from "sonner";
import { useState, useEffect } from 'react';
import { getAllPublishedExams, Exam } from '@/services/examService';
import { getAttemptsByStudent, startAttempt, submitAnswers } from '@/services/attemptService';

const SimulatorPage = () => {
  const supabaseClient = useSupabaseClient();
  const queryClient = useQueryClient();
  const studentId = '00000000-0000-0000-0000-000000000001'; 

  
  const { 
    data: exams, 
    isLoading: isLoadingExams, 
    isError: isErrorExams 
  } = useQuery({
    queryKey: ['published-exams'],
    queryFn: () => getAllPublishedExams(supabaseClient),
    enabled: !!supabaseClient
  });

  
  const { 
    data: attempts, 
    isLoading: isLoadingAttempts, 
    isError: isErrorAttempts,
    refetch: refetchAttempts 
  } = useQuery({
    queryKey: ['student-attempts', studentId],
    queryFn: () => getAttemptsByStudent(studentId, supabaseClient),
    enabled: !!studentId && !!supabaseClient
  });

  
  const startAttemptMutation = useMutation({
    mutationFn: ({ examId }: { examId: string }) => 
      startAttempt(examId, studentId, supabaseClient),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['student-attempts', studentId] });
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
      queryClient.invalidateQueries({ queryKey: ['student-attempts', studentId] });
    }
  });

  const [activeExamId, setActiveExamId] = useState<string | null>(null);
  const [currentAttemptId, setCurrentAttemptId] = useState<string | null>(null);
  
  
  const [sbaAnswersInput, setSbaAnswersInput] = useState<string>("");
  const [shortAnswersInput, setShortAnswersInput] = useState<string>("");

  useEffect(() => {
    if (attempts && activeExamId) {
      const activeAttempt = attempts.find(
        (att) => att.exam_id === activeExamId && att.status === 'in_progress'
      );
      if (activeAttempt) {
        setCurrentAttemptId(activeAttempt.id);
      }
    }
  }, [attempts, activeExamId]);

  
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

  const handleStartAttempt = async (examId: string) => {
    try {
      const attempt = await startAttemptMutation.mutateAsync({ examId });
      setActiveExamId(examId);
      setCurrentAttemptId(attempt.id);
      toast.success("Exam attempt started!");
      refetchAttempts();
    } catch (error) {
      console.error("Error starting attempt:", error);
      toast.error("Failed to start exam attempt.");
    }
  };

  const handleSubmitAnswers = async () => {
    if (!activeExamId) {
      toast.error("No active exam to submit answers for.");
      return;
    }

    if (!currentAttemptId) {
      toast.error("No current attempt found.");
      return;
    }

    
    if (!sbaAnswersInput.trim() || !shortAnswersInput.trim()) {
      toast.error("Please provide both SBA answers and short answers.");
      return;
    }

    try {
      
      
      const sbaAnswersArray = sbaAnswersInput
        .split(',')
        .map(answer => {
          const num = parseInt(answer.trim());
          if (isNaN(num)) {
            throw new Error(`Invalid SBA answer: ${answer.trim()}`);
          }
          return num;
        });

      
      
      const shortAnswers = shortAnswersInput
        .split(',')
        .map(answer => answer.trim())
        .filter(answer => answer.length > 0);

      if (shortAnswers.length === 0) {
        throw new Error("At least one short answer is required");
      }

      
      await submitAnswersMutation.mutateAsync({
        attemptId: currentAttemptId,
        sbaAnswers: sbaAnswersArray,
        shortAnswers: shortAnswers,
      });

      toast.success("Answers submitted successfully!");
      setActiveExamId(null);
      setCurrentAttemptId(null);
      setSbaAnswersInput("");
      setShortAnswersInput("");
      refetchAttempts();
    } catch (error) {
      console.error("Error submitting answers:", error);
      toast.error(`Failed to submit answers: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  if (isLoadingExams || isLoadingAttempts) {
    return (
      <div className="max-w-4xl mx-auto p-6 text-center">
        <Loader2 className="w-8 h-8 animate-spin mx-auto" />
        <p className="mt-4">Loading exam simulator...</p>
      </div>
    );
  }

  if (isErrorExams || isErrorAttempts) {
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

  const getAttemptScore = (examId: string) => {
    const attempt = attempts?.find(att => att.exam_id === examId);
    if (attempt && attempt.status === 'graded') {
      return attempt.final_score || "N/A";
    }
    return "N/A";
  };

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">Exam Simulator</h1>
          <p className="text-lg text-gray-600">Practice with real exam conditions</p>
        </div>

        {/* Answer Input Form - Only show when there's an active attempt */}
        {hasActiveAttempt && (
          <Card className="shadow-lg border-blue-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-blue-700">
                <CheckCircle className="w-6 h-6" />
                Submit Your Answers
              </CardTitle>
              <CardDescription>
                Enter your simulated answers for the active exam attempt.
              </CardDescription>
              {/* Display current attempt ID */}
              {currentAttemptId && (
                <div className="mt-2 p-2 bg-blue-100 rounded-md border border-blue-300">
                  <p className="text-sm text-blue-800">
                    <strong>Attempt ID:</strong> {currentAttemptId}
                  </p>
                </div>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label htmlFor="sba-answers" className="block text-sm font-medium text-gray-700">
                    SBA Answers
                  </label>
                  <textarea
                    id="sba-answers"
                    placeholder="Enter SBA answers as comma-separated numbers (e.g., 1,0,1,2)"
                    value={sbaAnswersInput}
                    onChange={(e) => setSbaAnswersInput(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    rows={3}
                  />
                  <p className="text-xs text-gray-500">
                    Format: Use numbers separated by commas. Example: 1,0,1 means option 1, no answer, option 1
                  </p>
                </div>
                
                <div className="space-y-2">
                  <label htmlFor="short-answers" className="block text-sm font-medium text-gray-700">
                    Short Answers
                  </label>
                  <textarea
                    id="short-answers"
                    placeholder="Enter short answers separated by commas (e.g., answer1,answer2,answer3)"
                    value={shortAnswersInput}
                    onChange={(e) => setShortAnswersInput(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    rows={3}
                  />
                  <p className="text-xs text-gray-500">
                    Format: Use text answers separated by commas. Example: &ldquo;Paris,France,Europe&rdquo;
                  </p>
                </div>
              </div>
              
              <div className="flex justify-end">
                <Button
                  onClick={handleSubmitAnswers}
                  disabled={submitAnswersMutation.isPending || !sbaAnswersInput.trim() || !shortAnswersInput.trim()}
                  className="bg-green-500 hover:bg-green-600"
                >
                  {submitAnswersMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <CheckCircle className="w-4 h-4 mr-2" />
                  )}
                  Submit Answers
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="w-6 h-6" />
              Available Practice Exams
            </CardTitle>
            <CardDescription>
              Select an exam to start your practice session.
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
                  <TableHead>Your Score</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {exams && exams.length > 0 ? (
                  exams.map((exam) => {
                    const status = getAttemptStatus(exam.id);
                    const isExamActive = isExamCurrentlyActive(exam);
                    const canStart = isExamActive && status === "not_started";
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
                        <TableCell>{getAttemptScore(exam.id)}</TableCell>
                        <TableCell className="text-right">
                          {canStart && (
                            <Button
                              size="sm"
                              onClick={() => handleStartAttempt(exam.id)}
                              disabled={startAttemptMutation.isPending}
                              className="bg-blue-600 hover:bg-blue-700"
                            >
                              {startAttemptMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
                              Start Practice
                            </Button>
                          )}
                          {isAttemptActive && activeExamId === exam.id && (
                            <span className="text-sm text-blue-600 font-medium">Active - Use form above</span>
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
                      No practice exams available.
                    </TableCell>
                    </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SimulatorPage;