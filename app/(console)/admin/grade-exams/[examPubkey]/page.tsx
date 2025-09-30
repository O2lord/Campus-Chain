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
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectItem, SelectContent } from '@/components/ui/select';
import { GraduationCap, Loader2, XCircle, CheckCircle, Edit3, ChevronDown, ChevronUp } from "lucide-react";
import { useQuery, useMutation, useQueryClient, UseQueryOptions } from '@tanstack/react-query';
import { useSupabaseClient } from '@supabase/auth-helpers-react';
import { toast } from "sonner";
import { format } from 'date-fns';
import { useState, useEffect } from 'react';
import { useUser } from '@supabase/auth-helpers-react'
import { useWallet } from '@solana/wallet-adapter-react';
import useExaminatorProgram from '@/hooks/useExaminator';
import { PublicKey } from '@solana/web3.js';
import { getAttemptsByExam, finalizeScore, Attempt, getRemarkRequestsByExam, updateRemarkRequestStatus, RemarkRequest, RemarkRequestStatus } from '@/services/attemptService';
import { getExamById } from '@/services/examService';
import { getExamQuestionsByExamPubkey, ExamQuestionWithDetails } from '@/services/examQuestionService';

interface FinalizeScoreMutationVariables {
  attemptId: string;
  finalScore: number;
  maxPossibleScore?: number;
  attemptManualGrades?: Record<number, boolean>;
  studentSupabaseId: string;
  examSupabaseId: string;
  examAuthorityId: string;
}

interface RemarkDialogQuestionDetail {
  questionOrder: number;
  questionText: string;
  questionType: 'SBA' | 'SHORT';
  options?: string[];
  studentAnswer: number | string | undefined;
  correctAnswer: number | string | string[];
  autoGrade: boolean;
  currentGrade: boolean;
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
 * Measures the minimum number of single-character edits (insertions, deletions, or substitutions)
 * required to change one word into the other.
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
        dp[i - 1][j] + 1,      
        dp[i][j - 1] + 1,      
        dp[i - 1][j - 1] + cost 
      );
    }
  }
  return dp[m][n];
}

