import { SupabaseClient } from '@supabase/supabase-js'; // Make sure this import exists

export interface Question {
  id: string;
  question_text: string;
  question_type: 'SBA' | 'SHORT';
  options?: string[]; // For SBA questions
  correct_answer: number | string | string[]; // Can be index for SBA or string/array of strings for SHORT
  course_code: string;
  user_id: string; // Added user_id field
  created_at: string;
  updated_at: string;
}

export interface CreateQuestionData {
  question_text: string;
  question_type: 'SBA' | 'SHORT';
  options?: string[];
  correct_answer: number | string | string[]; // Can be index for SBA or string/array of strings for SHORT
  course_code: string;
  user_id: string; // Added user_id field
}

export interface UpdateQuestionData {
  question_text?: string;
  question_type?: 'SBA' | 'SHORT';
  options?: string[];
  correct_answer?: number | string;
  course_code?: string;
}

// Add a new question
export async function addQuestion(questionData: CreateQuestionData, supabase: SupabaseClient): Promise<Question> {
  const { data, error } = await supabase
    .from('questions')
    .insert(questionData)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to add question: ${error.message}`);
  }

  return data;
}

// Get all questions
export async function getQuestions(supabase: SupabaseClient): Promise<Question[]> {
  const { data, error } = await supabase
    .from('questions')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch questions: ${error.message}`);
  }

  return data || [];
}

// Get questions by course code
export async function getQuestionsByCourse(courseCode: string, supabase: SupabaseClient): Promise<Question[]> {
  const { data, error } = await supabase
    .from('questions')
    .select('*')
    .eq('course_code', courseCode)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch questions for course ${courseCode}: ${error.message}`);
  }

  return data || [];
}

// Get questions by type
export async function getQuestionsByType(questionType: 'SBA' | 'SHORT', supabase: SupabaseClient): Promise<Question[]> {
  const { data, error } = await supabase
    .from('questions')
    .select('*')
    .eq('question_type', questionType)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch ${questionType} questions: ${error.message}`);
  }

  return data || [];
}

// Get questions by course and type
export async function getQuestionsByCourseAndType(
  courseCode: string, 
  questionType: 'SBA' | 'SHORT',
  supabase: SupabaseClient
): Promise<Question[]> {
  const { data, error } = await supabase
    .from('questions')
    .select('*')
    .eq('course_code', courseCode)
    .eq('question_type', questionType)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch ${questionType} questions for course ${courseCode}: ${error.message}`);
  }

  return data || [];
}

// Get a question by ID
export async function getQuestionById(questionId: string, supabase: SupabaseClient): Promise<Question | null> {
  const { data, error } = await supabase
    .from('questions')
    .select('*')
    .eq('id', questionId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      // No rows returned
      return null;
    }
    throw new Error(`Failed to fetch question: ${error.message}`);
  }

  return data;
}

// Get questions by user ID
export async function getQuestionsByUser(userId: string, supabase: SupabaseClient): Promise<Question[]> {
  const { data, error } = await supabase
    .from('questions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch questions for user ${userId}: ${error.message}`);
  }

  return data || [];
}

// Update a question
export async function updateQuestion(id: string, updateData: UpdateQuestionData, supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from('questions')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update question: ${error.message}`);
  }

  return data;
}

// Delete a question
export async function deleteQuestion(id: string, supabase: SupabaseClient) {
  const { error } = await supabase
    .from('questions')
    .delete()
    .eq('id', id);

  if (error) {
    throw new Error(`Failed to delete question: ${error.message}`);
  }

  return true;
}

// Get distinct course codes
export async function getDistinctCourseCodes(supabase: SupabaseClient): Promise<string[]> {
  const { data, error } = await supabase
    .from('questions')
    .select('course_code')
    .order('course_code');

  if (error) {
    throw new Error(`Failed to fetch course codes: ${error.message}`);
  }

  // Extract unique course codes
  const uniqueCodes = [...new Set(data?.map(item => item.course_code) || [])];
  return uniqueCodes;
}