'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
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
import { Loader2, Plus, Trash2, CheckCircle } from 'lucide-react';
import { addQuestion, CreateQuestionData } from '@/services/questionBankService';
import { useSupabaseClient, useUser } from '@supabase/auth-helpers-react';
import Link from 'next/link';
import { useWallet } from '@solana/wallet-adapter-react'; 
import useExaminatorProgram from '@/hooks/useExaminator'; 


// Form validation schema
const createQuestionSchema = z.object({
  question_text: z.string().min(10, 'Question must be at least 10 characters long'),
  course_code: z.string().min(2, 'Course code must be at least 2 characters'),
  question_type: z.enum(['SBA', 'SHORT'], {
    required_error: 'Please select a question type',
  }),
  options: z.array(z.string().min(1, 'Option cannot be empty')).optional(),
  correct_answer: z.union([z.string(), z.number()]),
}).refine((data) => {

  if (data.question_type === 'SBA') {
    return data.options && data.options.length >= 4;
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

type CreateQuestionFormData = z.infer<typeof createQuestionSchema>;

export default function CreateQuestionPage() {
  const supabaseClient = useSupabaseClient();
  const user = useUser();
  const { publicKey } = useWallet();
  const { createQuestionMetadata, getLecturerProfilePda } = useExaminatorProgram(); 
  const [options, setOptions] = useState<string[]>(['', '','','']);
  const [successMessage, setSuccessMessage] = useState<string>('');
  
  const queryClient = useQueryClient();

  const form = useForm<CreateQuestionFormData>({
    resolver: zodResolver(createQuestionSchema),
    defaultValues: {
      question_text: '',
      course_code: '',
      question_type: undefined,
      options: ['', ''],
      correct_answer: '',
    },
  });

  const { register, handleSubmit, watch, setValue, reset, formState: { errors } } = form;
  const questionType = watch('question_type');

  React.useEffect(() => {
    if (user) {
      console.log("User is logged in:", user.id);
    } else {
      console.log("No user logged in.");
    }
  }, [user]);

  // Mutation for creating questions
  const createQuestionMutation = useMutation({
    mutationFn: async (data: CreateQuestionFormData) => {
      if (!user?.id || !publicKey) {
        throw new Error('User must be authenticated and wallet connected to create questions');
      }

      const questionData: CreateQuestionData = {
        question_text: data.question_text,
        course_code: data.course_code.toUpperCase(),
        question_type: data.question_type,
        options: data.question_type === 'SBA' ? data.options?.filter(opt => opt.trim() !== '') : undefined,
        correct_answer: data.question_type === 'SBA' 
          ? (typeof data.correct_answer === 'number' ? data.correct_answer : parseInt(data.correct_answer as string, 10))
          : data.question_type === 'SHORT'
          ? (data.correct_answer as string).split(',').map(s => s.trim()).filter(s => s.length > 0)
          : data.correct_answer as string,
        user_id: user.id, 
      };

      // 1. Add question to Supabase
      const questionResult = await addQuestion(questionData, supabaseClient);

      // 2. Create Question Metadata on Solana
      const lecturerProfilePubkey = getLecturerProfilePda(publicKey, user.id);
      const questionContentForHash = {
        questionText: questionResult.question_text,
        questionType: questionResult.question_type,
        options: questionResult.options,
        correctAnswer: questionResult.correct_answer,
      };

      await createQuestionMetadata.mutateAsync({
        lecturerProfilePubkey: lecturerProfilePubkey.toBase58(),
        supabaseQuestionId: questionResult.id,
        content: questionContentForHash, 
        courseCode: questionResult.course_code,
      });

      return questionResult;

    },
    onSuccess: (data) => {
     
      queryClient.invalidateQueries({ queryKey: ['questions'] });
      queryClient.invalidateQueries({ queryKey: ['questions', data.course_code] });
      
      setSuccessMessage(`Question created successfully! ID: ${data.id}`);
      
   
      reset();
      setOptions(['', '']);
      
    
      setTimeout(() => setSuccessMessage(''), 5000);
    },
    onError: (error) => {
      console.error('Error creating question:', error);
    },
  });

  
  const updateOption = (index: number, value: string) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
    setValue('options', newOptions);
  };

  const addOption = () => {
    const newOptions = [...options, ''];
    setOptions(newOptions);
    setValue('options', newOptions);
  };

  const removeOption = (index: number) => {
    if (options.length > 2) {
      const newOptions = options.filter((_, i) => i !== index);
      setOptions(newOptions);
      setValue('options', newOptions);
    }
  };


  const handleQuestionTypeChange = (value: 'SBA' | 'SHORT') => {
    setValue('question_type', value);
    setValue('correct_answer', '');
    
    if (value === 'SBA') {
      setValue('options', options);
    } else {
      setValue('options', undefined);
    }
  };

  const onSubmit = (data: CreateQuestionFormData) => {
    createQuestionMutation.mutate(data);
  };

  if (!user) {
    return (
      <div className="container mx-auto p-6 max-w-4xl">
        <Alert className="border-yellow-200 bg-yellow-50">
          <AlertDescription className="text-yellow-800">
            You must be logged in to create questions. Please authenticate first.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Create New Question</h1>
          <p className="text-gray-600 mt-2">Add questions to the question bank for use in exams</p>
        </div>
        <Link href="/admin/submit-questions/bulk">
          <Button variant="outline" className="flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Bulk Create Questions
          </Button>
        </Link>
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
          <CardTitle>Question Details</CardTitle>
          <CardDescription>
            Fill in all the required information to create a new question
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">

            {/* Course Code */}
            <div className="space-y-2">
              <Label htmlFor="course_code">Course *</Label>
              <Input
                id="course_code"
                {...register('course_code')}
                placeholder="e.g., MED, SURG"
                className="uppercase"
                onChange={(e) => setValue('course_code', e.target.value.toUpperCase())}
              />
              {errors.course_code && (
                <p className="text-sm text-red-600">{errors.course_code.message}</p>
              )}
            </div>

            {/* Question Type */}
            <div className="space-y-2">
              <Label>Question Type *</Label>
              <Select onValueChange={handleQuestionTypeChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select question type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SBA">Single Best Answer (SBA)</SelectItem>
                  <SelectItem value="SHORT">Short Answer</SelectItem>
                </SelectContent>
              </Select>
              {errors.question_type && (
                <p className="text-sm text-red-600">{errors.question_type.message}</p>
              )}
            </div>
            
            {/* Question Text */}
            <div className="space-y-2">
              <Label htmlFor="question_text">Question Text *</Label>
              <Textarea
                id="question_text"
                {...register('question_text')}
                placeholder="Enter the question text..."
                className="min-h-[120px]"
              />
              {errors.question_text && (
                <p className="text-sm text-red-600">{errors.question_text.message}</p>
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
                    onClick={addOption}
                    className="flex items-center gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    Add Option
                  </Button>
                </div>
                
                <div className="space-y-3">
                  {options.map((option, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <Label className="min-w-[60px] text-sm">
                        Option {String.fromCharCode(65 + index)}:
                      </Label>
                      <Input
                        value={option}
                        onChange={(e) => updateOption(index, e.target.value)}
                        placeholder={`Enter option ${String.fromCharCode(65 + index)}...`}
                        className="flex-1"
                      />
                      {options.length > 4 && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => removeOption(index)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
                
                {errors.options && (
                  <p className="text-sm text-red-600">{errors.options.message}</p>
                )}
              </div>
            )}

            {/* Correct Answer */}
            <div className="space-y-2">
              <Label htmlFor="correct_answer">
                Correct Answer * 
                {questionType === 'SBA' && <span className="text-sm text-gray-500 ml-2">(Option number: 0, 1, 2, etc.)</span>}
                {questionType === 'SHORT' && <span className="text-sm text-gray-500 ml-2">(Separate multiple answers with commas)</span>}
              </Label>
              
              {questionType === 'SBA' ? (
                <Select onValueChange={(value) => setValue('correct_answer', parseInt(value, 10))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select the correct option" />
                  </SelectTrigger>
                  <SelectContent>
                    {options.map((option, index) => (
                      <SelectItem key={index} value={index.toString()} disabled={!option.trim()}>
                        {String.fromCharCode(65 + index)}: {option.trim() || 'Empty option'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : questionType === 'SHORT' ? (
                <Textarea
                  id="correct_answer"
                  {...register('correct_answer')}
                  placeholder="Enter correct answers, separated by commas (e.g., Tonometer, Perkins tonometer, Goldmann tonometer)"
                  className="min-h-[80px]"
                />
              ) : (
                <Textarea
                  id="correct_answer"
                  {...register('correct_answer')}
                  placeholder="Enter the correct answer..."
                  className="min-h-[80px]"
                />
              )}
              
              {errors.correct_answer && (
                <p className="text-sm text-red-600">{errors.correct_answer.message}</p>
              )}
            </div>

            {/* Submit Button */}
            <div className="flex justify-end gap-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  reset();
                  setOptions(['', '']);
                  setSuccessMessage('');
                }}
                disabled={createQuestionMutation.isPending}
              >
                Reset Form
              </Button>
              
              <Button
                type="submit"
                disabled={createQuestionMutation.isPending}
                className="flex items-center gap-2"
              >
                {createQuestionMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create Question'
                )}
              </Button>
            </div>

            {createQuestionMutation.error && (
              <Alert className="border-red-200 bg-red-50">
                <AlertDescription className="text-red-800">
                  Error creating question: {createQuestionMutation.error.message}
                </AlertDescription>
              </Alert>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}