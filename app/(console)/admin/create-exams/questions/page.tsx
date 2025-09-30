"use client"
import React, { useState, useEffect } from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from "@/components/ui/card";
import { BookOpen, ArrowRight, ArrowLeft, Loader2 } from "lucide-react";
import { XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useRouter } from 'next/navigation';
import { useSupabaseClient } from '@supabase/auth-helpers-react';
import { useQuery } from '@tanstack/react-query';
import { getQuestions, Question } from '@/services/questionBankService';
import { withRoleProtection } from '@/components/withRoleProtection';


interface ExamBasicData {
  courseCode: string;
  examId: string;
  title: string;
  instructions: string;
  examDate: string;
  startTime: string;
  duration: number;
  metadataUri: string;
  endTime: string;
}

interface QuestionWithMarks extends Question {
  marks: number;
  selected: boolean;
}

const CreateExamQuestionsPage = () => {
  const router = useRouter();
  const supabaseClient = useSupabaseClient();
  const [basicData, setBasicData] = useState<ExamBasicData | null>(null);
  const [questions, setQuestions] = useState<QuestionWithMarks[]>([]);
  const [sbaMarks, setSbaMarks] = useState<number>(1);
  const [filterType, setFilterType] = useState<'ALL' | 'SBA' | 'SHORT'>('ALL');
  const [filterCourse, setFilterCourse] = useState<string>('ALL');

  
  const { data: allQuestions, isLoading, isError } = useQuery({
    queryKey: ['allQuestions'],
    queryFn: () => getQuestions(supabaseClient),
    enabled: !!supabaseClient,
  });

  
  useEffect(() => {
    const storedData = sessionStorage.getItem('examBasicData');
    if (!storedData) {
      router.push('/admin/create-exams/basic');
      return;
    }
    setBasicData(JSON.parse(storedData));
  }, [router]);

  
  useEffect(() => {
    if (allQuestions) {
      const questionsWithMarks = allQuestions.map(q => ({
        ...q,
        marks: q.question_type === 'SBA' ? sbaMarks : 1,
        selected: false,
      }));
      setQuestions(questionsWithMarks);
    }
  }, [allQuestions, sbaMarks]);

  
  const handleSbaMarksChange = (newMarks: number) => {
    setSbaMarks(newMarks);
    setQuestions(prev => prev.map(q => ({
      ...q,
      marks: q.question_type === 'SBA' ? newMarks : q.marks,
    })));
  };

  
  const handleQuestionToggle = (questionId: string, selected: boolean) => {
    setQuestions(prev => prev.map(q => 
      q.id === questionId ? { ...q, selected } : q
    ));
  };

  
  const handleQuestionMarksChange = (questionId: string, marks: number) => {
    setQuestions(prev => prev.map(q => 
      q.id === questionId ? { ...q, marks } : q
    ));
  };

  
  const uniqueCourses = Array.from(new Set(questions.map(q => q.course_code)));

  
  const filteredQuestions = questions.filter(q => {
    const typeMatch = filterType === 'ALL' || q.question_type === filterType;
    const courseMatch = filterCourse === 'ALL' || q.course_code === filterCourse;
    return typeMatch && courseMatch;
  });

  const selectedQuestions = questions.filter(q => q.selected);
  const totalMarks = selectedQuestions.reduce((sum, q) => sum + q.marks, 0);

  const handleNext = () => {
    if (selectedQuestions.length === 0) {
      alert('Please select at least one question');
      return;
    }

    
    const questionData = {
      selectedQuestions: selectedQuestions.map(q => ({
        id: q.id,
        marks: q.marks,
        question_type: q.question_type,
        question_text: q.question_text,
        options: q.options,
        correct_answer: q.correct_answer,
        course_code: q.course_code,
      })),
      totalMarks,
      sbaMarks,
    };
    
    sessionStorage.setItem('examQuestionData', JSON.stringify(questionData));
    router.push('/admin/create-exams/preview');
  };

  if (!basicData) {
    return (
      <div className="max-w-4xl mx-auto p-6 text-center">
        <Loader2 className="w-8 h-8 animate-spin mx-auto" />
        <p className="mt-4">Loading...</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto p-6 text-center">
        <Loader2 className="w-8 h-8 animate-spin mx-auto" />
        <p className="mt-4">Loading questions...</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="max-w-4xl mx-auto p-6 text-center text-red-500">
        <XCircle className="w-8 h-8 mx-auto" />
        <p className="mt-4">Error loading questions. Please try again.</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="w-6 h-6" />
            Create New Exam - Question Selection
          </CardTitle>
          <CardDescription>
            Select questions and assign marks for your exam
          </CardDescription>
        </CardHeader>

        <CardContent>
          <div className="space-y-6">
            {/* Progress indicator */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-blue-800 text-sm">
                <strong>Step 2 of 3:</strong> Basic Information ✓ → <strong>Question Selection</strong> → Preview & Publish
              </p>
            </div>

            {/* Exam Summary */}
            <div className=" p-4 border border-gray-200 rounded-lg">
              <h3 className="font-semibold mb-2">Exam Summary</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div><strong>Course:</strong> {basicData.courseCode}</div>
                <div><strong>Title:</strong> {basicData.title}</div>
                <div><strong>Duration:</strong> {basicData.duration} minutes</div>
                <div><strong>Date:</strong> {basicData.examDate}</div>
              </div>
            </div>

            {/* Marks Configuration */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Marks Configuration</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 border border-gray-200 rounded-lg">
                <div>
                  <Label className="block text-sm font-medium mb-2">SBA Questions Marks (each)</Label>
                  <Input
                    type="number"
                    value={sbaMarks}
                    onChange={(e) => handleSbaMarksChange(parseInt(e.target.value) || 1)}
                    min="1"
                    className="w-32"
                  />
                  <p className="text-xs text-gray-500 mt-1">All SBA questions will have the same marks</p>
                </div>
                <div className="flex items-center">
                  <div className="text-sm">
                    <p><strong>Selected Questions:</strong> {selectedQuestions.length}</p>
                    <p><strong>Total Marks:</strong> {totalMarks}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Filters */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Filter Questions</h3>
              <div className="flex gap-4">
                <div>
                  <Label className="block text-sm font-medium mb-2">Question Type</Label>
                  <select
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value as 'ALL' | 'SBA' | 'SHORT')}
                    className="px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="ALL">All Types</option>
                    <option value="SBA">SBA Only</option>
                    <option value="SHORT">Short Answer Only</option>
                  </select>
                </div>
                <div>
                  <Label className="block text-sm font-medium mb-2">Course</Label>
                  <select
                    value={filterCourse}
                    onChange={(e) => setFilterCourse(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="ALL">All Courses</option>
                    {uniqueCourses.map(course => (
                      <option key={course} value={course}>{course}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Question Selection */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Available Questions ({filteredQuestions.length})</h3>
              <div className="max-h-96 overflow-y-auto border border-gray-200 rounded-lg">
                {filteredQuestions.map((question) => (
                  <div key={question.id} className="p-4 border-b last:border-b-0 hover:bg-gray-500">
                    <div className="flex items-start gap-3">
                      <Checkbox
                        checked={question.selected}
                        onCheckedChange={(checked) => handleQuestionToggle(question.id, checked as boolean)}
                        className="mt-1"
                      />
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                            {question.question_type}
                          </span>
                          <span className="text-xs bg-gray-100 text-gray-800 px-2 py-1 rounded">
                            {question.course_code}
                          </span>
                        </div>
                        <p className="font-medium text-gray-50">{question.question_text}</p>
                        
                        {/* Show options for SBA questions */}
                        {question.question_type === 'SBA' && question.options && (
                          <div className="ml-4 space-y-1">
                            {question.options.map((option, index) => (
                              <div key={index} className={`text-sm p-2 rounded ${
                                index === Number(question.correct_answer) 
                                  ? 'bg-green-100 text-green-800 font-medium' 
                                  : 'bg-gray-100'
                              }`}>
                                {String.fromCharCode(65 + index)}. {option}
                                {index === Number(question.correct_answer) && (
                                  <span className="ml-2 text-xs">(Correct)</span>
                                )}
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Show correct answer for SHORT questions */}
                        {question.question_type === 'SHORT' && (
                          <div className="ml-4 text-sm bg-green-100 text-green-800 p-2 rounded">
                            <strong>Correct Answer(s):</strong> {
                              Array.isArray(question.correct_answer) 
                                ? question.correct_answer.join(', ')
                                : String(question.correct_answer)
                            }
                          </div>
                        )}

                        {/* Marks input */}
                        {question.selected && (
                          <div className="ml-4 flex items-center gap-2">
                            <Label className="text-sm">Marks:</Label>
                            {question.question_type === 'SBA' ? (
                              <span className="text-sm bg-blue-100 px-2 py-1 rounded">
                                {sbaMarks} (set globally above)
                              </span>
                            ) : (
                              <Input
                                type="number"
                                value={question.marks}
                                onChange={(e) => handleQuestionMarksChange(question.id, parseInt(e.target.value) || 1)}
                                min="1"
                                className="w-20"
                              />
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Navigation */}
            <div className="flex justify-between space-x-4 pt-6 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push('/admin/create-exams/basic')}
                className="flex items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Back: Basic Information
              </Button>
              <Button
                type="button"
                onClick={handleNext}
                disabled={selectedQuestions.length === 0}
                className="flex items-center gap-2"
              >
                Next: Preview & Publish
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default withRoleProtection(CreateExamQuestionsPage, ['lecturer', 'admin']);