/**
 * Calculates a similarity score between two strings based on Levenshtein distance.
 * Returns a value between 0 (no similarity) and 1 (identical).
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



interface AttemptWithProfile extends Attempt {
  profiles?: {
    full_name?: string;
    matric_no?: string;
  };
  students?: {
    matric_no?: string;
    wallet?: string;
  };
}

interface PageProps {
  params: Promise<{ examPubkey: string }>;
}

const ExamAttemptsPage = ({ params }: PageProps) => {
  const [examId, setExamId] = React.useState<string>('');
  const [scores, setScores] = useState<Record<string, { sba: number; short: number }>>({});
  const [editingAttempts, setEditingAttempts] = useState<Set<string>>(new Set());
  const [expandedAttemptId, setExpandedAttemptId] = useState<string | null>(null);
  const [manualGrades, setManualGrades] = useState<Record<string, Record<number, boolean>>>({});
  const [activeTab, setActiveTab] = useState('attempts');
  const [isRemarkDialog, setIsRemarkDialog] = useState(false);
  const [currentRemarkRequest, setCurrentRemarkRequest] = useState<RemarkRequest | null>(null);
  const [newRemarkStatus, setNewRemarkStatus] = useState<RemarkRequestStatus | ''>('');
  const [newAdminNotes, setNewAdminNotes] = useState<string>('');
  const [remarkDialogQuestionDetails, setRemarkDialogQuestionDetails] = useState<RemarkDialogQuestionDetail[]>([]);
  
  const supabaseClient = useSupabaseClient();
  const queryClient = useQueryClient();

  const user = useUser();
  const { publicKey } = useWallet(); 

  
  const {
    finalizeStudentScore,
    getLecturerProfilePda,
    getStudentProfilePda,
    getExamMetadataPda,
    getLecturerProfiles, 
    getStudentProfiles, 
    getExamMetadata, 
    
  } = useExaminatorProgram();
  

  React.useEffect(() => {
    params.then(({ examPubkey }) => setExamId(examPubkey));
  }, [params]);

  
  const { data: attempts, isLoading: attemptsLoading, isError: attemptsError } = useQuery<
    Attempt[], 
    Error,     
    Attempt[], 
    ['examAttempts', string | null] 
  >(
    {
      queryKey: ['examAttempts', examId],
      queryFn: () => getAttemptsByExam(examId, supabaseClient),
      enabled: !!examId,
      onSuccess: (data: Attempt[]) => { 
        console.log("ExamAttemptsPage: Fetched attempts data:", data);
      }
    } as UseQueryOptions<Attempt[], Error, Attempt[], ['examAttempts', string | null]>
  );

  
  const { data: examData, isLoading: examLoading } = useQuery({
    queryKey: ['exam', examId],
    queryFn: () => getExamById(examId, supabaseClient),
    enabled: !!examId,
  });

  
  const { data: examQuestions, isLoading: questionsLoading } = useQuery({
    queryKey: ['examQuestions', examId],
    queryFn: () => getExamQuestionsByExamPubkey(examId, supabaseClient),
    enabled: !!examId,
  });

  
  const { data: remarkRequests, isLoading: remarkRequestsLoading, isError: remarkRequestsError, refetch: refetchRemarkRequests } = useQuery({
    queryKey: ['remarkRequests', examId],
    queryFn: () => getRemarkRequestsByExam(examId, supabaseClient),
    enabled: !!examId,
  });

  
  const { isLoading: isLoadingLecturerProfiles } = getLecturerProfiles;
  const { isLoading: isLoadingStudentProfiles } = getStudentProfiles;
  const { isLoading: isLoadingExamMetadata } = getExamMetadata;
  

  
  useEffect(() => {
    if (attempts && examQuestions) {
      const initialManualGrades: Record<string, Record<number, boolean>> = {};
      const initialScores: Record<string, { sba: number; short: number }> = {};

      attempts.forEach((attempt: AttemptWithProfile) => {
        const attemptId = attempt.id;
        const gradesForThisAttempt: Record<number, boolean> = {};

        examQuestions.forEach((examQuestion: ExamQuestionWithDetails) => {
          const question = examQuestion.questions;
          if (question) {
            const questionOrder = examQuestion.question_order;
            const studentAnswer = getStudentAnswer(attempt, questionOrder, question.question_type);
            const autoGrade = isAnswerCorrect(studentAnswer, question.correct_answer, question.question_type);

            
            
            const persistedManualGrade = attempt.manual_grades?.[questionOrder];
            gradesForThisAttempt[questionOrder] = persistedManualGrade !== undefined ? persistedManualGrade : autoGrade;
          }
        });
        initialManualGrades[attemptId] = gradesForThisAttempt;

        
        const sbaScore = examQuestions
          .filter((eq: ExamQuestionWithDetails) => eq.questions?.question_type === 'SBA')
          .reduce((score, eq) => {
            return score + (gradesForThisAttempt[eq.question_order] ? 1 : 0);
          }, 0);

        const shortScore = examQuestions
          .filter((eq: ExamQuestionWithDetails) => eq.questions?.question_type === 'SHORT')
          .reduce((score, eq) => {
            return score + (gradesForThisAttempt[eq.question_order] ? 1 : 0);
          }, 0);

        initialScores[attemptId] = { sba: sbaScore, short: shortScore };
      });

      setManualGrades(initialManualGrades);
      setScores(initialScores);
    }
  }, [attempts, examQuestions]);

  
  const getStudentAnswer = (
    attempt: AttemptWithProfile,
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

  
  const getCurrentGrade = (attemptId: string, questionOrder: number, autoGrade: boolean): boolean => {
    return manualGrades[attemptId]?.[questionOrder] ?? autoGrade;
  };

  
  const calculateSBAScoreFromGrades = (attemptId: string, grades: Record<string, Record<number, boolean>>): number => {
    if (!grades[attemptId] || !examQuestions) return 0;
    
    return examQuestions
      .filter((eq: ExamQuestionWithDetails) => eq.questions?.question_type === 'SBA')
      .reduce((score, eq) => {
        return score + (grades[attemptId][eq.question_order] ? 1 : 0);
      }, 0);
  };

  
  const calculateShortScoreFromGrades = (attemptId: string, grades: Record<string, Record<number, boolean>>): number => {
    if (!grades[attemptId] || !examQuestions) return 0;
    
    return examQuestions
      .filter((eq: ExamQuestionWithDetails) => eq.questions?.question_type === 'SHORT')
      .reduce((score, eq) => {
        return score + (grades[attemptId][eq.question_order] ? 1 : 0);
      }, 0);
  };

  
  const handleGradeToggle = (attemptId: string, questionOrder: number) => {
    setManualGrades(prev => {
      
      const attempt = attempts?.find(att => att.id === attemptId);
      if (!attempt) {
        console.error("handleGradeToggle: Attempt not found for ID:", attemptId);
        return prev; 
      }

      
      const examQuestionDetail = examQuestions?.find(eq => eq.question_order === questionOrder);
      if (!examQuestionDetail || !examQuestionDetail.questions) {
        console.error("handleGradeToggle: Exam question details or nested question not found for order:", questionOrder);
        return prev; 
      }

      const questionType = examQuestionDetail.questions.question_type;
      const correctAnswer = examQuestionDetail.questions.correct_answer;

      
      const studentAnswer = getStudentAnswer(attempt, questionOrder, questionType);

      
      const autoGradeForQuestion = isAnswerCorrect(
        studentAnswer,
        correctAnswer,
        questionType
      );

      const currentEffectiveGrade = prev[attemptId]?.[questionOrder] ?? autoGradeForQuestion;
      const newGrade = !currentEffectiveGrade; 

      const newGrades = {
        ...prev,
        [attemptId]: {
          ...prev[attemptId],
          [questionOrder]: newGrade
        }
      };

      
      const sbaScore = calculateSBAScoreFromGrades(attemptId, newGrades);
      const shortScore = calculateShortScoreFromGrades(attemptId, newGrades);

      setScores(prevScores => ({
        ...prevScores,
        [attemptId]: {
          sba: sbaScore,
          short: shortScore
        }
      }));

      return newGrades;
    });
  };

  
  const handleRemarkQuestionGradeToggle = (questionOrder: number) => {
    if (!currentRemarkRequest) return;

    const attemptId = currentRemarkRequest.attempt_id;
    handleGradeToggle(attemptId, questionOrder);

    
    setRemarkDialogQuestionDetails(prev => 
      prev.map(detail => 
        detail.questionOrder === questionOrder
          ? { ...detail, currentGrade: !detail.currentGrade }
          : detail
      )
    );
  };

 
const finalizeScoreMutation = useMutation({
  mutationFn: async ({ 
    attemptId, 
    finalScore, 
    maxPossibleScore, 
    attemptManualGrades, 
    studentSupabaseId, 
    examSupabaseId, 
    examAuthorityId 
  }: FinalizeScoreMutationVariables) => {
    console.log("finalizeScoreMutation: attemptManualGrades received in mutationFn:", attemptManualGrades);

    if (!user?.id || !publicKey) {
      throw new Error("Lecturer not authenticated or wallet not connected.");
    }

    
    const updatedSupabaseAttempt = await finalizeScore(attemptId, finalScore, supabaseClient, maxPossibleScore, attemptManualGrades);

    
    const attempt = attempts?.find(att => att.id === attemptId) as AttemptWithProfile;
    if (!attempt) {
      throw new Error("Attempt not found");
    }

    const studentWallet = attempt.students?.wallet;
    if (!studentWallet) {
      throw new Error("Student wallet not found in profile");
    }

    console.log("=== GETTING EXAM CREATOR WALLET ===");
    
    
    
    const { data: examCreatorProfile, error: examCreatorError } = await supabaseClient
      .from('lecturers')
      .select('wallet')
      .eq('id', examAuthorityId) 
      .single();

    if (examCreatorError || !examCreatorProfile) {
      throw new Error(`Failed to get exam creator profile: ${examCreatorError?.message}`);
    }

    const examCreatorWallet = examCreatorProfile.wallet;
    if (!examCreatorWallet) {
      throw new Error("Exam creator wallet not found in profile");
    }

    console.log("examCreatorWallet:", examCreatorWallet);

    
    if (!validatePublicKeyString(studentWallet, "studentWallet")) {
      throw new Error("Invalid student wallet address");
    }
    
    if (!validatePublicKeyString(examCreatorWallet, "examCreatorWallet")) {
      throw new Error("Invalid exam creator wallet address");
    }

    try {
      
      const lecturerProfilePubkey = getLecturerProfilePda(publicKey, user.id);
      
      
      const studentProfilePubkey = getStudentProfilePda(new PublicKey(studentWallet), studentSupabaseId);
      
      
      const examCreatorLecturerProfilePda = getLecturerProfilePda(new PublicKey(examCreatorWallet), examAuthorityId);
      const examMetadataPubkey = getExamMetadataPda(examCreatorLecturerProfilePda, examSupabaseId);

      console.log("=== GENERATED PDAs ===");
      console.log("lecturerProfilePubkey:", lecturerProfilePubkey.toString());
      console.log("studentProfilePubkey:", studentProfilePubkey.toString());
      console.log("examCreatorLecturerProfilePda:", examCreatorLecturerProfilePda.toString());
      console.log("examMetadataPubkey:", examMetadataPubkey.toString());

      
      await finalizeStudentScore.mutateAsync({
        studentProfilePubkey: studentProfilePubkey.toBase58(),
        examMetadataPubkey: examMetadataPubkey.toBase58(),
        lecturerProfilePubkey: lecturerProfilePubkey.toBase58(),
        supabaseAttemptId: attemptId,
        finalScore: finalScore,
        maxPossibleScore: maxPossibleScore || 0,
      });

      return updatedSupabaseAttempt;
    } catch (error) {
      console.error("Error in PDA generation or Solana call:", error);
      throw error;
    }
  },
  onSuccess: () => {
    toast.success("Score finalized successfully!");
    setEditingAttempts(new Set());
    queryClient.invalidateQueries({ queryKey: ['examAttempts', examId] });
    queryClient.invalidateQueries({ queryKey: ['getStudentAttempts'] });
  },
  onError: (error) => {
    console.error("Error finalizing score:", error);
    toast.error("Failed to finalize score. Check console for details.");
  }
});



  const updateRemarkMutation = useMutation({
    mutationFn: ({ requestId, newStatus, adminNotes }: { requestId: string; newStatus: RemarkRequestStatus; adminNotes: string | null }) =>
      updateRemarkRequestStatus(requestId, newStatus, adminNotes, supabaseClient),
    onSuccess: async () => {
      
      toast.success("Remark request updated successfully!");
      
      
      if (currentRemarkRequest) {
        const attemptId = currentRemarkRequest.attempt_id;
        const attemptScores = scores[attemptId];
        const currentAttempt = attempts?.find(att => att.id === attemptId);
        
        if (attemptScores && currentAttempt && examData) {
          const totalScore = (attemptScores.sba || 0) + (attemptScores.short || 0);
          const maxPossibleScore = examData.question_config?.max_marks || 100;
          const gradesToSave = manualGrades[attemptId];

          try {
            await finalizeScoreMutation.mutateAsync({
              attemptId,
              finalScore: totalScore,
              maxPossibleScore,
              attemptManualGrades: gradesToSave,
              studentSupabaseId: currentAttempt.student_id, 
              examSupabaseId: examData.id, 
              examAuthorityId: examData.authority_id, 
            });
          } catch (error) {
            console.error("Error finalizing score during remark:", error);
            toast.error("Remark request updated but failed to finalize score.");
          }
        }
      }
      
      setIsRemarkDialog(false);
      setCurrentRemarkRequest(null);
      setNewRemarkStatus('');
      setNewAdminNotes('');
      setRemarkDialogQuestionDetails([]);
      refetchRemarkRequests();
    },
    onError: (error) => {
      console.error("Error updating remark request:", error);
      toast.error("Failed to update remark request.");
    },
  });

  const handleScoreChange = (attemptId: string, type: 'sba' | 'short', value: number) => {
    setScores(prev => ({
      ...prev,
      [attemptId]: {
        ...prev[attemptId],
        [type]: value
      }
    }));
  };

  const handleEditToggle = (attemptId: string) => {
    setEditingAttempts(prev => {
      const newSet = new Set(prev);
      if (newSet.has(attemptId)) {
        newSet.delete(attemptId);
              
      if (attempts && examQuestions) {
        const attempt = attempts.find(att => att.id === attemptId);
        if (attempt) {
          const resetGrades: Record<number, boolean> = {};
          
          examQuestions.forEach((examQuestion: ExamQuestionWithDetails) => {
            const question = examQuestion.questions;
            if (question) {
              const questionOrder = examQuestion.question_order;
              const studentAnswer = getStudentAnswer(attempt, questionOrder, question.question_type);
              const autoGrade = isAnswerCorrect(studentAnswer, question.correct_answer, question.question_type);
              
              
              const persistedManualGrade = attempt.manual_grades?.[questionOrder];
              resetGrades[questionOrder] = persistedManualGrade !== undefined ? persistedManualGrade : autoGrade;
            }
          });
          
          setManualGrades(prev => ({
            ...prev,
            [attemptId]: resetGrades
          }));
          
          
          const sbaScore = calculateSBAScoreFromGrades(attemptId, { ...manualGrades, [attemptId]: resetGrades });
          const shortScore = calculateShortScoreFromGrades(attemptId, { ...manualGrades, [attemptId]: resetGrades });
          
          setScores(prevScores => ({
            ...prevScores,
            [attemptId]: {
              sba: sbaScore,
              short: shortScore
            }
          }));
        }
      }

      } else {
        newSet.add(attemptId);
      }
      return newSet;
    });
  };

  const handleExpandToggle = (attemptId: string) => {
    setExpandedAttemptId(prev => prev === attemptId ? null : attemptId);
  };

  
const validatePublicKeyString = (keyString: string, keyName: string): boolean => {
  try {
    if (!keyString) {
      console.error(`${keyName} is null/undefined:`, keyString);
      return false;
    }
    
    if (typeof keyString !== 'string') {
      console.error(`${keyName} is not a string:`, keyString);
      return false;
    }
    
    
    const invalidChars = /[0OIl]/g;
    if (invalidChars.test(keyString)) {
      console.error(`${keyName} contains invalid base58 characters (0, O, I, l):`, keyString);
      return false;
    }
    
    
    new PublicKey(keyString);
    console.log(`${keyName} is valid:`, keyString);
    return true;
  } catch (error) {
    console.error(`${keyName} validation failed:`, error, keyString);
    return false;
  }
};


 const handleFinalizeScore = async (attemptId: string) => {
  const attemptScores = scores[attemptId];
  const currentAttempt = attempts?.find(att => att.id === attemptId);

  if (!attemptScores || !currentAttempt || !examData) {
    toast.error("Missing data to finalize score.");
    return;
  }

  
  const totalScore = (attemptScores.sba || 0) + (attemptScores.short || 0);
  
  
  const maxPossibleScore = examData.question_config?.max_marks || 100;

  
  const gradesToSave = manualGrades[attemptId];

  console.log("handleFinalizeScore: gradesToSave before mutation:", gradesToSave);
  
  try {
    await finalizeScoreMutation.mutateAsync({
      attemptId,
      finalScore: totalScore,
      maxPossibleScore,
      attemptManualGrades: gradesToSave,
      studentSupabaseId: currentAttempt.student_id,
      examSupabaseId: examData.id,
      examAuthorityId: examData.authority_id,
    });
  } catch (error) {
    console.error("Error in handleFinalizeScore:", error);
    toast.error("Failed to finalize score. Check console for details.");
  }
};



  
  const isLoading = attemptsLoading || examLoading || questionsLoading ||
                   isLoadingLecturerProfiles || isLoadingStudentProfiles || isLoadingExamMetadata;
  
  const isError = attemptsError;

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto p-6 text-center">
        <Loader2 className="w-8 h-8 animate-spin mx-auto" />
        <p className="mt-4">Loading exam attempts...</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="max-w-4xl mx-auto p-6 text-center text-red-500">
        <XCircle className="w-8 h-8 mx-auto" />
        <p className="mt-4">Error loading exam attempts.</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GraduationCap className="w-6 h-6" />
            Exam Management - {examData?.course_title || 'Loading...'}
          </CardTitle>
          <CardDescription>
            Review and manage student attempts and remark requests for this exam.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="attempts">Student Attempts</TabsTrigger>
              <TabsTrigger value="remarks">Remark Requests</TabsTrigger>
            </TabsList>

            <TabsContent value="attempts" className="mt-6">
              <Table>
                <TableCaption>Student attempts for this exam.</TableCaption>
                <TableHeader>
                  <TableRow>
                    <TableHead>Matric no</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Start Time</TableHead>
                    <TableHead>Submit Time</TableHead>
                    <TableHead>Time Spent</TableHead>
                    <TableHead>SBA Score</TableHead>
                    <TableHead>Short Score</TableHead>
                    <TableHead>Final Score</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {attempts && attempts.length > 0 ? (
                    attempts.map((attempt: AttemptWithProfile) => {
                      const isGraded = attempt.status === "graded";
                      const canGrade = attempt.status === "submitted" || isGraded;
                      const isEditing = editingAttempts.has(attempt.id);
                      const isExpanded = expandedAttemptId === attempt.id;
                      const currentScores = scores[attempt.id];
                      
                      return (
                        <React.Fragment key={attempt.id}>
                          <TableRow>
                            <TableCell className="font-medium">
                              {attempt.students?.matric_no ||
                              attempt.profiles?.full_name || 
                               attempt.student_id.slice(0, 8) + '...'}
                            </TableCell>
                            <TableCell>
                              <span className={`inline-flex px-2 py-1 text-xs rounded-full capitalize ${
                                attempt.status === "in_progress" ? "bg-blue-100 text-blue-800" :
                                attempt.status === "submitted" ? "bg-yellow-100 text-yellow-800" :
                                attempt.status === "graded" ? "bg-green-100 text-green-800" :
                                attempt.status === "expired" ? "bg-red-100 text-red-800" :
                                "bg-gray-100 text-gray-800"
                              }`}>
                                {attempt.status.replace('_', ' ')}
                              </span>
                            </TableCell>
                            <TableCell>
                              {attempt.start_ts && !isNaN(new Date(attempt.start_ts).getTime()) ? format(new Date(attempt.start_ts), 'PPp') : 'N/A'}
                            </TableCell>
                            <TableCell>
                              {attempt.submit_ts && !isNaN(new Date(attempt.submit_ts).getTime()) ? format(new Date(attempt.submit_ts), 'PPp') : 'N/A'}
                            </TableCell>
                            <TableCell>
                              {attempt.time_spent_seconds ? `${Math.floor(attempt.time_spent_seconds / 60)}m ${attempt.time_spent_seconds % 60}s` : 'N/A'}
                            </TableCell>
                            <TableCell>
                              {canGrade && isEditing ? (
                                <Input
                                  type="number"
                                  min="0"
                                  value={currentScores?.sba || 0}
                                  placeholder="SBA Score"
                                  className="w-20"
                                  onChange={(e) => handleScoreChange(attempt.id, 'sba', parseInt(e.target.value) || 0)}
                                />
                              ) : (
                                <span className="font-medium">
                                  {currentScores?.sba ?? 'N/A'}
                                </span>
                              )}
                            </TableCell>
                            <TableCell>
                              {canGrade && isEditing ? (
                                <Input
                                  type="number"
                                  min="0"
                                  value={currentScores?.short || 0}
                                  placeholder="Short Score"
                                  className="w-20"
                                  onChange={(e) => handleScoreChange(attempt.id, 'short', parseInt(e.target.value) || 0)}
                                />
                              ) : (
                                <span className="font-medium">
                                  {currentScores?.short ?? 'N/A'}
                                </span>
                              )}
                            </TableCell>
                            <TableCell>
                              <span className="font-semibold">
                                {isGraded ? `${attempt.final_score}/${attempt.max_possible_score}` : 'Pending'}
                              </span>
                              {isGraded && attempt.final_score !== undefined && attempt.max_possible_score !== undefined && (
                                <span className="ml-2 text-sm text-gray-500">
                                  ({Math.round((attempt.final_score / attempt.max_possible_score) * 100)}%)
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex gap-2 justify-end">
                                {(canGrade || isGraded) && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleExpandToggle(attempt.id)}
                                  >
                                    {isExpanded ? (
                                      <ChevronUp className="w-4 h-4 mr-2" />
                                    ) : (
                                      <ChevronDown className="w-4 h-4 mr-2" />
                                    )}
                                    {isExpanded ? 'Hide Details' : 'View Details'}
                                  </Button>
                                )}
                                {canGrade && !isEditing && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleEditToggle(attempt.id)}
                                  >
                                    <Edit3 className="w-4 h-4 mr-2" />
                                    {isGraded ? 'Remark' : 'Grade'}
                                  </Button>
                                )}
                                {canGrade && isEditing && (
                                  <>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handleEditToggle(attempt.id)}
                                    >
                                      Cancel
                                    </Button>
                                    <Button
                                      size="sm"
                                      onClick={() => handleFinalizeScore(attempt.id)}
                                      disabled={finalizeScoreMutation.isPending}
                                    >
                                      {finalizeScoreMutation.isPending ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                      ) : (
                                        <CheckCircle className="w-4 h-4 mr-2" />
                                      )}
                                      {isGraded ? 'Update Score' : 'Finalize'}
                                    </Button>
                                  </>
                                )}
                                {isGraded && !isEditing && (
                                  <span className="text-sm text-green-600 flex items-center">
                                    <CheckCircle className="w-4 h-4 mr-1" />
                                    Graded
                                  </span>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                          
                          {/* Expanded Question Details */}
                          {isExpanded && examQuestions && (
                            <TableRow>
                              <TableCell colSpan={9} className="bg-gray-50 p-6">
                                <div className="space-y-4">
                                  <h4 className="font-semibold text-lg mb-4">Question-by-Question Breakdown</h4>
                                  {examQuestions
                                    .sort((a: ExamQuestionWithDetails, b: ExamQuestionWithDetails) => a.question_order - b.question_order)
                                    .map((examQuestion: ExamQuestionWithDetails, index: number) => {
                                      const question = examQuestion.questions;
                                      if (!question) return null;
                                      
                                      const studentAnswer = getStudentAnswer(attempt, examQuestion.question_order, question.question_type);
                                      const autoGrade = isAnswerCorrect(studentAnswer, question.correct_answer, question.question_type);
                                      const currentGrade = getCurrentGrade(attempt.id, examQuestion.question_order, autoGrade);
                                      const isEditing = editingAttempts.has(attempt.id);
                                      
                                      return (
                                        <div key={examQuestion.id || index} className="border border-gray-200 rounded-lg p-4 bg-white">
                                          <div className="flex items-start justify-between mb-2">
                                            <span className="text-sm font-medium text-gray-500">
                                              Question {examQuestion.question_order + 1} ({question.question_type})
                                            </span>
                                            <div className="flex items-center gap-2">
                                              {isEditing ? (
                                                <button
                                                  onClick={() => handleGradeToggle(attempt.id, examQuestion.question_order)}
                                                  className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium cursor-pointer transition-colors ${
                                                    currentGrade 
                                                      ? 'bg-green-100 text-green-800 hover:bg-green-200' 
                                                      : 'bg-red-100 text-red-800 hover:bg-red-200'
                                                  }`}
                                                >
                                                  {currentGrade ? (
                                                    <>
                                                      <CheckCircle className="w-3 h-3 mr-1" />
                                                      Correct (click to mark incorrect)
                                                    </>
                                                  ) : (
                                                    <>
                                                      <XCircle className="w-3 h-3 mr-1" />
                                                      Incorrect (click to mark correct)
                                                    </>
                                                  )}
                                                </button>
                                              ) : (
                                                <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                                                  currentGrade 
                                                    ? 'bg-green-100 text-green-800' 
                                                    : 'bg-red-100 text-red-800'
                                                }`}>
                                                  {currentGrade ? (
                                                    <>
                                                      <CheckCircle className="w-3 h-3 mr-1" />
                                                      Correct
                                                    </>
                                                  ) : (
                                                    <>
                                                      <XCircle className="w-3 h-3 mr-1" />
                                                      Incorrect
                                                    </>
                                                  )}
                                                </span>
                                              )}
                                            </div>
                                          </div>
                                          
                                          <div className="mb-3">
                                            <p className="font-medium text-blue-900">{question.question_text}</p>
                                          </div>
                                          
                                          {question.question_type === 'SBA' && question.options && (
                                            <div className="mb-3">
                                              <p className="text-sm text-gray-600 mb-2">Options:</p>
                                              <div className="space-y-1">
                                                {question.options.map((option: string, optionIndex: number) => (
                                                  <div 
                                                    key={optionIndex}
                                                    className={`text-sm p-2 rounded ${
                                                      optionIndex === Number(question.correct_answer)
                                                        ? 'bg-green-100 text-green-800'
                                                        : optionIndex === Number(studentAnswer)
                                                        ? 'bg-blue-100 text-blue-800'
                                                        : 'bg-gray-100'
                                                    }`}
                                                  >
                                                    {String.fromCharCode(65 + optionIndex)}. {option}
                                                    {optionIndex === Number(question.correct_answer) && (
                                                      <span className="ml-2 text-xs font-medium">(Correct Answer)</span>
                                                    )}
                                                    {optionIndex === Number(studentAnswer) && optionIndex !== Number(question.correct_answer) && (
                                                      <span className="ml-2 text-xs font-medium">(Student&apos;s Answer)</span>
                                                    )}
                                                  </div>
                                                ))}
                                              </div>
                                            </div>
                                          )}
                                          
                                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                            <div>
                                              <p className="font-medium text-black">Student&apos;s Answer:</p>
                                              <p className={`mt-1 p-2 rounded text-black ${
                                                currentGrade ? 'bg-green-50' : 'bg-red-50'
                                              }`}>
                                                {studentAnswer !== undefined && studentAnswer !== null 
                                                  ? (question.question_type === 'SBA' 
                                                      ? `${String.fromCharCode(65 + Number(studentAnswer))} (${studentAnswer})`
                                                      : String(studentAnswer))
                                                  : 'No answer provided'
                                                }
                                              </p>
                                            </div>
                                            
                                            <div>
                                              <p className="font-medium text-black">Correct Answer:</p>
                                              <p className="mt-1 p-2 bg-green-50 rounded text-black">
                                                {question.question_type === 'SBA' 
                                                  ? `${String.fromCharCode(65 + Number(question.correct_answer))} (${question.correct_answer})`
                                                  : Array.isArray(question.correct_answer)
                                                    ? question.correct_answer.join(', ')
                                                    : String(question.correct_answer)
                                                }
                                              </p>
                                            </div>
                                          </div>
                                          
                                          {/* Show auto-grade vs manual grade difference when editing */}
                                          {isEditing && autoGrade !== currentGrade && (
                                            <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded text-sm">
                                              <p className="text-yellow-800">
                                                <strong>Grade Override:</strong> Auto-grade was {autoGrade ? 'Correct' : 'Incorrect'}, 
                                                manually set to {currentGrade ? 'Correct' : 'Incorrect'}
                                              </p>
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })}
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </React.Fragment>
                      );
                    })
                  ) : (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center">
                        No attempts found for this exam.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TabsContent>

            <TabsContent value="remarks" className="mt-6">
              <h3 className="text-lg font-semibold mb-4">Remark Requests</h3>
              {remarkRequestsLoading ? (
                <div className="text-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto" />
                  <p className="mt-2">Loading remark requests...</p>
                </div>
              ) : remarkRequestsError ? (
                <div className="text-center py-8 text-red-500">
                  <XCircle className="w-6 h-6 mx-auto" />
                  <p className="mt-2">Error loading remark requests.</p>
                </div>
              ) : remarkRequests && remarkRequests.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student</TableHead>
                      <TableHead>Requested Questions</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Requested On</TableHead>
                      <TableHead>Admin Notes</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {remarkRequests.map((request) => (
                      <TableRow key={request.id}>
                        <TableCell className="font-medium">
                          {request.profiles?.full_name || request.student_id.slice(0, 8) + '...'}
                        </TableCell>
                        <TableCell>{request.requested_questions.map(q => `Q${q + 1}`).join(', ')}</TableCell>
                        <TableCell>{request.reason}</TableCell>
                        <TableCell>
                          <span className={`inline-flex px-2 py-1 text-xs rounded-full capitalize ${
                            request.status === RemarkRequestStatus.PENDING ? "bg-yellow-100 text-yellow-800" :
                            request.status === RemarkRequestStatus.REVIEWED ? "bg-blue-100 text-blue-800" :
                            request.status === RemarkRequestStatus.COMPLETED ? "bg-green-100 text-green-800" :
                            "bg-red-100 text-red-800"
                          }`}>
                            {request.status.replace('_', ' ')}
                          </span>
                        </TableCell>
                        <TableCell>{format(new Date(request.created_at), 'PPp')}</TableCell>
                        <TableCell>{request.admin_notes || 'N/A'}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              
                              const attempt = attempts?.find(att => att.id === request.attempt_id);
                              if (!attempt || !examQuestions) {
                                toast.error("Unable to load attempt or question details");
                                return;
                              }

                              
                              const questionDetails: RemarkDialogQuestionDetail[] = request.requested_questions.map(questionOrder => {
                                const examQuestion = examQuestions.find(eq => eq.question_order === questionOrder);
                                const question = examQuestion?.questions;
                                
                                if (!question) {
                                  throw new Error(`Question not found for order ${questionOrder}`);
                                }

                                const studentAnswer = getStudentAnswer(attempt, questionOrder, question.question_type);
                                const autoGrade = isAnswerCorrect(studentAnswer, question.correct_answer, question.question_type);
                                const currentGrade = getCurrentGrade(attempt.id, questionOrder, autoGrade);

                                return {
                                  questionOrder,
                                  questionText: question.question_text,
                                  questionType: question.question_type,
                                  options: question.options,
                                  studentAnswer,
                                  correctAnswer: question.correct_answer,
                                  autoGrade,
                                  currentGrade
                                };
                              });

                              setRemarkDialogQuestionDetails(questionDetails);
                              setCurrentRemarkRequest(request);
                              setNewRemarkStatus(request.status);
                              setNewAdminNotes(request.admin_notes || '');
                              setIsRemarkDialog(true);
                            }}
                          >
                            <Edit3 className="w-4 h-4 mr-2" />
                            Manage
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-center py-8 text-gray-500">No remark requests for this exam.</p>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Remark Request Management Dialog */}
      <Dialog open={isRemarkDialog} onOpenChange={setIsRemarkDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Manage Remark Request</DialogTitle>
          </DialogHeader>
          {currentRemarkRequest && (
            <div className="grid gap-6 py-4">
              {/* Basic Request Info */}
              <div className="space-y-2">
                <p><strong>Student:</strong> {currentRemarkRequest.profiles?.matric_no || currentRemarkRequest.profiles?.full_name || currentRemarkRequest.student_id}</p>
                <p><strong>Questions:</strong> {currentRemarkRequest.requested_questions.map(q => `Q${q + 1}`).join(', ')}</p>
                <p><strong>Reason:</strong> {currentRemarkRequest.reason}</p>
                <p><strong>Current Score:</strong> {currentRemarkRequest.attempts?.final_score}/{currentRemarkRequest.attempts?.max_possible_score}</p>
              </div>

              {/* Question Details */}
              <div className="space-y-4">
                <h4 className="font-semibold text-lg">Question Details</h4>
                {remarkDialogQuestionDetails.map((detail) => (
                  <div key={detail.questionOrder} className="border border-gray-200 rounded-lg p-4 bg-white">
                    <div className="flex items-start justify-between mb-3">
                      <span className="text-sm font-medium text-gray-500">
                        Question {detail.questionOrder + 1} ({detail.questionType})
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleRemarkQuestionGradeToggle(detail.questionOrder)}
                          className={`inline-flex items-center px-3 py-1 rounded text-sm font-medium cursor-pointer transition-colors ${
                            detail.currentGrade 
                              ? 'bg-green-100 text-green-800 hover:bg-green-200' 
                              : 'bg-red-100 text-red-800 hover:bg-red-200'
                          }`}
                        >
                          {detail.currentGrade ? (
                            <>
                              <CheckCircle className="w-4 h-4 mr-1" />
                              Correct (click to mark incorrect)
                            </>
                          ) : (
                            <>
                              <XCircle className="w-4 h-4 mr-1" />
                              Incorrect (click to mark correct)
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                    
                    <div className="mb-3">
                      <p className="font-medium text-blue-900">{detail.questionText}</p>
                    </div>
                    
                    {detail.questionType === 'SBA' && detail.options && (
                      <div className="mb-3">
                        <p className="text-sm text-gray-600 mb-2">Options:</p>
                        <div className="space-y-1">
                          {detail.options.map((option: string, optionIndex: number) => (
                            <div 
                              key={optionIndex}
                              className={`text-sm p-2 rounded ${
                                optionIndex === Number(detail.correctAnswer)
                                  ? 'bg-green-100 text-green-800'
                                  : optionIndex === Number(detail.studentAnswer)
                                  ? 'bg-blue-100 text-blue-800'
                                  : 'bg-gray-100'
                              }`}
                            >
                              {String.fromCharCode(65 + optionIndex)}. {option}
                              {optionIndex === Number(detail.correctAnswer) && (
                                <span className="ml-2 text-xs font-medium">(Correct Answer)</span>
                              )}
                              {optionIndex === Number(detail.studentAnswer) && optionIndex !== Number(detail.correctAnswer) && (
                                <span className="ml-2 text-xs font-medium">(Student`&apos;`s Answer)</span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="font-medium text-black">Student Answer:</p>
                        <p className={`mt-1 p-2 rounded text-black ${
                          detail.currentGrade ? 'bg-green-50' : 'bg-red-50'
                        }`}>
                          {detail.studentAnswer !== undefined && detail.studentAnswer !== null 
                            ? (detail.questionType === 'SBA' 
                                ? `${String.fromCharCode(65 + Number(detail.studentAnswer))} (${detail.studentAnswer})`
                                : String(detail.studentAnswer))
                            : 'No answer provided'
                          }
                        </p>
                      </div>
                      
                      <div>
                        <p className="font-medium text-black">Correct Answer:</p>
                        <p className="mt-1 p-2 bg-green-50 rounded text-black">
                          {detail.questionType === 'SBA' 
                            ? `${String.fromCharCode(65 + Number(detail.correctAnswer))} (${detail.correctAnswer})`
                            : Array.isArray(detail.correctAnswer)
                              ? detail.correctAnswer.join(', ')
                              : String(detail.correctAnswer)
                          }
                        </p>
                      </div>
                    </div>
                    
                    {/* Show auto-grade vs manual grade difference */}
                    {detail.autoGrade !== detail.currentGrade && (
                      <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded text-sm">
                        <p className="text-yellow-800">
                          <strong>Grade Override:</strong> Auto-grade was {detail.autoGrade ? 'Correct' : 'Incorrect'}, 
                          manually set to {detail.currentGrade ? 'Correct' : 'Incorrect'}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Status and Notes */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="remark-status">Status</Label>
                  <Select value={newRemarkStatus} onValueChange={(value: RemarkRequestStatus) => setNewRemarkStatus(value)}>
                    <SelectTrigger id="remark-status">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.values(RemarkRequestStatus).map((status) => (
                        <SelectItem key={status} value={status}>
                          {status.replace('_', ' ')}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="admin-notes">Admin Notes</Label>
                  <Textarea
                    id="admin-notes"
                    placeholder="Add notes for this remark request..."
                    value={newAdminNotes}
                    onChange={(e) => setNewAdminNotes(e.target.value)}
                    rows={3}
                  />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRemarkDialog(false)}>Cancel</Button>
            <Button
              onClick={() => {
                if (currentRemarkRequest && newRemarkStatus) {
                  updateRemarkMutation.mutate({
                    requestId: currentRemarkRequest.id,
                    newStatus: newRemarkStatus,
                    adminNotes: newAdminNotes.trim() || null,
                  });
                }
              }}
              disabled={updateRemarkMutation.isPending}
            >
              {updateRemarkMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ExamAttemptsPage;
