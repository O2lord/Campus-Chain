"use client";
import React, { useState, useEffect } from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  CheckCircle, 
  XCircle, 
  Loader2, 
  ArrowLeft, 
  AlertTriangle,
  FileText,
  Clock,
  Award
} from "lucide-react";
import { useSupabaseClient } from '@supabase/auth-helpers-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from "sonner";
import Link from 'next/link';
import { format } from 'date-fns';
import { 
  getAttemptById, 
  createRemarkRequest, 
  AttemptServiceError,
  Attempt,
  getRemarkRequestByAttemptId 
} from '@/services/attemptService';
import { getExamById } from '@/services/examService';
import { getExamQuestionsByExamPubkey } from '@/services/examQuestionService';
import useExaminatorProgram from '@/hooks/useExaminator';
import { PublicKey } from '@solana/web3.js';
import { useWallet } from '@solana/wallet-adapter-react';

interface PageProps {
  params: Promise<{ attemptId: string }>;
}

interface Question {
  id: string;
  question_text: string;
  question_type: 'SBA' | 'SHORT';
  options?: string[];
  correct_answer: number | string | string[];
  course_code: string;
}

interface QuestionResult {
  questionOrder: number;
  questionText: string;
  questionType: 'SBA' | 'SHORT';
  options: string[] | undefined;
  studentAnswer: number | string | undefined;
  correctAnswer: number | string | string[];
  isCorrect: boolean;
  courseCode: string;
  isManuallyReviewed: boolean; 
  manualGradeResult?: boolean;
}

/**
 * Utility function to normalize strings for better comparison
 * Converts to lowercase, trims whitespace, and removes common punctuation
 */
function normalizeString(str: string): string {
  return str.toLowerCase().trim().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "");
}

/**
 * Calculates the Levenshtein distance between two strings.
 */
function levenshteinDistance(s1: string, s2: string): number {
  const m = s1.length;
  const n = s2.length;
  const dp: number[][] = Array(m + 1).fill(0).map(() => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) {
    dp[i][0] = i;
  }
  for (let j = 0; j <= n; j++) {
    dp[0][j] = j;
  }

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,      // Deletion
        dp[i][j - 1] + 1,      // Insertion
        dp[i - 1][j - 1] + cost // Substitution
      );
    }
  }
  return dp[m][n];
}

/**
 * Calculates a similarity score between two strings based on Levenshtein distance.
 */
function calculateSimilarity(s1: string, s2: string): number {
  const longer = s1.length > s2.length ? s1 : s2;
  const shorter = s1.length > s2.length ? s2 : s1;

  if (longer.length === 0) {
    return 1.0;
  }

  const distance = levenshteinDistance(longer, shorter);
  return (longer.length - distance) / longer.length;
}

