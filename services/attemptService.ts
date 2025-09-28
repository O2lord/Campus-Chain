import { SupabaseClient } from '@supabase/supabase-js';
import { getQuestionById } from './questionBankService';
import { getExamQuestionsByExamPubkey } from './examQuestionService';

// Enum for attempt status
export enum AttemptStatus {
  IN_PROGRESS = 'in_progress',
  SUBMITTED = 'submitted',
  GRADED = 'graded',
  EXPIRED = 'expired'
}

// Enum for remark request status
export enum RemarkRequestStatus {
  PENDING = 'pending',
  REVIEWED = 'reviewed',
  REJECTED = 'rejected',
  COMPLETED = 'completed'
}

// Interface for Attempt data
export interface Attempt {
  id: string;
  student_id: string;
  exam_id: string;
  status: AttemptStatus;
  start_ts: string; // Unix timestamp when attempt started
  submit_ts?: string; // Unix timestamp when answers were submitted
  answers_commitment?: string; // Hash/commitment of the answers
  sba_answers?: number[]; // Single Best Answer (multiple choice) responses
  short_answers?: string[]; // Short answer responses
  essay_answers?: string[]; // Essay responses (if applicable)
  final_score?: number;
  max_possible_score?: number;
  manual_grades?: Record<number, boolean>;
  time_spent_seconds?: number; // Total time spent on the attempt
  created_at?: string;
  updated_at?: string;
}



// Interface for Remark Request data
export interface RemarkRequest {
  id: string;
  attempt_id: string;
  student_id: string;
  requested_questions: number[]; // Array of question_order numbers
  reason: string;
  status: RemarkRequestStatus;
  admin_notes?: string;
  created_at: string;
  updated_at: string;
  attempts?:  {
    id: string;
    student_id: string;
    final_score?: number;
    max_possible_score?: number;
    exam_id?: string; // Add this as we are selecting it in the query
  };
  profiles?: {
    full_name?: string;
    matric_no?: string;
    wallet?: string;
    
  };
}

// Type for creating new attempts
export type CreateAttemptData = Pick<Attempt, 'student_id' | 'exam_id' | 'start_ts'>;

// Type for creating new remark requests
export type CreateRemarkRequestData = Pick<RemarkRequest, 'attempt_id' | 'student_id' | 'requested_questions' | 'reason'>;

// Type for answer submission
export interface AnswerSubmission {
  sbaAnswers?: number[];
  shortAnswers?: string[];
  essayAnswers?: string[];
  answersCommitment?: string;
}

// Type for score calculation result
export interface ScoreResult {
  finalScore: number;
  maxPossibleScore: number;
}

// Error types for better error handling
export class AttemptServiceError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
    this.name = 'AttemptServiceError';
  }
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
 * Returns a value between 0 (no similarity) and 1 (identical).
 */
function calculateSimilarity(s1: string, s2: string): number {
  const longer = s1.length > s2.length ? s1 : s2;
  const shorter = s1.length > s2.length ? s2 : s1;

  if (longer.length === 0) {
    return 1.0; // Both strings are empty, consider them 100% similar
  }

  const distance = levenshteinDistance(longer, shorter);
  return (longer.length - distance) / longer.length;
}

/**
 * Utility function to generate a simple commitment hash for answers
 */
