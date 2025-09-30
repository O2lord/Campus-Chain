"use client"
import React, { useState } from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from "@/components/ui/card";
import { Database, ArrowRight, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useRouter } from 'next/navigation';
import { withRoleProtection } from '@/components/withRoleProtection';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery } from '@tanstack/react-query';
import { getDistinctSets } from '@/services/studentIdentityService';
import { format } from 'date-fns';

// Define the FormData interface for basic exam details
interface BasicExamFormData {
  courseCode: string;
  examId: string;
  title: string;
  instructions: string;
  set: string;
  examDate: string; 
  startTime: string; 
  duration: number; 
  metadataUri: string;
}


interface FormErrors {
  courseCode?: string;
  examId?: string;
  title?: string;
  instructions?: string;
  set?: string;
  examDate?: string;
  startTime?: string;
  duration?: string;
  metadataUri?: string;
}

const CreateExamBasicPage = () => {
  const router = useRouter();

  
  const { data: distinctSets, isLoading: isLoadingSets, isError: isErrorSets } = useQuery({
    queryKey: ["distinctSets"],
    queryFn: getDistinctSets,
  });

  
  const [formData, setFormData] = useState<BasicExamFormData>({
    courseCode: '',
    examId: '',
    title: '',
    instructions: '',
    set: '',
    examDate: new Date().toISOString().split('T')[0], 
    startTime: new Date().toTimeString().slice(0, 5), 
    duration: 120, 
    metadataUri: '',
  });

  const [errors, setErrors] = useState<FormErrors>({});
  const [isLoading, setIsLoading] = useState(false);

  
  const calculateEndTime = (examDate: string, timeOnly: string, durationMinutes: number): string => {
    
    const start = new Date(`${examDate}T${timeOnly}`);
    const end = new Date(start.getTime() + durationMinutes * 60 * 1000);
    
    return end.toISOString();
  };

  
  const handleChange = <K extends keyof BasicExamFormData>(
    field: K,
    value: BasicExamFormData[K]
  ): void => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));

    
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: undefined
      }));
    }
  };

  
  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.courseCode.trim()) newErrors.courseCode = 'Course code is required';
    if (!formData.examId.trim()) newErrors.examId = 'Exam ID is required';
    if (!formData.title.trim()) newErrors.title = 'Title is required';
    if (!formData.instructions.trim()) newErrors.instructions = 'Instructions are required';
    if (!formData.set.trim()) newErrors.set = 'Student set is required';
    if (!formData.examDate) newErrors.examDate = 'Exam date is required';
    if (!formData.startTime) newErrors.startTime = 'Start time is required';
    if (formData.duration < 1) newErrors.duration = 'Duration must be at least 1 minute';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = async () => {
    if (!validateForm()) {
      return;
    }

    setIsLoading(true);

    try {
      
      const fullEndTimeISO = calculateEndTime(formData.examDate, formData.startTime, formData.duration);

      
      const examData = {
        ...formData,
        
        endTime: fullEndTimeISO,
      };

      sessionStorage.setItem('examBasicData', JSON.stringify(examData));
      router.push('/admin/create-exams/questions');
    } catch (error) {
      console.error('Error saving exam data:', error);
      
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="w-6 h-6" />
            Create New Exam - Basic Information
          </CardTitle>
          <CardDescription>
            Set up the basic details for your exam
          </CardDescription>
        </CardHeader>

        <CardContent>
          <div className="space-y-6">
            {/* Development Mode Notice */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-blue-800 text-sm">
                <strong>Step 1 of 3:</strong> Basic Information → Question Selection → Preview & Publish
              </p>
            </div>

            {/* Basic Information */}
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="block text-sm font-medium mb-2">Course Code *</Label>
                  <Input
                    type="text"
                    value={formData.courseCode}
                    onChange={(e) => handleChange('courseCode', e.target.value)}
                    className={`w-full ${errors.courseCode ? 'border-red-500' : ''}`}
                    placeholder="e.g., Ophthalmology"
                  />
                  {errors.courseCode && <p className="text-red-500 text-sm mt-1">{errors.courseCode}</p>}
                </div>

                <div>
                  <Label className="block text-sm font-medium mb-2">Exam ID *</Label>
                  <Input
                    type="text"
                    value={formData.examId}
                    onChange={(e) => handleChange('examId', e.target.value)}
                    className={`w-full ${errors.examId ? 'border-red-500' : ''}`}
                    placeholder="e.g., End of Posting"
                  />
                  {errors.examId && <p className="text-red-500 text-sm mt-1">{errors.examId}</p>}
                </div>
              </div>

              <div>
                <Label className="block text-sm font-medium mb-2">Exam Title *</Label>
                <Input
                  type="text"
                  value={formData.title}
                  onChange={(e) => handleChange('title', e.target.value)}
                  className={`w-full ${errors.title ? 'border-red-500' : ''}`}
                  placeholder="e.g., Ophthalmology End of Posting Exam"
                />
                {errors.title && <p className="text-red-500 text-sm mt-1">{errors.title}</p>}
              </div>

              <div>
                <Label className="block text-sm font-medium mb-2">Instructions *</Label>
                <Textarea
                  value={formData.instructions}
                  onChange={(e) => handleChange('instructions', e.target.value)}
                  rows={4}
                  className={`w-full ${errors.instructions ? 'border-red-500' : ''}`}
                  placeholder="Enter detailed instructions for students taking this exam..."
                />
                {errors.instructions && <p className="text-red-500 text-sm mt-1">{errors.instructions}</p>}
              </div>

              {/* Student Set Dropdown */}
              <div>
                <Label className="block text-sm font-medium mb-2 flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Student Set *
                </Label>
                <Select
                  value={formData.set}
                  onValueChange={(value) => handleChange('set', value)}
                  disabled={isLoadingSets}
                >
                  <SelectTrigger className={`w-full ${errors.set ? 'border-red-500' : ''}`}>
                    <SelectValue placeholder="Select student set" />
                  </SelectTrigger>
                  <SelectContent>
                    {isLoadingSets ? (
                      <SelectItem value="loading" disabled>Loading sets...</SelectItem>
                    ) : isErrorSets ? (
                      <SelectItem value="error" disabled>Error loading sets</SelectItem>
                    ) : (
                      distinctSets?.map((set) => (
                        <SelectItem key={set} value={set}>
                          {set}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                {errors.set && <p className="text-red-500 text-sm mt-1">{errors.set}</p>}
                <p className="text-xs text-gray-500 mt-1">
                  Specify which student group/set this exam is intended for.
                </p>
              </div>
            </div>

            {/* Exam Schedule */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Exam Schedule</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="block text-sm font-medium mb-2">Exam Date *</Label>
                  <Input
                    type="date"
                    value={formData.examDate}
                    onChange={(e) => handleChange('examDate', e.target.value)}
                    className={`w-full ${errors.examDate ? 'border-red-500' : ''}`}
                  />
                  {errors.examDate && <p className="text-red-500 text-sm mt-1">{errors.examDate}</p>}
                </div>

                <div>
                  <Label className="block text-sm font-medium mb-2">Start Time *</Label>
                  <Input
                    type="time"
                    value={formData.startTime}
                    onChange={(e) => handleChange('startTime', e.target.value)}
                    className={`w-full ${errors.startTime ? 'border-red-500' : ''}`}
                  />
                  {errors.startTime && <p className="text-red-500 text-sm mt-1">{errors.startTime}</p>}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="block text-sm font-medium mb-2">Duration (minutes) *</Label>
                  <Input
                    type="number"
                    value={formData.duration}
                    onChange={(e) => handleChange('duration', parseInt(e.target.value) || 0)}
                    min="1"
                    className={`w-full ${errors.duration ? 'border-red-500' : ''}`}
                  />
                  {errors.duration && <p className="text-red-500 text-sm mt-1">{errors.duration}</p>}
                </div>

                <div>
                  <Label className="block text-sm font-medium mb-2">Calculated End Time</Label>
                  <Input
                    type="text"
                    value={
                      formData.examDate && formData.startTime
                        ? format(new Date(calculateEndTime(formData.examDate, formData.startTime, formData.duration)), 'PPP p')
                        : ''
                    }
                    disabled
                    className="bg-gray-100"
                  />
                  <p className="text-xs text-gray-500 mt-1">Automatically calculated based on start time and duration</p>
                </div>
              </div>
            </div>

            {/* Navigation */}
            <div className="flex justify-end space-x-4 pt-6 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleNext}
                disabled={isLoading}
                className="flex items-center gap-2"
              >
                {isLoading ? 'Saving...' : 'Next: Select Questions'}
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default withRoleProtection(CreateExamBasicPage, ['lecturer', 'admin']);