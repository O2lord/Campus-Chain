"use client"
import React, { useState, useEffect } from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from "@/components/ui/card";
import { Eye, ArrowLeft, CheckCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useRouter } from 'next/navigation';
import { useSupabaseClient, useUser } from '@supabase/auth-helpers-react';
import { useMutation } from '@tanstack/react-query';
import { createExam, CreateExamData } from '@/services/examService';
import { addExamQuestions } from '@/services/examQuestionService';
import { getLecturerDetailsById } from '@/services/lecturerService'; 
import { toast } from 'sonner';
import { withRoleProtection } from '@/components/withRoleProtection';
import { format } from 'date-fns'; 
import { useWallet } from '@solana/wallet-adapter-react'; 
import useExaminatorProgram from '@/hooks/useExaminator'; 



// Define proper interfaces for type safety
interface BasicExamPreviewData {
  courseCode: string;
  examId: string;
  title: string;
  instructions: string;
  set: string;
  examDate: string; 
  startTime: string; 
  duration: number;
  metadataUri: string;
  endTime: string; 
}

interface SelectedQuestion {
  id: string;
  marks: number;
  question_type: 'SBA' | 'SHORT';
  question_text: string;
  options?: string[];
  correct_answer: number | string | string[];
  course_code: string;
}

interface QuestionPreviewData {
  selectedQuestions: SelectedQuestion[];
  totalMarks: number;
  sbaMarks: number;
}

interface ExamPreviewData {
  basicData: BasicExamPreviewData;
  questionData: QuestionPreviewData;
}


const SET_DISPLAY_MAP: Record<string, string> = {
  'set_a': 'Set A',
  'set_b': 'Set B',
  'set_c': 'Set C',
  'set_d': 'Set D',
  'set_e': 'Set E',
  'all_sets': 'All Sets',
};

