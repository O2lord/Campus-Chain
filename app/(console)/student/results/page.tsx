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
import { XCircle, Loader2, BookOpen,  Eye } from "lucide-react";
import { useSupabaseClient, useUser } from '@supabase/auth-helpers-react';
import { useQuery,} from '@tanstack/react-query';
//import { toast } from "sonner";
import {  useEffect} from 'react';
import Link from 'next/link';
import { getAllPublishedExams } from '@/services/examService';
import { getAttemptsByStudent } from '@/services/attemptService';
// Remove unused import
// import { useRouter } from 'next/navigation';

// Add type definitions for better type safety
interface Attempt {
  id: string;
  exam_id: string;
  status: string;
  final_score?: number | null;
  max_possible_score?: number | null;
}

interface Exam {
  id: string;
  course_title: string;
  course_code: string;
  duration_secs: number;
  results_published: boolean;
  show_scores_immediately: boolean; // Add this property
  show_correct_answers: boolean;
}

const ResultPage = () => {
  const supabaseClient = useSupabaseClient();
  //const queryClient = useQueryClient();
  const user = useUser();
  // Remove unused router declaration
  // const router = useRouter();

    useEffect(() => {
    const fetchSession = async () => {
      const { data: { session } } = await supabaseClient.auth.getSession();
      if (session) {
        console.log("Current Session:", session);
        console.log("Access Token (JWT):", session.access_token);
        // You can also decode the JWT to see its payload
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
  
  // Fetch published exams
  const { 
    data: exams, 
    isLoading: isLoadingExams, 
    isError: isErrorExams 
  } = useQuery({
    queryKey: ['published-exams'],
    queryFn: () => getAllPublishedExams(supabaseClient),
    enabled: !!supabaseClient
  });

  // Fetch student attempts
  const { 
    data: attempts, 
    isLoading: isLoadingAttempts, 
    isError: isErrorAttempts,
    
  } = useQuery({
    queryKey: ['student-attempts', user?.id],
    queryFn: () => getAttemptsByStudent(user!.id, supabaseClient),
    enabled: !!user?.id && !!supabaseClient
  });

  // Show loading if user is not loaded yet
  if (!user) {
    return (
      <div className="max-w-4xl mx-auto p-6 text-center">
        <Loader2 className="w-8 h-8 animate-spin mx-auto" />
        <p className="mt-4">Loading user data...</p>
      </div>
    );
  }
  if (isLoadingExams || isLoadingAttempts ) {
    return (
      <div className="max-w-4xl mx-auto p-6 text-center">
        <Loader2 className="w-8 h-8 animate-spin mx-auto" />
        <p className="mt-4">Loading exam simulator...</p>
      </div>
    );
  }

  if (isErrorExams || isErrorAttempts ) {
    return (
      <div className="max-w-4xl mx-auto p-6 text-center text-red-500">
        <XCircle className="w-8 h-8 mx-auto" />
        <p className="mt-4">Error loading exam data.</p>
      </div>
    );
  }

  // Updated helper functions to accept attempt object directly
  const getAttemptScore = (attempt: Attempt) => {
    if (attempt && attempt.status === 'graded') {
      const finalScore = attempt.final_score !== undefined && attempt.final_score !== null ? attempt.final_score : 'N/A';
      const maxPossibleScore = attempt.max_possible_score !== undefined && attempt.max_possible_score !== null ? attempt.max_possible_score : 'N/A';

      if (finalScore !== 'N/A' && maxPossibleScore !== 'N/A') {
        return `${finalScore}/${maxPossibleScore}`;
      }
    }
    return "N/A";
  };

  const getAttemptPercentage = (attempt: Attempt) => {
    if (attempt && attempt.status === 'graded' &&
        attempt.final_score !== undefined && attempt.final_score !== null &&
        attempt.max_possible_score !== undefined && attempt.max_possible_score !== null) {
      return Math.round((attempt.final_score / attempt.max_possible_score) * 100);
    }
    return null;
  };

    const canViewScores = (exam: Exam, attempt: Attempt) => {
    // Student can view results if:
    // 1. Exam allows immediate scores AND attempt is graded/submitted
    // OR
    // 2. Exam results are published AND attempt is graded/submitted
    const isAttemptReady = attempt?.status === 'graded' || attempt?.status === 'submitted';
    const canSeeImmediately = exam?.show_scores_immediately && isAttemptReady;
    const canSeePublished = exam?.results_published && isAttemptReady;

    return canSeeImmediately || canSeePublished;
  };
  const canViewResults = (exam: Exam, attempt: Attempt) => {
    // Student can view results if:
    // 1. Exam is graded/submitted
    // 2. Exam allows immediate scores 
    // 3. Exam results are published 
    // 4. Show correct answers is true
    const isAttemptReady = attempt?.status === 'graded' || attempt?.status === 'submitted';
    const canSeeImmediately = exam?.show_scores_immediately && isAttemptReady;
    const canSeePublished = exam?.results_published && isAttemptReady;
    const canShowCorrectAnswer = exam?.show_correct_answers && isAttemptReady;

    return canSeeImmediately && canSeePublished && canShowCorrectAnswer;
  };

  const formatStatus = (status: string) => {
    switch (status) {
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">Exam Results</h1>
          <p className="text-lg text-gray-600">View your submitted and graded exam results</p>
        </div>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="w-6 h-6" />
              Your Exam Results
            </CardTitle>
            <CardDescription>
              Results for your submitted and graded exams.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableCaption>List of your submitted or graded exam attempts.</TableCaption>
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
                {attempts && attempts.length > 0 ? (
                  attempts.filter(att => att.status === 'graded' || att.status === 'submitted').map((attempt) => {
                    // Find the corresponding exam details
                    const exam = exams?.find(e => e.id === attempt.exam_id);
                    if (!exam) return null; // Skip if exam details not found

                    const status = attempt.status; // Use attempt's status directly

                    return (
                      <TableRow key={attempt.id}>
                        <TableCell className="font-medium">{exam.course_title}</TableCell>
                        <TableCell>{exam.course_code}</TableCell>
                        <TableCell>{Math.round(exam.duration_secs / 60)} minutes</TableCell>
                        <TableCell>
                          <span className={`inline-flex px-2 py-1 text-xs rounded-full ${
                            status === "submitted" ? "bg-yellow-100 text-yellow-800" :
                            status === "graded" ? "bg-green-100 text-green-800" :
                            "bg-gray-100 text-gray-800" // Fallback, though should only be submitted/graded
                          }`}>
                            {formatStatus(status)}
                          </span>
                        </TableCell>
                        <TableCell>
                          {canViewScores(exam, attempt) ? (
                            <>
                              {getAttemptScore(attempt)}
                              {(() => {
                                const percentage = getAttemptPercentage(attempt);
                                return percentage !== null ? (
                                  <span className="ml-2 text-sm text-gray-500">
                                    ({percentage}%)
                                  </span>
                                ) : null;
                              })()}
                            </>
                          ) : (
                            <span className="text-gray-500">please wait</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {canViewResults(exam, attempt) && (
                            <Link href={`/student/results/${attempt.id}`}>
                              <Button
                                size="sm"
                                variant="outline"
                                className="ml-2"
                              >
                                <Eye className="w-4 h-4 mr-2" />
                                View Results
                              </Button>
                            </Link>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center">
                      No submitted or graded exams available.
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

export default ResultPage;