const StudentResultsPage = ({ params }: PageProps) => {
  const [attemptId, setAttemptId] = useState<string>('');
  const [selectedQuestions, setSelectedQuestions] = useState<number[]>([]);
  const [remarkReason, setRemarkReason] = useState<string>('');
  const [showWarning, setShowWarning] = useState<boolean>(false);
  const [questionResults, setQuestionResults] = useState<QuestionResult[]>([]);
  const supabaseClient = useSupabaseClient();
  const queryClient = useQueryClient();
  const { publicKey } = useWallet();
  const { 
  requestRemark,
  getStudentProfilePda,
  getExamMetadataPda,
  getLecturerProfilePda,
} = useExaminatorProgram();

  // Extract attemptId from params
  useEffect(() => {
    params.then(({ attemptId }) => setAttemptId(attemptId));
  }, [params]);

  // Fetch attempt details
  const { data: attempt, isLoading: attemptLoading, isError: attemptError } = useQuery({
    queryKey: ['attempt', attemptId],
    queryFn: () => getAttemptById(attemptId, supabaseClient),
    enabled: !!attemptId,
  });

  // Fetch exam details
  const { data: exam, isLoading: examLoading } = useQuery({
    queryKey: ['exam', attempt?.exam_id],
    queryFn: () => getExamById(attempt!.exam_id, supabaseClient),
    enabled: !!attempt?.exam_id,
  });

  // Fetch exam questions
  const { data: examQuestions, isLoading: questionsLoading } = useQuery({
    queryKey: ['examQuestions', attempt?.exam_id],
    queryFn: () => getExamQuestionsByExamPubkey(attempt!.exam_id, supabaseClient),
    enabled: !!attempt?.exam_id,
  });

  // Fetch remark request for this attempt
  const { data: remarkRequestForAttempt } = useQuery({
    queryKey: ['remarkRequestForAttempt', attemptId],
    queryFn: () => getRemarkRequestByAttemptId(attemptId, supabaseClient),
    enabled: !!attemptId,
  });

  useEffect(() => {
    if (attempt && examQuestions) {
      const results = examQuestions
        .sort((a, b) => a.question_order - b.question_order)
        .flatMap((examQuestion) => { 
          const question = examQuestion.questions as Question;
          if (!question) {
            return []; 
          }

          const studentAnswer = getStudentAnswer(attempt, examQuestion.question_order, question.question_type);
          const autoIsCorrect = isAnswerCorrect(studentAnswer, question.correct_answer, question.question_type);

          
          let isManuallyReviewed = false;
          let manualGradeResult: boolean | undefined = undefined;

          if (attempt.manual_grades && typeof attempt.manual_grades[examQuestion.question_order] === 'boolean') {
            isManuallyReviewed = true;
            manualGradeResult = attempt.manual_grades[examQuestion.question_order];
          }

          
          const questionResult: QuestionResult = {
            questionOrder: examQuestion.question_order,
            questionText: question.question_text,
            questionType: question.question_type,
            options: question.options,
            studentAnswer,
            correctAnswer: question.correct_answer,
            isCorrect: isManuallyReviewed ? manualGradeResult! : autoIsCorrect, 
            courseCode: question.course_code || 'N/A',
            isManuallyReviewed,
            manualGradeResult,
          };
          return [questionResult]; 
        });

      setQuestionResults(results);
    }
  }, [attempt, examQuestions]);

  const getStudentAnswer = (
    attempt: Attempt,
    questionOrder: number,
    questionType: 'SBA' | 'SHORT'
  ): number | string | undefined => {
    if (questionType === 'SBA' && attempt.sba_answers) {
      return attempt.sba_answers[questionOrder];
    } else if (questionType === 'SHORT' && attempt.short_answers) {
      return attempt.short_answers[questionOrder];
    }
    return undefined;
  };

  const isAnswerCorrect = (
    studentAnswer: number | string | undefined,
    correctAnswer: number | string | string[],
    questionType: 'SBA' | 'SHORT'
  ): boolean => {
    if (studentAnswer === undefined || studentAnswer === null) return false;

    if (questionType === 'SBA') {
      return Number(studentAnswer) === Number(correctAnswer);
    } else if (questionType === 'SHORT') {
      const SIMILARITY_THRESHOLD = 0.7;
      const studentAnswerStr = String(studentAnswer).toLowerCase().trim();
      const correctAnswersArray = Array.isArray(correctAnswer)
        ? correctAnswer
        : [correctAnswer as string];

      let isCorrect = false;

      if (studentAnswerStr) {
        const normalizedStudentAnswer = normalizeString(studentAnswerStr);

        for (const ca of correctAnswersArray) {
          if (!ca || typeof ca !== 'string') {
            continue;
          }
          const normalizedCorrectAnswer = normalizeString(ca);

          if (!normalizedCorrectAnswer) {
            continue;
          }

          
          if (normalizedStudentAnswer.includes(normalizedCorrectAnswer) ||
              normalizedCorrectAnswer.includes(normalizedStudentAnswer)) {
            isCorrect = true;
            break;
          }

          const similarity = calculateSimilarity(normalizedStudentAnswer, normalizedCorrectAnswer);
          if (similarity >= SIMILARITY_THRESHOLD) {
            isCorrect = true;
            break;
          }
        }
      }
      return isCorrect;
    }
    return false;
  };

  // Handle question selection for remark
  const handleQuestionSelect = (questionOrder: number, checked: boolean) => {
    setSelectedQuestions(prev => 
      checked 
        ? [...prev, questionOrder]
        : prev.filter(q => q !== questionOrder)
    );
  };


const remarkRequestMutation = useMutation({
  mutationFn: async () => {
    console.log("🟡 Mutation: mutationFn called");
    
    if (!attempt || selectedQuestions.length === 0 || !remarkReason.trim() || !publicKey) {
      console.error("🟡 Mutation: Missing required data");
      throw new Error('Missing required data for remark request');
    }

    console.log("🟡 Mutation: About to call createRemarkRequest (Supabase)");

    // Step 1: Create remark request in Supabase
    await createRemarkRequest(
      attempt.id,
      attempt.student_id,
      selectedQuestions,
      remarkReason.trim(),
      supabaseClient
    );

    console.log("✅ Supabase remark request created");

    // Step 2: Submit to Solana blockchain
    try {
      const studentProfilePubkey = getStudentProfilePda(publicKey, attempt.student_id);
      
      // Fetch lecturer wallet
      const { data: lecturerWallet, error: lecturerError } = await supabaseClient
        .rpc('get_lecturer_wallet_for_exam', { exam_id: attempt.exam_id });
      
      if (lecturerError || !lecturerWallet) {
        throw new Error(`Cannot retrieve lecturer wallet: ${lecturerError?.message || 'Not found'}`);
      }

      const lecturerWalletPubkey = new PublicKey(lecturerWallet);
      
      // Get exam details to find authority_id
      const examDetails = await getExamById(attempt.exam_id, supabaseClient);
      if (!examDetails) {
        throw new Error("Exam details not found");
      }

      const lecturerProfilePubkey = getLecturerProfilePda(lecturerWalletPubkey, examDetails.authority_id);
      const examMetadataPubkey = getExamMetadataPda(lecturerProfilePubkey, attempt.exam_id);

      // Submit to Solana
      await requestRemark.mutateAsync({
        studentProfilePubkey: studentProfilePubkey.toBase58(),
        examMetadataPubkey: examMetadataPubkey.toBase58(),
        supabaseAttemptId: attempt.id,
        reason: remarkReason.trim(),
      });

      console.log("✅ Solana remark request submitted");
    } catch (solanaError) {
      console.error("⚠️ Solana submission failed:", solanaError);
      // Don't throw - Supabase request already succeeded
      toast.warning("Remark request saved but blockchain sync failed. Your request is still valid.");
    }
  },
  onSuccess: () => {
    console.log("✅ Mutation: Success callback called");
    toast.success("Remark request submitted successfully!");
    setSelectedQuestions([]);
    setRemarkReason('');
    setShowWarning(false);
    queryClient.invalidateQueries({ queryKey: ['student-remark-requests'] });
    queryClient.invalidateQueries({ queryKey: ['remarkRequestForAttempt', attemptId] });
  },
  onError: (error) => {
    console.error('🔴 Mutation: Error callback called:', error);
    if (error instanceof AttemptServiceError) {
      toast.error(error.message);
    } else {
      toast.error("Failed to submit remark request. Please try again.");
    }
  },
});

  const handleRemarkRequest = () => {

    if (selectedQuestions.length === 0) {
      toast.error("Please select at least one question for remark.");
      return;
    }
    if (!remarkReason.trim()) {
      toast.error("Please provide a reason for the remark request.");
      return;
    }
    setShowWarning(true);
  };

const confirmRemarkRequest = () => {
  
  setShowWarning(false);
  remarkRequestMutation.mutate();
};

  const isLoading = attemptLoading || examLoading || questionsLoading;

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto p-6 text-center">
        <Loader2 className="w-8 h-8 animate-spin mx-auto" />
        <p className="mt-4">Loading exam results...</p>
      </div>
    );
  }

  if (attemptError || !attempt) {
    return (
      <div className="max-w-4xl mx-auto p-6 text-center text-red-500">
        <XCircle className="w-8 h-8 mx-auto" />
        <p className="mt-4">Error loading exam results or attempt not found.</p>
        <Link href="/student/results">
          <Button className="mt-4" variant="outline">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Results
          </Button>
        </Link>
      </div>
    );
  }

  if (!exam?.results_published) {
    return (
      <div className="max-w-4xl mx-auto p-6 text-center">
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Results for this exam have not been published yet. Please check back later.
          </AlertDescription>
        </Alert>
        <Link href="/student/results">
          <Button className="mt-4" variant="outline">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Results
          </Button>
        </Link>
      </div>
    );
  }

  const correctAnswers = questionResults.filter(q => q.isCorrect).length;
  const totalQuestions = questionResults.length;
  const percentage = totalQuestions > 0 ? Math.round((correctAnswers / totalQuestions) * 100) : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Link href="/student/results">
            <Button variant="outline" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Results
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Exam Results</h1>
          </div>
        </div>

        {/* Results Summary */}
        <Card className="shadow-lg border-blue-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-blue-700">
              <Award className="w-6 h-6" />
              Your Performance
            </CardTitle>
            <CardDescription>
              <p className="text-gray-600">{exam?.course_title}</p> 
            </CardDescription> 
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">{percentage}%</div>
                <div className="text-sm text-gray-600">Percentage</div>
              </div>
              <div className="text-center p-4 bg-purple-50 rounded-lg">
                <div className="text-2xl font-bold text-purple-600">
                  {correctAnswers}/{totalQuestions}
                </div>
                <div className="text-sm text-gray-600">Correct Answers</div>
              </div>
              <div className="text-center p-4 bg-orange-50 rounded-lg">
                <div className="text-2xl font-bold text-orange-600">
                  {attempt.time_spent_seconds ? `${Math.floor(attempt.time_spent_seconds / 60)}m` : 'N/A'}
                </div>
                <div className="text-sm text-gray-600">Time Spent</div>
              </div>
            </div>
            
            {attempt.submit_ts && (
              <div className="mt-4 text-sm text-gray-600 flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Submitted on: {format(new Date(attempt.submit_ts), 'PPpp')}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Question-by-Question Results */}
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-6 h-6" />
              Detailed Results
            </CardTitle>
            <CardDescription>
              Review your answers and select questions for remark if needed
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {questionResults.map((result, index) => (
                <div key={result.questionOrder} className="border border-gray-200 rounded-lg p-6 bg-white">
                  <div className="flex items-start gap-4">
                    <Checkbox
                      checked={selectedQuestions.includes(result.questionOrder)}
                      onCheckedChange={(checked) => 
                        handleQuestionSelect(result.questionOrder, checked as boolean)
                      }
                      className="mt-1"
                    />
                    <div className="flex-1 space-y-4">
                      {/* Question Header */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-lg text-black font-semibold">Question {index + 1}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {/* Main grade status */}
                          <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${
                            result.isCorrect 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {result.isCorrect ? (
                              <>
                                <CheckCircle className="w-4 h-4" />
                                Correct
                              </>
                            ) : (
                              <>
                                <XCircle className="w-4 h-4" />
                                Incorrect
                              </>
                            )}
                          </div>
                          
                          {/* Manual override indicator */}
                         {result.isManuallyReviewed && remarkRequestForAttempt && remarkRequestForAttempt.requested_questions.includes(result.questionOrder) && (
                          <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded border border-yellow-300">
                            Manually Reviewed
                          </span>
                          )}
                        </div>
                      </div>

                      {/* Question Text */}
                      <div className="bg-gray-200 p-4 rounded-lg">
                        <p className="font-medium text-gray-900">{result.questionText}</p>
                      </div>

                      {/* SBA Options and Answers */}
                      {result.questionType === 'SBA' && result.options && (
                        <div className="space-y-2">
                          <Label className="text-sm font-medium">Options:</Label>
                          <div className="space-y-2">
                            {result.options.map((option, optIndex) => (
                              <div 
                                key={optIndex}
                                className={`p-3 rounded-lg border ${
                                  optIndex === Number(result.correctAnswer)
                                    ? 'bg-green-50 border-green-200'
                                    : optIndex === Number(result.studentAnswer)
                                    ? result.isCorrect
                                      ? 'bg-green-50 border-green-200'
                                      : 'bg-red-50 border-red-200'
                                    : 'bg-gray-50 border-gray-200'
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium">
                                      {String.fromCharCode(65 + optIndex)}.
                                    </span>
                                    <span>{option}</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {optIndex === Number(result.correctAnswer) && (
                                      <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                                        Correct Answer
                                      </span>
                                    )}
                                    {optIndex === Number(result.studentAnswer) && (
                                      <span className={`text-xs px-2 py-1 rounded ${
                                        result.isCorrect
                                          ? 'bg-green-100 text-green-800'
                                          : 'bg-red-100 text-red-800'
                                      }`}>
                                        Your Answer
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Short Answer Results */}
                      {result.questionType === 'SHORT' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <Label className="text-sm font-medium">Your Answer:</Label>
                            <div className={`mt-1 p-3 rounded-lg border ${
                              result.isCorrect ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
                            }`}>
                              <p className="text-gray-900">
                                {result.studentAnswer || 'No answer provided'}
                              </p>
                            </div>
                          </div>
                          <div>
                            <Label className="text-sm font-medium">Correct Answer(s):</Label>
                            <div className="mt-1 p-3 bg-green-50 border border-green-200 rounded-lg">
                              <p className="text-gray-900">
                                {Array.isArray(result.correctAnswer)
                                  ? result.correctAnswer.join(', ')
                                  : String(result.correctAnswer)
                                }
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Manual Grade Override Information */}
                  {result.isManuallyReviewed && remarkRequestForAttempt && remarkRequestForAttempt.requested_questions.includes(result.questionOrder) && (
                    <Alert className="mt-4 border-orange-200 bg-orange-50">
                      <AlertTriangle className="h-4 w-4 text-orange-600" />
                      <AlertDescription className="text-orange-800">
                        <strong>Manual Review Applied:</strong> This question was manually reviewed by your instructor.
                        <p className="mt-1"><strong>Status:</strong> {remarkRequestForAttempt.status.charAt(0).toUpperCase() + remarkRequestForAttempt.status.slice(1)}</p>
                        {remarkRequestForAttempt.admin_notes && (
                          <p className="mt-2"><strong>Admin Notes:</strong> {remarkRequestForAttempt.admin_notes}</p>
                        )}
                      </AlertDescription>
                    </Alert>
                  )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
          {/** Wallet connection requirement */}
          {!publicKey && (
            <Alert className="border-yellow-200 bg-yellow-50">
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
              <AlertDescription className="text-yellow-800">
                Please connect your wallet to submit remark requests.
              </AlertDescription>
            </Alert>
          )}
        {/* Remark Request Section */}
        <Card className="shadow-lg border-orange-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-orange-700">
              <AlertTriangle className="w-6 h-6" />
              Request Remark
            </CardTitle>
            <CardDescription>
              Select questions you believe were incorrectly graded and provide a reason
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert className="border-orange-200 bg-orange-50">
              <AlertTriangle className="h-4 w-4 text-orange-600" />
              <AlertDescription className="text-orange-800">
                <strong>Important:</strong> Remark requests are carefully reviewed. If your request is found to be 
                frivolous or your original answers were indeed incorrect, penalty marks may be deducted from your score.
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label htmlFor="remark-reason">Reason for Remark Request *</Label>
              <Textarea
                id="remark-reason"
                placeholder="Please provide a detailed explanation of why you believe these questions should be remarked..."
                value={remarkReason}
                onChange={(e) => setRemarkReason(e.target.value)}
                className="min-h-[100px]"
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-600">
                {selectedQuestions.length > 0 ? (
                  <span>
                    Selected {selectedQuestions.length} question(s) for remark: 
                    {selectedQuestions.map(q => ` Q${q + 1}`).join(',')}
                  </span>
                ) : (
                  <span>No questions selected</span>
                )}
              </div>
              <Button
                onClick={handleRemarkRequest}
                disabled={selectedQuestions.length === 0 || !remarkReason.trim() || remarkRequestMutation.isPending || !publicKey}
                variant="outline"
                className="border-orange-300 text-orange-700 hover:bg-orange-50"
              >
                {remarkRequestMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <AlertTriangle className="w-4 h-4 mr-2" />
                )}
                Request Remark
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Warning Dialog */}
        {showWarning && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <Card className="max-w-md mx-4 shadow-xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-red-700">
                  <AlertTriangle className="w-6 h-6" />
                  Confirm Remark Request
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Alert className="border-red-200 bg-red-50">
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                  <AlertDescription className="text-red-800">
                    <strong>Warning:</strong> Submitting a remark request may result in:
                    <ul className="list-disc list-inside mt-2 space-y-1">
                      <li>Your score being increased if errors are found</li>
                      <li>Your score being decreased if your answers are confirmed incorrect</li>
                      <li>Penalty marks for frivolous requests</li>
                    </ul>
                  </AlertDescription>
                </Alert>
                
                <div className="text-sm text-gray-700">
                  <p><strong>Selected Questions:</strong> {selectedQuestions.length}</p>
                  <p><strong>Questions:</strong> {selectedQuestions.map(q => `Q${q + 1}`).join(', ')}</p>
                </div>

                <div className="flex gap-3 justify-end">
                  <Button
                    variant="outline"
                    onClick={() => setShowWarning(false)}
                    disabled={remarkRequestMutation.isPending}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={confirmRemarkRequest}
                    disabled={remarkRequestMutation.isPending}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    {remarkRequestMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : null}
                    Confirm Request
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};

export default StudentResultsPage;