function generateAnswersCommitment(answers: {
  sbaAnswers?: number[];
  shortAnswers?: string[];
  essayAnswers?: string[];
}): string {
  // Simple hash generation - in production, use a proper cryptographic hash
  const answerString = JSON.stringify({
    sba: answers.sbaAnswers || [],
    short: answers.shortAnswers || [],
    essay: answers.essayAnswers || []
  });
  
  // Simple hash function for demonstration
  let hash = 0;
  for (let i = 0; i < answerString.length; i++) {
    const char = answerString.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  return Math.abs(hash).toString(16);
}

/**
 * Calculates the score for an attempt based on student answers and correct answers
 */
export async function calculateScoreForAttempt(
  examId: string,
  sbaAnswers: number[],
  shortAnswers: string[],
  supabase: SupabaseClient
): Promise<ScoreResult> {
  try {
    // Fetch all ExamQuestion entries for the given examId (using exam_pubkey)
    const examQuestions = await getExamQuestionsByExamPubkey(examId, supabase);
    
    let totalScore = 0;
    let maxPossibleScore = 0;

    // Define a similarity threshold (e.g., 0.7 for 70%)
    const SIMILARITY_THRESHOLD = 0.7;

    // Loop through each exam question
    for (const examQuestion of examQuestions) {
      try {
        // Fetch the full Question details
        const question = await getQuestionById(examQuestion.question_id, supabase);
        
        if (!question) {
          console.warn(`Question with ID ${examQuestion.question_id} not found, skipping...`);
          continue;
        }

        // Process based on question type
        if (question.question_type === 'SBA') {
          // For SBA questions, compare student answer with correct answer
          const studentAnswerIndex = examQuestion.question_order;
          const studentAnswer = sbaAnswers[studentAnswerIndex];
          const correctAnswer = parseInt(question.correct_answer as string, 10);

          if (studentAnswer !== undefined && studentAnswer === correctAnswer) {
            totalScore += 1; // Award 1 point for correct SBA answer
          }
          maxPossibleScore += 1; // Each SBA question is worth 1 point

        } else if (question.question_type === 'SHORT') {
          const studentAnswerIndex = examQuestion.question_order;
          const studentAnswer = shortAnswers[studentAnswerIndex];

          const correctAnswers = Array.isArray(question.correct_answer)
            ? question.correct_answer
            : [question.correct_answer as string];

          let isCorrect = false;

          if (studentAnswer && studentAnswer.trim()) {
            const normalizedStudentAnswer = normalizeString(studentAnswer);

            for (const correctAnswer of correctAnswers) {
              if (!correctAnswer || typeof correctAnswer !== 'string') {
                continue;
              }

              const normalizedCorrectAnswer = normalizeString(correctAnswer);

              if (!normalizedCorrectAnswer) {
                continue;
              }

              // First, check for direct substring inclusion (existing logic)
              if (normalizedStudentAnswer.includes(normalizedCorrectAnswer) ||
                  normalizedCorrectAnswer.includes(normalizedStudentAnswer)) {
                isCorrect = true;
                break;
              }

              // NEW: If not a direct substring, check for similarity
              const similarity = calculateSimilarity(normalizedStudentAnswer, normalizedCorrectAnswer);
              if (similarity >= SIMILARITY_THRESHOLD) {
                isCorrect = true;
                break;
              }
            }
          }

          if (isCorrect) {
            totalScore += 1;
          }
          maxPossibleScore += 1;
        }
      } catch (questionError) {
        console.error(`Error processing question ${examQuestion.question_id}:`, questionError);
        continue;
      }
    }

    return {
      finalScore: totalScore,
      maxPossibleScore: maxPossibleScore
    };

  } catch (error) {
    if (error instanceof AttemptServiceError) {
      throw error;
    }
    throw new AttemptServiceError(`Unexpected error calculating score: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Finalizes the score for an attempt (used for grading and remarking)
 */
export async function finalizeScore(
  attemptId: string,
  finalScore: number,
  supabase: SupabaseClient,
  maxPossibleScore?: number,
  manualGrades?: Record<number, boolean> 
): Promise<Attempt> {
  try {
    // First, get the current attempt to check its status
    const { data: currentAttempt, error: fetchError } = await supabase
      .from('attempts')
      .select('*')
      .eq('id', attemptId)
      .single();

    if (fetchError) {
      throw new AttemptServiceError(`Failed to fetch current attempt: ${fetchError.message}`, fetchError.code);
    }

    if (!currentAttempt) {
      throw new AttemptServiceError(`Attempt with ID ${attemptId} not found`);
    }

    // Allow grading for submitted attempts or remarking for already graded attempts
    if (currentAttempt.status !== AttemptStatus.SUBMITTED && currentAttempt.status !== AttemptStatus.GRADED) {
      throw new AttemptServiceError('Can only finalize scores for submitted or already graded attempts');
    }

    console.log("finalizeScore service: received manualGrades:", manualGrades);
    
    const updateData = {
      final_score: finalScore,
      max_possible_score: maxPossibleScore || currentAttempt.max_possible_score || 100,
      status: AttemptStatus.GRADED,
      manual_grades: manualGrades,
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('attempts')
      .update(updateData)
      .eq('id', attemptId)
      .select()
      .single();

    if (error) {
      throw new AttemptServiceError(`Failed to finalize score: ${error.message}`, error.code);
    }

    return data as Attempt;
  } catch (error) {
    if (error instanceof AttemptServiceError) {
      throw error;
    }
    throw new AttemptServiceError(`Unexpected error finalizing score: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Starts a new attempt for a student on an exam
 */
export async function startAttempt(
  examId: string,
  studentId: string,
  supabase: SupabaseClient
): Promise<Attempt> {
  try {
    // Check if student already has an active attempt for this exam
    const { data: existingAttempt, error: checkError } = await supabase
      .from('attempts')
      .select('*')
      .eq('exam_id', examId)
      .eq('student_id', studentId)
      .in('status', [AttemptStatus.IN_PROGRESS, AttemptStatus.SUBMITTED])
      .maybeSingle();

    if (checkError) {
      throw new AttemptServiceError(`Failed to check existing attempts: ${checkError.message}`, checkError.code);
    }

    if (existingAttempt) {
      throw new AttemptServiceError('Student already has an active attempt for this exam');
    }

    const attemptData: CreateAttemptData & { status: AttemptStatus } = {
      student_id: studentId,
      exam_id: examId,
      start_ts: new Date().toISOString(),
      status: AttemptStatus.IN_PROGRESS
    };

    const { data, error } = await supabase
      .from('attempts')
      .insert(attemptData)
      .select()
      .single();

    if (error) {
      throw new AttemptServiceError(`Failed to start attempt: ${error.message}`, error.code);
    }

    return data as Attempt;
  } catch (error) {
    if (error instanceof AttemptServiceError) {
      throw error;
    }
    throw new AttemptServiceError(`Unexpected error starting attempt: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Fetches a single attempt by its ID
 */
export async function getAttemptById(
  attemptId: string,
  supabase: SupabaseClient
): Promise<Attempt | null> {
  try {
    const { data, error } = await supabase
      .from('attempts')
      .select('*')
      .eq('id', attemptId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No rows returned
        return null;
      }
      throw new AttemptServiceError(`Failed to fetch attempt: ${error.message}`, error.code);
    }

    return data as Attempt;
  } catch (error) {
    if (error instanceof AttemptServiceError) {
      throw error;
    }
    throw new AttemptServiceError(`Unexpected error fetching attempt: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Fetches all attempts for a specific student
 */
export async function getAttemptsByStudent(
  studentId: string,
  supabase: SupabaseClient
): Promise<Attempt[]> {
  try {
    const { data, error } = await supabase
      .from('attempts')
      .select('*') // Changed from `*, attempts_exam_id_fkey!inner(...)` to just `*`
      .eq('student_id', studentId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error("Supabase error in getAttemptsByStudent:", error);
      throw new AttemptServiceError(`Failed to fetch attempts by student: ${error.message}`, error.code);
    }

    return data || [];
  } catch (error) {
    if (error instanceof AttemptServiceError) {
      throw error;
    }
    throw new AttemptServiceError(`Unexpected error fetching student attempts: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Fetches all attempts for a specific exam with student profile information
 */
export async function getAttemptsByExam(
  examId: string,
  supabase: SupabaseClient
): Promise<Attempt[]> {
  try {
    const { data, error } = await supabase
      .from('attempts')
      .select(`
        *,
         profiles(full_name),
         students(matric_no, wallet)
      `)
      .eq('exam_id', examId)
      .order('start_ts', { ascending: true });
      

    if (error) {
      throw new AttemptServiceError(`Failed to fetch attempts by exam: ${error.message}`, error.code);
    }

    console.log("getAttemptsByExam: Raw data from Supabase:", data);

    return data || [];
  } catch (error) {
    if (error instanceof AttemptServiceError) {
      throw error;
    }
    throw new AttemptServiceError(`Unexpected error fetching exam attempts: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Submits answers for an attempt with automatic scoring
 */
export async function submitAnswers(
  attemptId: string,
  sbaAnswers: number[],
  shortAnswers: string[],
  supabase: SupabaseClient,
  essayAnswers?: string[],
  answersCommitment?: string
): Promise<Attempt> {
  try {
    // First, get the current attempt to calculate time spent
    const { data: currentAttempt, error: fetchError } = await supabase
      .from('attempts')
      .select('*')
      .eq('id', attemptId)
      .single();

    if (fetchError) {
      throw new AttemptServiceError(`Failed to fetch current attempt: ${fetchError.message}`, fetchError.code);
    }

    if (!currentAttempt) {
      throw new AttemptServiceError(`Attempt with ID ${attemptId} not found`);
    }

    if (currentAttempt.status !== AttemptStatus.IN_PROGRESS) {
      throw new AttemptServiceError('Cannot submit answers for an attempt that is not in progress');
    }

    const submitDate = new Date();
    const startDate = new Date(currentAttempt.start_ts);
    const timeSpentSeconds = Math.floor((submitDate.getTime() - startDate.getTime()) / 1000);

    // Calculate the score for this attempt
    const scoreResult = await calculateScoreForAttempt(
      currentAttempt.exam_id,
      sbaAnswers,
      shortAnswers,
      supabase
    );

    // Generate answers commitment if not provided
    const commitment = answersCommitment || generateAnswersCommitment({
      sbaAnswers,
      shortAnswers,
      essayAnswers
    });

    const updateData = {
      sba_answers: sbaAnswers,
      short_answers: shortAnswers,
      essay_answers: essayAnswers,
      answers_commitment: commitment,
      submit_ts: submitDate.toISOString(),
      time_spent_seconds: timeSpentSeconds,
      final_score: scoreResult.finalScore,
      max_possible_score: scoreResult.maxPossibleScore,
      status: AttemptStatus.GRADED,
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('attempts')
      .update(updateData)
      .eq('id', attemptId)
      .select()
      .single();

    if (error) {
      throw new AttemptServiceError(`Failed to submit answers: ${error.message}`, error.code);
    }

    return data as Attempt;
  } catch (error) {
    if (error instanceof AttemptServiceError) {
      throw error;
    }
    throw new AttemptServiceError(`Unexpected error submitting answers: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Creates a new remark request for an attempt - WITH DEBUG LOGS
 */
export async function createRemarkRequest(
  attemptId: string,
  studentId: string,
  requestedQuestions: number[],
  reason: string,
  supabase: SupabaseClient
): Promise<RemarkRequest> {
  console.log("🚀 createRemarkRequest called with:", {
    attemptId,
    studentId,
    requestedQuestions,
    reason
  });

  try {
    console.log("📝 Step 1: Verifying attempt exists and belongs to student");
    
    // First, verify that the attempt exists and belongs to the student
    const { data: attempt, error: attemptError } = await supabase
      .from('attempts')
      .select('*')
      .eq('id', attemptId)
      .eq('student_id', studentId)
      .single();

    console.log("📊 Attempt query result:", { attempt, attemptError });

    if (attemptError) {
      console.error("❌ Attempt error:", attemptError);
      throw new AttemptServiceError(`Failed to verify attempt: ${attemptError.message}`, attemptError.code);
    }

    if (!attempt) {
      console.error("❌ No attempt found");
      throw new AttemptServiceError('Attempt not found or does not belong to the student');
    }

    console.log("✅ Attempt found:", attempt);

    if (attempt.status !== AttemptStatus.GRADED) {
      console.error("❌ Attempt status is not GRADED:", attempt.status);
      throw new AttemptServiceError('Can only request remarks for graded attempts');
    }

    console.log("📝 Step 2: Checking for existing pending remark requests");

    // Check if there's already a pending remark request for this attempt
    const { data: existingRequest, error: checkError } = await supabase
      .from('remark_requests')
      .select('*')
      .eq('attempt_id', attemptId)
      .eq('status', RemarkRequestStatus.PENDING)
      .maybeSingle();

    console.log("📊 Existing request check result:", { existingRequest, checkError });

    if (checkError) {
      console.error("❌ Check error:", checkError);
      throw new AttemptServiceError(`Failed to check existing remark requests: ${checkError.message}`, checkError.code);
    }

    if (existingRequest) {
      console.error("❌ Existing pending request found:", existingRequest);
      throw new AttemptServiceError('There is already a pending remark request for this attempt');
    }

    console.log("📝 Step 3: Creating remark request data");

    const remarkRequestData: CreateRemarkRequestData & { status: RemarkRequestStatus } = {
      attempt_id: attemptId,
      student_id: studentId,
      requested_questions: requestedQuestions,
      reason: reason.trim(),
      status: RemarkRequestStatus.PENDING
    };

    console.log("📦 Remark request data created:", remarkRequestData);
    console.log("🔍 Student ID details:", {
      fromAttempt: attempt.student_id,
      passedParameter: studentId,
      areEqual: attempt.student_id === studentId
    });

    console.log("📝 Step 4: Inserting into database");

    const { data, error } = await supabase
      .from('remark_requests')
      .insert(remarkRequestData)
      .select()
      .single();

    console.log("📊 Insert result:", { data, error });

    if (error) {
      console.error("❌ Insert error:", error);
      throw new AttemptServiceError(`Failed to create remark request: ${error.message}`, error.code);
    }

    console.log("✅ Remark request created successfully:", data);
    return data as RemarkRequest;

  } catch (error) {
    console.error("🚨 createRemarkRequest error:", error);
    if (error instanceof AttemptServiceError) {
      throw error;
    }
    throw new AttemptServiceError(`Unexpected error creating remark request: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Fetches all remark requests for a specific student
 */
export async function getRemarkRequestsByStudent(
  studentId: string,
  supabase: SupabaseClient
): Promise<RemarkRequest[]> {
  try {
    const { data, error } = await supabase
      .from('remark_requests')
      .select(`
        *,
        attempts!inner(
          id,
          exam_id,
          final_score,
          max_possible_score,
          attempts_exam_id_fkey(
            course_title,
            course_code,
            exam_date
          )
        )
      `)
      .eq('student_id', studentId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new AttemptServiceError(`Failed to fetch remark requests by student: ${error.message}`, error.code);
    }

    return data || [];
  } catch (error) {
    if (error instanceof AttemptServiceError) {
      throw error;
    }
    throw new AttemptServiceError(`Unexpected error fetching student remark requests: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Fetches all remark requests for a specific exam (for admin view)
 */
export async function getRemarkRequestsByExam(
  examId: string,
  supabase: SupabaseClient
): Promise<RemarkRequest[]> {
  try {
    const { data, error } = await supabase
      .from('remark_requests')
      .select(`
        *,
        attempts!inner(
          id,
          student_id,
          final_score,
          max_possible_score,
          exam_id 
        ),
        profiles(full_name) 
      `)
      .eq('attempts.exam_id', examId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error("Error fetching remark requests in getRemarkRequestsByExam:", error);
      throw new AttemptServiceError(`Failed to fetch remark requests by exam: ${error.message}`, error.code);
    }

    return data || [];
  } catch (error) {
    if (error instanceof AttemptServiceError) {
      throw error;
    }
    throw new AttemptServiceError(`Unexpected error fetching exam remark requests: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Updates the status of a remark request (for admin use)
 */
export async function updateRemarkRequestStatus(
  requestId: string,
  newStatus: RemarkRequestStatus,
  adminNotes: string | null,
  supabase: SupabaseClient
): Promise<RemarkRequest> {
  try {
    const updateData = {
      status: newStatus,
      admin_notes: adminNotes,
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('remark_requests')
      .update(updateData)
      .eq('id', requestId)
      .select()
      
      console.log("Supabase update response - data:", data, "error:", error);

    if (error) {
      console.error("Supabase update error details:", error.details, error.hint, error.code, error.message);
      throw new AttemptServiceError(`Failed to update remark request status: ${error.message}`, error.code);
    }

    if (!data) {
      throw new AttemptServiceError(`Remark request with ID ${requestId} not found`);
    }

    return data[0] as RemarkRequest;
  } catch (error) {
    if (error instanceof AttemptServiceError) {
      throw error;
    }
    throw new AttemptServiceError(`Unexpected error updating remark request status: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Fetches a single remark request for a given attempt ID.
 * Optionally filters by status (e.g., 'reviewed') to get notes for completed reviews.
 */
export async function getRemarkRequestByAttemptId(
  attemptId: string,
  supabase: SupabaseClient
): Promise<RemarkRequest | null> {
  try {
    const { data, error } = await supabase
      .from('remark_requests')
      .select('*') // Select all fields, including admin_notes and requested_questions
      .eq('attempt_id', attemptId)
      .in('status', [RemarkRequestStatus.REVIEWED, RemarkRequestStatus.REJECTED]) 
      .single();

    if (error) {
      if (error.code === 'PGRST116') { // No rows returned
        return null;
      }
      throw new AttemptServiceError(`Failed to fetch remark request by attempt ID: ${error.message}`, error.code);
    }
    return data as RemarkRequest;
  } catch (error) {
    if (error instanceof AttemptServiceError) {
      throw error;
    }
    throw new AttemptServiceError(`Unexpected error fetching remark request: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Fetches all attempts for a specific student with exam details
 * Includes course_title, course_code, and exam_date from the exams table
 */
export async function getStudentAttemptsWithExamDetails(
  studentId: string,
  supabase: SupabaseClient
): Promise<(Attempt & {
  exam?: {
    course_title: string;
    course_code: string;
    exam_date: string;
    duration_secs: number;
    published: boolean;
    results_published: boolean;
  };
})[]> {
  try {
    const { data, error } = await supabase
      .from('attempts')
      .select(`
        *,
        exams!attempts_exam_id_fkey (
          course_title,
          course_code,
          exam_date,
          duration_secs,
          published,
          results_published
        )
      `)
      .eq('student_id', studentId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error("Supabase error in getStudentAttemptsWithExamDetails:", error);
      throw new AttemptServiceError(`Failed to fetch student attempts with exam details: ${error.message}`, error.code);
    }

    // Transform the data to match our expected interface
    return (data || []).map(attempt => ({
      ...attempt,
      exam: attempt.exams ? {
        course_title: attempt.exams.course_title,
        course_code: attempt.exams.course_code,
        exam_date: attempt.exams.exam_date,
        duration_secs: attempt.exams.duration_secs,
        published: attempt.exams.published,
        results_published: attempt.exams.results_published
      } : undefined
    }));

  } catch (error) {
    if (error instanceof AttemptServiceError) {
      throw error;
    }
    throw new AttemptServiceError(`Unexpected error fetching student attempts with exam details: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}