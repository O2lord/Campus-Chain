import { SupabaseClient } from '@supabase/supabase-js';

// Interface for Exam data matching Supabase table structure
export interface Exam {
  id: string;
  authority_id: string;
  course_title: string;
  course_code: string;
  set: string; // Added set property
  instructions: string;
  exam_date: string; // ISO date string
  start_ts: string; // ISO timestamp string (timestamptz)
  end_ts: string; // ISO timestamp string (timestamptz)
  duration_secs: number;
  question_config: {
    total_questions: number;
    mcq_count: number;
    short_answer_count: number;
    essay_count: number;
    max_marks: number;
  };
  published: boolean;
  show_scores_immediately: boolean;
  show_correct_answers: boolean;
  results_published: boolean;
  created_at?: string;
  updated_at?: string;
}

// Type for creating new exams (without id)
export type CreateExamData = Omit<Exam, 'id'>;

// Error types for better error handling
export class ExamServiceError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
    this.name = 'ExamServiceError';
  }
}

/**
 * Creates a new exam record in Supabase
 */
export async function createExam(
  examData: CreateExamData,
  supabase: SupabaseClient
): Promise<Exam> {
  try {
    const { data, error } = await supabase
      .from('exams')
      .insert(examData)
      .select()
      .single();

    if (error) {
      throw new ExamServiceError(`Failed to create exam: ${error.message}`, error.code);
    }

    return data as Exam;
  } catch (error) {
    if (error instanceof ExamServiceError) {
      throw error;
    }
    throw new ExamServiceError(`Unexpected error creating exam: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Fetches all exams for a specific authority/user
 */
export async function getExamsByAuthority(
  authorityId: string, // This parameter will be ignored for now
  supabase: SupabaseClient
): Promise<Exam[]> {
  try {
    const { data, error } = await supabase
      .from('exams')
      .select('*')
      .eq('authority_id', authorityId) // TEMPORARILY REMOVED FOR PUBLIC ACCESS
      .order('created_at', { ascending: false });

    if (error) {
      throw new ExamServiceError(`Failed to fetch exams by authority: ${error.message}`, error.code);
    }

    return data || [];
  } catch (error) {
    if (error instanceof ExamServiceError) {
      throw error;
    }
    throw new ExamServiceError(`Unexpected error fetching exams: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Fetches all published exams
 */
export async function getAllPublishedExams(
  supabase: SupabaseClient,
  studentSet?: string // Add optional studentSet parameter
): Promise<Exam[]> {
  try {
    let query = supabase
      .from('exams')
      .select('*')
      .eq('published', true);

    if (studentSet) { // Apply filter if studentSet is provided
      query = query.eq('set', studentSet);
    }

    const { data, error } = await query.order('exam_date', { ascending: true });

    if (error) {
      throw new ExamServiceError(`Failed to fetch published exams: ${error.message}`, error.code);
    }

    return data || [];
  } catch (error) {
    if (error instanceof ExamServiceError) {
      throw error;
    }
    throw new ExamServiceError(`Unexpected error fetching published exams: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Fetches all published exams for a specific set
 */
export async function getPublishedExamsBySet(
  set: string,
  supabase: SupabaseClient
): Promise<Exam[]> {
  try {
    const { data, error } = await supabase
      .from('exams')
      .select('*')
      .eq('published', true)
      .eq('set', set)
      .order('exam_date', { ascending: true });

    if (error) {
      throw new ExamServiceError(`Failed to fetch published exams by set: ${error.message}`, error.code);
    }

    return data || [];
  } catch (error) {
    if (error instanceof ExamServiceError) {
      throw error;
    }
    throw new ExamServiceError(`Unexpected error fetching published exams by set: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Updates the published status of an exam
 */
export async function publishExam(
  examId: string,
  supabase: SupabaseClient
): Promise<Exam> {
  try {
    const { data, error } = await supabase
      .from('exams')
      .update({ published: true, updated_at: new Date().toISOString() })
      .eq('id', examId)
      .select()
      .single();

    if (error) {
      throw new ExamServiceError(`Failed to publish exam: ${error.message}`, error.code);
    }

    if (!data) {
      throw new ExamServiceError(`Exam with ID ${examId} not found`);
    }

    return data as Exam;
  } catch (error) {
    if (error instanceof ExamServiceError) {
      throw error;
    }
    throw new ExamServiceError(`Unexpected error publishing exam: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Updates the start and end times of an exam
 */
export async function updateExamTimes(
  examId: string,
  startTime: string, // Changed to string (ISO timestamp)
  endTime: string, // Changed to string (ISO timestamp)
  supabase: SupabaseClient
): Promise<Exam> {
  try {
    // Validate that end time is after start time
    const startDate = new Date(startTime);
    const endDate = new Date(endTime);
    
    if (endDate <= startDate) {
      throw new ExamServiceError('End time must be after start time');
    }

    // Calculate duration in seconds
    const durationSecs = Math.floor((endDate.getTime() - startDate.getTime()) / 1000);

    const { data, error } = await supabase
      .from('exams')
      .update({ 
        start_ts: startTime, 
        end_ts: endTime,
        duration_secs: durationSecs,
        updated_at: new Date().toISOString()
      })
      .eq('id', examId)
      .select()
      .single();

    if (error) {
      throw new ExamServiceError(`Failed to update exam times: ${error.message}`, error.code);
    }

    if (!data) {
      throw new ExamServiceError(`Exam with ID ${examId} not found`);
    }

    return data as Exam;
  } catch (error) {
    if (error instanceof ExamServiceError) {
      throw error;
    }
    throw new ExamServiceError(`Unexpected error updating exam times: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Fetches a single exam by its ID
 */
export async function getExamById(
  examId: string,
  supabase: SupabaseClient
): Promise<Exam | null> {
  try {
    const { data, error } = await supabase
      .from('exams')
      .select('*')
      .eq('id', examId)
      .single();

    if (error) {
      // Handle the case where no exam is found
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new ExamServiceError(`Failed to fetch exam: ${error.message}`, error.code);
    }

    return data as Exam;
  } catch (error) {
    if (error instanceof ExamServiceError) {
      throw error;
    }
    throw new ExamServiceError(`Unexpected error fetching exam: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Utility function to check if an exam is currently active
 */
export function isExamActive(exam: Exam): boolean {
  const now = new Date();
  const startTime = new Date(exam.start_ts);
  const endTime = new Date(exam.end_ts);
  return now >= startTime && now <= endTime;
}

/**
 * Utility function to check if an exam is upcoming
 */
export function isExamUpcoming(exam: Exam): boolean {
  const now = new Date();
  const startTime = new Date(exam.start_ts);
  return now < startTime;
}

/**
 * Utility function to check if an exam has ended
 */
export function isExamEnded(exam: Exam): boolean {
  const now = new Date();
  const endTime = new Date(exam.end_ts);
  return now > endTime;
}

/**
 * Utility function to get exam status
 */
export type ExamStatus = 'upcoming' | 'active' | 'ended';

export function getExamStatus(exam: Exam): ExamStatus {
  if (isExamActive(exam)) return 'active';
  if (isExamUpcoming(exam)) return 'upcoming';
  return 'ended';
}

/**
 * Utility function to format exam time for display
 */
export function formatExamTime(timestamp: string): string {
  return new Date(timestamp).toLocaleString();
}

/**
 * Utility function to calculate remaining time until exam starts
 */
export function getTimeUntilExamStart(exam: Exam): number {
  const now = new Date();
  const startTime = new Date(exam.start_ts);
  return Math.max(0, Math.floor((startTime.getTime() - now.getTime()) / 1000));
}

/**
 * Utility function to calculate remaining time in exam
 */
export function getRemainingExamTime(exam: Exam): number {
  const now = new Date();
  const endTime = new Date(exam.end_ts);
  return Math.max(0, Math.floor((endTime.getTime() - now.getTime()) / 1000));
}

/**
 * Publishes exam results, making them visible to students
 */
export async function publishExamResults(
  examId: string,
  supabase: SupabaseClient
): Promise<Exam> {
  try {
    const { data, error } = await supabase
      .from('exams')
      .update({ 
        results_published: true, 
        updated_at: new Date().toISOString() 
      })
      .eq('id', examId)
      .select()
      .single();

    if (error) {
      throw new ExamServiceError(`Failed to publish exam results: ${error.message}`, error.code);
    }

    if (!data) {
      throw new ExamServiceError(`Exam with ID ${examId} not found`);
    }

    return data as Exam;
  } catch (error) {
    if (error instanceof ExamServiceError) {
      throw error;
    }
    throw new ExamServiceError(`Unexpected error publishing exam results: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}