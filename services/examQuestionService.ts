// frontend/services/examQuestionService.ts
import { SupabaseClient } from '@supabase/supabase-js';

export interface ExamQuestion {
  id?: string;
  exam_pubkey: string;
  question_id: string;
  question_order: number;
  created_at?: string;
}

export interface ExamQuestionWithDetails extends ExamQuestion {
  questions?: {
    id: string;
    question_text: string;
    question_type: 'SBA' | 'SHORT';
    options?: string[];
    correct_answer: number | string | string[];
  };
}

// Type for creating exam questions - matches what you're passing from the form
export interface CreateExamQuestion {
  exam_pubkey: string;
  question_id: string;
  question_order: number;
}

export async function addExamQuestions(
  examQuestions: CreateExamQuestion[],
  supabase: SupabaseClient
) {
  const { data, error } = await supabase
    .from('exam_questions')
    .insert(examQuestions)
    .select();

  if (error) {
    throw new Error(`Failed to add exam questions: ${error.message}`);
  }

  return data;
}

export async function getExamQuestionsByExamPubkey(
  examPubkey: string,
  supabase: SupabaseClient
): Promise<ExamQuestionWithDetails[]> {
  const { data, error } = await supabase
    .from('exam_questions')
    .select('*, questions(*)') // You can join with the questions table if needed
    .eq('exam_pubkey', examPubkey)
    .order('question_order', { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch exam questions: ${error.message}`);
  }

  return data || [];
}