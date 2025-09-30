'use client';

import React, { useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Plus, Trash2, Minus, CheckCircle, ArrowLeft } from 'lucide-react';
import { addQuestion, CreateQuestionData } from '@/services/questionBankService';
import { useSupabaseClient, useUser } from '@supabase/auth-helpers-react';
import Link from 'next/link';
import { useWallet } from '@solana/wallet-adapter-react';
import useExaminatorProgram from '@/hooks/useExaminator';
import { v4 as uuidv4 } from 'uuid';


// Single question schema (without course_code)
const questionSchema = z.object({
  question_text: z.string().min(10, 'Question must be at least 10 characters long'),
  question_type: z.enum(['SBA', 'SHORT'], {
    required_error: 'Please select a question type',
  }),
  options: z.array(z.string().min(1, 'Option cannot be empty')).optional(),
  correct_answer: z.union([z.string(), z.number()]),
}).refine((data) => {
  if (data.question_type === 'SBA') {
    return data.options && data.options.length >= 2;
  }
  return true;
}, {
  message: 'SBA questions must have at least 2 options',
  path: ['options'],
}).refine((data) => {
  if (data.question_type === 'SBA') {
    const answerIndex = typeof data.correct_answer === 'number' 
      ? data.correct_answer 
      : parseInt(data.correct_answer as string, 10);
    return !isNaN(answerIndex) && answerIndex >= 0 && data.options && answerIndex < data.options.length;
  }
  return typeof data.correct_answer === 'string' && data.correct_answer.trim().length > 0;
}, {
  message: 'Invalid correct answer format',
  path: ['correct_answer'],
});

// Bulk form schema with global course code
const bulkQuestionSchema = z.object({
  course_code: z.string().min(2, 'Course code must be at least 2 characters'),
  questions: z.array(questionSchema).min(1, 'At least one question is required'),
  numQuestions: z.number().min(1, 'Must specify at least 1 question').max(50, 'Maximum 50 questions at once'),
});

type BulkQuestionFormData = z.infer<typeof bulkQuestionSchema>;
type QuestionWithoutCourseCode = z.infer<typeof questionSchema>;