const CreateExamPreviewPage = () => {
  const router = useRouter();
  const supabaseClient = useSupabaseClient();
  const user = useUser();
  const { publicKey } = useWallet(); 
  const { createExamMetadata, getLecturerProfilePda } = useExaminatorProgram(); 
  const [previewData, setPreviewData] = useState<ExamPreviewData | null>(null);
  const [showScoresImmediately, setShowScoresImmediately] = useState(false);
  const [showCorrectAnswers, setShowCorrectAnswers] = useState(false);

  
  useEffect(() => {
    const basicData = sessionStorage.getItem('examBasicData');
    const questionData = sessionStorage.getItem('examQuestionData');
    
    if (!basicData || !questionData) {
      router.push('/admin/create-exams/basic');
      return;
    }
    
    setPreviewData({
      basicData: JSON.parse(basicData),
      questionData: JSON.parse(questionData),
    });
  }, [router]);

  
  const validateLecturerProfile = async (): Promise<boolean> => {
    if (!user?.id) {
      toast.error("User authentication required");
      return false;
    }

    try {
      const lecturerResult = await getLecturerDetailsById(user.id, supabaseClient);
      
      if (lecturerResult.error || !lecturerResult.data) {
        toast.error("Lecturer profile not found. Please ensure your lecturer profile is properly set up before creating exams.");
        return false;
      }

      if (!lecturerResult.data.wallet) {
        toast.error("Incomplete lecturer profile. Please link your Solana wallet to your lecturer profile before creating exams.");
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error validating lecturer profile:', error);
      toast.error("Failed to validate lecturer profile. Please try again.");
      return false;
    }
  };

  // Create exam mutation
  const createExamMutation = useMutation({
    mutationFn: async () => {
      if (!previewData) throw new Error('No preview data available');
      if (!user?.id || !publicKey) throw new Error('User not authenticated or wallet not connected'); 

      
      const isProfileValid = await validateLecturerProfile();
      if (!isProfileValid) {
        throw new Error('Lecturer profile validation failed');
      }

      const { basicData, questionData } = previewData;

      
      const sbaCount = questionData.selectedQuestions.filter((q: SelectedQuestion) => q.question_type === 'SBA').length;
      const shortCount = questionData.selectedQuestions.filter((q: SelectedQuestion) => q.question_type === 'SHORT').length;

      const examParams: CreateExamData = {
        authority_id: user.id,
        course_title: basicData.title,
        course_code: basicData.courseCode,
        instructions: basicData.instructions,
        set: basicData.set,
        exam_date: basicData.examDate,
        start_ts: new Date(`${basicData.examDate}T${basicData.startTime}`).toISOString(),
        end_ts: basicData.endTime,
        duration_secs: basicData.duration * 60,
        question_config: {
          total_questions: questionData.selectedQuestions.length,
          mcq_count: sbaCount,
          short_answer_count: shortCount,
          essay_count: 0,
          max_marks: questionData.totalMarks
        },
        published: false,
        show_scores_immediately: showScoresImmediately,
        show_correct_answers: showCorrectAnswers,
        results_published: false
      };

      // Create exam
      const examResult = await createExam(examParams, supabaseClient);

      // Add exam questions
      const examQuestionsToInsert = questionData.selectedQuestions.map((question: SelectedQuestion, index: number) => ({
        exam_pubkey: examResult.id,
        question_id: question.id,
        question_order: index,
      }));

      await addExamQuestions(examQuestionsToInsert, supabaseClient);

       // Create Exam Metadata on Solana
      const lecturerProfilePubkey = getLecturerProfilePda(publicKey, user.id);

      const examConfigForHash = {
        courseCode: basicData.courseCode,
        courseTitle: basicData.title,
        instructions: basicData.instructions,
        examDate: basicData.examDate,
        duration: basicData.duration,
        totalQuestions: questionData.selectedQuestions.length,
        sbaCount: sbaCount,
        shortCount: shortCount,
        maxMarks: questionData.totalMarks,
        showScoresImmediately: showScoresImmediately,
        showCorrectAnswers: showCorrectAnswers,
      };

      await createExamMetadata.mutateAsync({
        lecturerProfilePubkey: lecturerProfilePubkey.toBase58(),
        supabaseExamId: examResult.id,
        config: examConfigForHash, 
        startTime: new Date(examParams.start_ts),
        endTime: new Date(examParams.end_ts),
        published: examParams.published,
      });

      return examResult;
    },
    onSuccess: () => {
      
      sessionStorage.removeItem('examBasicData');
      sessionStorage.removeItem('examQuestionData');
      
      toast.success("Exam created successfully!");
      router.push('/admin/manage-exams');
    },
    onError: (error) => {
      console.error('Error creating exam:', error);
      
      
      if (error.message === 'Lecturer profile validation failed') {
  
        return;
      }
      
      toast.error("Failed to create exam. Please try again.");
    },
  });

  if (!previewData) {
    return (
      <div className="max-w-4xl mx-auto p-6 text-center">
        <Loader2 className="w-8 h-8 animate-spin mx-auto" />
        <p className="mt-4">Loading preview...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-4xl mx-auto p-6 text-center">
        <Loader2 className="w-8 h-8 animate-spin mx-auto" />
        <p className="mt-4">Authenticating user...</p>
      </div>
    );
  }

  const { basicData, questionData } = previewData;

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="w-6 h-6" />
            Create New Exam - Preview & Settings
          </CardTitle>
          <CardDescription>
            Review your exam and configure result display settings
          </CardDescription>
        </CardHeader>

        <CardContent>
          <div className="space-y-6">
            {/* Progress indicator */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-blue-800 text-sm">
                <strong>Step 3 of 3:</strong> Basic Information ✓ → Question Selection ✓ → <strong>Preview & Publish</strong>
              </p>
            </div>

            {/* Exam Overview */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Exam Overview</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 border text-gray-50 border-gray-200 rounded-lg ">
                <div className="space-y-2">
                  <p><strong>Course Code:</strong> {basicData.courseCode}</p>
                  <p><strong>Exam ID:</strong> {basicData.examId}</p>
                  <p><strong>Title:</strong> {basicData.title}</p>
                  <p><strong>Instructions:</strong> {basicData.instructions}</p>
                  <p><strong>Student Set:</strong> {SET_DISPLAY_MAP[basicData.set] || basicData.set}</p>
                  <p><strong>Duration:</strong> {basicData.duration} minutes</p>
                </div>
                <div className="space-y-2">
                  <p><strong>Date:</strong> {basicData.examDate}</p>
                  {/* Corrected Start Time display */}
                  <p>
                    <strong>Start Time:</strong>{' '}
                    {format(new Date(`${basicData.examDate}T${basicData.startTime}`), 'PPP p')}
                  </p>
                  {/* Corrected End Time display */}
                  <p>
                    <strong>End Time:</strong>{' '}
                    {format(new Date(basicData.endTime), 'PPP p')}
                  </p>
                  <p><strong>Total Questions:</strong> {questionData.selectedQuestions.length}</p>
                  <p><strong>Total Marks:</strong> {questionData.totalMarks}</p>
                </div>
              </div>
            </div>

            {/* Question Breakdown */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Question Breakdown</h3>
              <div className="space-y-3 p-4 border border-gray-200 rounded-lg">
                {questionData.selectedQuestions.map((question: SelectedQuestion, index: number) => (                   
                  <div key={index} className="mb-6 p-4 border rounded-lg">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">Q{index + 1}</span>
                        <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm">
                          {question.question_type}
                        </span>
                        <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded text-sm">
                          {question.course_code}
                        </span>
                      </div>
                      <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-sm font-medium">
                        {question.marks} marks
                      </span>
                    </div>
                    
                    <div className="mb-3 text-lg">
                      {question.question_text}
                    </div>
                    
                    {/* Answer Section */}
                    <div className="mt-3 p-3 bg-green-50 border-l-4 border-green-500 rounded">
                      <span className="font-semibold text-green-800">Correct Answer(s): </span>
                      <span className="text-green-900">
                        {question.question_type === 'SBA' && question.options
                          ? question.options[Number(question.correct_answer)]
                          : Array.isArray(question.correct_answer)
                            ? question.correct_answer.join(', ')
                            : String(question.correct_answer)}
                      </span>
                    </div>
                    
                    {/* Display options for SBA */}
                    {question.question_type === 'SBA' && question.options && (
                      <div className="mt-3 space-y-2">
                        {question.options.map((option: string, optIndex: number) => (
                          <div 
                            key={optIndex} 
                            className={`flex items-center gap-2 p-2 rounded ${
                              optIndex === Number(question.correct_answer) 
                                ? 'bg-green-100 border border-green-300' 
                                : 'bg-gray-50'
                            }`}
                          >
                            <span className="font-medium">{String.fromCharCode(65 + optIndex)}.</span>
                            <span>{option}</span>
                            {optIndex === Number(question.correct_answer) && (
                              <span className="ml-auto text-green-600 font-semibold text-sm">✓ Correct</span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Result Display Settings */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Result Display Settings</h3>
              <div className="space-y-4 p-4 border border-gray-200 rounded-lg bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label htmlFor="show-scores" className="text-gray-900">Show Scores to Students Immediately</Label>
                    <p className="text-sm text-gray-600">
                      Students will see their scores immediately after submission
                    </p>
                  </div>
                  <Switch
                    id="show-scores"
                    checked={showScoresImmediately}
                    onCheckedChange={setShowScoresImmediately}
                    style={{
                    backgroundColor: showScoresImmediately ? '#26a92dff' : '#d1d5db'
                  }}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label htmlFor="show-answers" className="text-gray-900">Show Correct Answers to Students</Label>
                    <p className="text-sm text-gray-600">
                      Students can view questions and correct answers after submission
                    </p>
                  </div>
                  <Switch
                    id="show-answers"
                    checked={showCorrectAnswers}
                    onCheckedChange={setShowCorrectAnswers}
                    style={{
                    backgroundColor: showCorrectAnswers ? '#26a92dff' : '#d1d5db'
                  }}
                  />
                </div>
              </div>
            </div>

            {/* Navigation */}
            <div className="flex justify-between space-x-4 pt-6 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push('/admin/create-exams/questions')}
                className="flex items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Back: Question Selection
              </Button>
              <Button
                type="button"
                onClick={() => createExamMutation.mutate()}
                disabled={createExamMutation.isPending}
                className="flex items-center gap-2"
              >
                {createExamMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Creating Exam...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    Create Exam
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default withRoleProtection(CreateExamPreviewPage, ['lecturer', 'admin']);