export default function BulkCreateQuestionPage() {
  const supabaseClient = useSupabaseClient();
  const user = useUser();
  const { publicKey } = useWallet(); 
  const {  getLecturerProfilePda, createQuestionBatch } = useExaminatorProgram(); 
  const [successMessage, setSuccessMessage] = useState<string>('');
  const [numQuestions, setNumQuestions] = useState<number>(5);
  
  const queryClient = useQueryClient();

  const form = useForm<BulkQuestionFormData>({
    resolver: zodResolver(bulkQuestionSchema),
    defaultValues: {
      course_code: '',
      questions: Array(5).fill(null).map(() => ({
        question_text: '',
        question_type: 'SBA' as const,
        options: ['', '', '', ''],
        correct_answer: '',
      })),
      numQuestions: 5,
    },
  });

  const { register, handleSubmit, watch, setValue, reset, control, formState: { errors } } = form;
  const { fields, append, remove } = useFieldArray({
    control,
    name: 'questions',
  });

  const handleNumQuestionsChange = (newNum: number) => {
    setNumQuestions(newNum);
    const currentQuestions = form.getValues('questions');
    
    if (newNum > currentQuestions.length) {
      const questionsToAdd = Array(newNum - currentQuestions.length).fill(null).map(() => ({
        question_text: '',
        question_type: 'SBA' as const,
        options: ['', '', '', ''],
        correct_answer: '',
      }));
      questionsToAdd.forEach(() => append({
        question_text: '',
        question_type: 'SBA' as const,
        options: ['', '', '', ''],
        correct_answer: '',
      }));
    } else if (newNum < currentQuestions.length) {
      for (let i = currentQuestions.length - 1; i >= newNum; i--) {
        remove(i);
      }
    }
    setValue('numQuestions', newNum);
  };

  // Mutation for creating questions
  const createQuestionsMutation = useMutation({
  mutationFn: async (data: { course_code: string; questions: QuestionWithoutCourseCode[] }) => {
    console.log("MutationFn started with batch creation.");

    if (!user?.id || !publicKey) {
      console.error("MutationFn: User not authenticated or wallet not connected.");
      throw new Error('User must be authenticated and wallet connected to create questions');
    }

    const lecturerProfilePubkey = getLecturerProfilePda(publicKey, user.id);
    console.log("MutationFn: Lecturer Profile PDA obtained:", lecturerProfilePubkey.toBase58());

    // Step 1: Add all questions to Supabase first
    console.log("MutationFn: Adding all questions to Supabase...");
    const supabaseResults = [];
    
    for (const questionData of data.questions) {
      console.log("MutationFn: Processing question:", questionData.question_text);
      
      const processedData: CreateQuestionData = {
        question_text: questionData.question_text,
        course_code: data.course_code.toUpperCase(),
        question_type: questionData.question_type,
        options: questionData.question_type === 'SBA' ? questionData.options?.filter(opt => opt.trim() !== '') : undefined,
        correct_answer: questionData.question_type === 'SBA'
          ? (typeof questionData.correct_answer === 'number' ? questionData.correct_answer : parseInt(questionData.correct_answer as string, 10))
          : questionData.question_type === 'SHORT'
          ? (questionData.correct_answer as string).split(',').map(s => s.trim()).filter(s => s.length > 0)
          : questionData.correct_answer as string,
        user_id: user.id,
      };

      try {
        const questionResult = await addQuestion(processedData, supabaseClient);
        console.log("MutationFn: Question added to Supabase:", questionResult.id);
        supabaseResults.push(questionResult);
      } catch (error) {
        console.error("MutationFn: Error adding question to Supabase:", error);
        throw error;
      }
    }

    // Step 2: Create batch on Solana with all questions
    console.log("MutationFn: Creating question batch on Solana...");
    
    const questionsForBatch = supabaseResults.map(questionResult => ({
      supabaseQuestionId: questionResult.id,
      content: {
        questionText: questionResult.question_text,
        questionType: questionResult.question_type as 'SBA' | 'SHORT',
        options: questionResult.options,
        correctAnswer: questionResult.correct_answer,
      },
      courseCode: questionResult.course_code,
    }));

    try {
      // Generate a unique batch ID
      const batchId = `batch_${Date.now()}_${uuidv4().slice(0, 8)}`;
      
      await createQuestionBatch.mutateAsync({
        lecturerProfilePubkey: lecturerProfilePubkey.toBase58(),
        batchId: batchId,
        questions: questionsForBatch,
      });
      
      console.log("MutationFn: Question batch created on Solana successfully.");
    } catch (error) {
      console.error("MutationFn: Error creating question batch on Solana:", error);
      throw new Error(`Questions saved to database but failed to create blockchain batch: ${error}`);
    }

    console.log("MutationFn: All questions processed via batch creation.");
    return supabaseResults;
  },
  onSuccess: (data) => {
    queryClient.invalidateQueries({ queryKey: ['questions'] });
    queryClient.invalidateQueries({ queryKey: ['allQuestions'] });
    queryClient.invalidateQueries({ queryKey: ['get-question-batches'] }); 
    setSuccessMessage(`${data.length} questions created successfully using batch creation!`);
    
    // Reset form
    reset();
    handleNumQuestionsChange(5);
    
    setTimeout(() => setSuccessMessage(''), 5000);
  },
  onError: (error) => {
    console.error('Error creating questions:', error);
  },
});

  // Handle option changes for SBA questions
  const updateOption = (questionIndex: number, optionIndex: number, value: string) => {
    const currentOptions = form.getValues(`questions.${questionIndex}.options`) || [];
    const newOptions = [...currentOptions];
    newOptions[optionIndex] = value;
    setValue(`questions.${questionIndex}.options`, newOptions);
  };

  const addOption = (questionIndex: number) => {
    const currentOptions = form.getValues(`questions.${questionIndex}.options`) || [];
    setValue(`questions.${questionIndex}.options`, [...currentOptions, '']);
  };

  const removeOption = (questionIndex: number, optionIndex: number) => {
    const currentOptions = form.getValues(`questions.${questionIndex}.options`) || [];
    if (currentOptions.length > 2) {
      const newOptions = currentOptions.filter((_, i) => i !== optionIndex);
      setValue(`questions.${questionIndex}.options`, newOptions);
    }
  };

  const onSubmit = (data: BulkQuestionFormData) => {
    if (!user?.id || !publicKey) {
      console.error("Cannot create questions: User not authenticated or wallet not connected.");
      return; 
    }

    createQuestionsMutation.mutate({
      course_code: data.course_code,
      questions: data.questions,
    });
  };

  if (!user) {
    return (
      <div className="container mx-auto p-6 max-w-6xl">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
          <span className="ml-2">Loading...</span>
        </div>
      </div>
    );
  }
  
  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="mb-6 flex items-center gap-4">
        <Link href="/admin/submit-questions">
          <Button variant="outline" size="sm">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Single Question
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Bulk Create Questions</h1>
          <p className="text-gray-600 mt-2">Add multiple questions to the question bank at once</p>
        </div>
      </div>

      {successMessage && (
        <Alert className="mb-6 border-green-200 bg-green-50">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">
            {successMessage}
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Bulk Question Creation</CardTitle>
          <CardDescription>
            Create multiple questions efficiently in one submission
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Course Code and Number of Questions */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 rounded-lg border border-blue-200">
              <div className="space-y-2">
                <Label htmlFor="course_code" className="text-lg font-semibold">Course Code *</Label>
                <Input
                  {...register('course_code')}
                  id="course_code"
                  placeholder="e.g., MED, SURG, OPHTHAL"
                  className="uppercase text-lg font-medium"
                  onChange={(e) => setValue('course_code', e.target.value.toUpperCase())}
                />
                {errors.course_code && (
                  <p className="text-sm text-red-600">{errors.course_code.message}</p>
                )}
                <p className="text-sm text-gray-600">Applied to all questions in this batch</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="numQuestions" className="text-lg font-semibold">Number of Questions</Label>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => handleNumQuestionsChange(Math.max(1, numQuestions - 1))}
                    disabled={numQuestions <= 1}
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <Input
                    id="numQuestions"
                    type="number"
                    min="1"
                    max="50"
                    value={numQuestions}
                    onChange={(e) => handleNumQuestionsChange(parseInt(e.target.value) || 1)}
                    className="text-lg font-medium text-center"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => handleNumQuestionsChange(Math.min(50, numQuestions + 1))}
                    disabled={numQuestions >= 50}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-sm text-gray-600">Maximum 50 questions per batch</p>
              </div>
            </div>

            {/* Questions */}
            <div className="space-y-8">
              {fields.map((field, questionIndex) => {
                const questionType = watch(`questions.${questionIndex}.question_type`);
                const questionOptions = watch(`questions.${questionIndex}.options`) || [];
                
                return (
                  <Card key={field.id} className="border-l-4 border-l-blue-500">
                    <CardHeader>
                      <CardTitle className="text-lg">Question {questionIndex + 1}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Question Type */}
                      <div className="space-y-2">
                        <Label>Question Type *</Label>
                        <Select onValueChange={(value: 'SBA' | 'SHORT') => {
                          setValue(`questions.${questionIndex}.question_type`, value);
                          setValue(`questions.${questionIndex}.correct_answer`, '');
                          if (value === 'SBA') {
                            setValue(`questions.${questionIndex}.options`, ['', '', '', '']);
                          } else {
                            setValue(`questions.${questionIndex}.options`, undefined);
                          }
                        }}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select question type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="SBA">Single Best Answer (SBA)</SelectItem>
                            <SelectItem value="SHORT">Short Answer</SelectItem>
                          </SelectContent>
                        </Select>
                        {errors.questions?.[questionIndex]?.question_type && (
                          <p className="text-sm text-red-600">{errors.questions[questionIndex]?.question_type?.message}</p>
                        )}
                      </div>
                      
                      {/* Question Text */}
                      <div className="space-y-2">
                        <Label htmlFor={`questions.${questionIndex}.question_text`}>Question Text *</Label>
                        <Textarea
                          {...register(`questions.${questionIndex}.question_text`)}
                          placeholder="Enter the question text..."
                          className="min-h-[100px]"
                        />
                        {errors.questions?.[questionIndex]?.question_text && (
                          <p className="text-sm text-red-600">{errors.questions[questionIndex]?.question_text?.message}</p>
                        )}
                      </div>

                      {/* Options (for SBA questions only) */}
                      {questionType === 'SBA' && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label>Answer Options *</Label>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => addOption(questionIndex)}
                              className="flex items-center gap-2"
                            >
                              <Plus className="h-4 w-4" />
                              Add Option
                            </Button>
                          </div>
                          
                          <div className="space-y-3">
                            {questionOptions.map((option: string, optionIndex: number) => (
                              <div key={optionIndex} className="flex items-center gap-2">
                                <Label className="min-w-[60px] text-sm">
                                  Option {String.fromCharCode(65 + optionIndex)}:
                                </Label>
                                <Input
                                  value={option}
                                  onChange={(e) => updateOption(questionIndex, optionIndex, e.target.value)}
                                  placeholder={`Enter option ${String.fromCharCode(65 + optionIndex)}...`}
                                  className="flex-1"
                                />
                                {questionOptions.length > 2 && (
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => removeOption(questionIndex, optionIndex)}
                                    className="text-red-600 hover:text-red-700"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>
                            ))}
                          </div>
                          
                          {errors.questions?.[questionIndex]?.options && (
                            <p className="text-sm text-red-600">{errors.questions[questionIndex]?.options?.message}</p>
                          )}
                        </div>
                      )}

                      {/* Correct Answer */}
                      <div className="space-y-2">
                        <Label htmlFor={`questions.${questionIndex}.correct_answer`}>
                          Correct Answer * 
                          {questionType === 'SBA' && <span className="text-sm text-gray-500 ml-2">(Select correct option)</span>}
                          {questionType === 'SHORT' && <span className="text-sm text-gray-500 ml-2">(Separate multiple answers with commas)</span>}
                        </Label>
                        
                        {questionType === 'SBA' ? (
                          <Select onValueChange={(value) => setValue(`questions.${questionIndex}.correct_answer`, parseInt(value, 10))}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select the correct option" />
                            </SelectTrigger>
                            <SelectContent>
                              {questionOptions.map((option: string, optionIndex: number) => (
                                <SelectItem key={optionIndex} value={optionIndex.toString()} disabled={!option.trim()}>
                                  {String.fromCharCode(65 + optionIndex)}: {option.trim() || 'Empty option'}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : questionType === 'SHORT' ? (
                          <Textarea
                            {...register(`questions.${questionIndex}.correct_answer`)}
                            placeholder="Enter correct answers, separated by commas (e.g., Tonometer, Perkins tonometer, Goldmann tonometer)"
                            className="min-h-[80px]"
                          />
                        ) : (
                          <Textarea
                            {...register(`questions.${questionIndex}.correct_answer`)}
                            placeholder="Enter the correct answer..."
                            className="min-h-[80px]"
                          />
                        )}
                        
                        {errors.questions?.[questionIndex]?.correct_answer && (
                          <p className="text-sm text-red-600">{errors.questions[questionIndex]?.correct_answer?.message}</p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Submit Button */}
            <div className="flex justify-end gap-4 pt-6 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  reset();
                  handleNumQuestionsChange(5);
                  setSuccessMessage('');
                }}
                disabled={createQuestionsMutation.isPending}
              >
                Reset All
              </Button>
              
              <Button
                type="submit"
                disabled={createQuestionsMutation.isPending}
                className="flex items-center gap-2"
              >
                {createQuestionsMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Creating {fields.length} Questions...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4" />
                    Create {fields.length} Questions
                  </>
                )}
              </Button>
            </div>

            {createQuestionsMutation.error && (
              <Alert className="mb-6 border-red-200 bg-red-50">
                <AlertDescription className="text-red-800">
                  Error creating questions: {createQuestionsMutation.error.message}
                </AlertDescription>
              </Alert>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}