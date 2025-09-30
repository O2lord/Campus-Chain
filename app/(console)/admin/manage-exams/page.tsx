"use client";
import React, { useState } from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableCaption } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Calendar, CheckCircle, XCircle, Loader2, Edit } from "lucide-react";
import { FileCheck } from "lucide-react";
import { useSupabaseClient, useUser } from '@supabase/auth-helpers-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from "sonner";
import { format } from 'date-fns';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { getExamsByAuthority, publishExam, updateExamTimes, publishExamResults } from '@/services/examService';
import { useWallet } from '@solana/wallet-adapter-react';
import useExaminatorProgram from '@/hooks/useExaminator'; 

// Set display mapping
const SET_DISPLAY_MAP: Record<string, string> = {
  'set_a': 'Set A',
  'set_b': 'Set B',
  'set_c': 'Set C',
  'set_d': 'Set D',
  'set_e': 'Set E',
  'all_sets': 'All Sets',
};

const ManageExamsPage = () => {
  const supabaseClient = useSupabaseClient();
  const user = useUser();
  const queryClient = useQueryClient();
  const { publicKey } = useWallet();
  const {
    publishExam: publishExamBlockchain,
    unpublishExam: unpublishExamBlockchain,
    updateExamMetadata,
    getLecturerProfilePda,
  } = useExaminatorProgram();

  const { data: exams, isLoading, isError } = useQuery({
    queryKey: ['exams', user?.id],
    queryFn: () => getExamsByAuthority(user!.id, supabaseClient),
    enabled: !!user?.id && !!supabaseClient,
  });

  const publishExamMutation = useMutation({
    mutationFn: async ({ examId }: { examId: string }) => {
      if (!publicKey || !user?.id) {
        throw new Error("Wallet not connected or user not authenticated");
      }

      // Find the exam data to get necessary info
      const exam = exams?.find(e => e.id === examId);
      if (!exam) {
        throw new Error("Exam not found");
      }

      // First publish on Supabase
      await publishExam(examId, supabaseClient);
      
      // Then publish on blockchain
      const lecturerProfilePubkey = getLecturerProfilePda(publicKey, user.id);
      await publishExamBlockchain.mutateAsync({
        lecturerProfilePubkey: lecturerProfilePubkey.toString(),
        supabaseExamId: examId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exams', user?.id] });
      toast.success("Exam published successfully on both Supabase and blockchain!");
    },
    onError: (error) => {
      console.error("Error publishing exam:", error);
      toast.error("Failed to publish exam: " + (error as Error).message);
    },
  });

  const unpublishExamMutation = useMutation({
    mutationFn: async ({ examId }: { examId: string }) => {
      if (!publicKey || !user?.id) {
        throw new Error("Wallet not connected or user not authenticated");
      }

      // Find the exam data to get necessary info
      const exam = exams?.find(e => e.id === examId);
      if (!exam) {
        throw new Error("Exam not found");
      }

      // First unpublish on blockchain
      const lecturerProfilePubkey = getLecturerProfilePda(publicKey, user.id);
      await unpublishExamBlockchain.mutateAsync({
        lecturerProfilePubkey: lecturerProfilePubkey.toString(),
        supabaseExamId: examId,
      });
      
      // Then unpublish on Supabase
      // await unpublishExam(examId, supabaseClient);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exams', user?.id] });
      toast.success("Exam unpublished successfully on blockchain!");
    },
    onError: (error) => {
      console.error("Error unpublishing exam:", error);
      toast.error("Failed to unpublish exam: " + (error as Error).message);
    },
  });

  const publishResultsMutation = useMutation({
    mutationFn: ({ examId }: { examId: string }) => publishExamResults(examId, supabaseClient),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exams', user?.id] });
      toast.success("Exam results published successfully!");
    },
    onError: (error) => {
      console.error("Error publishing exam results:", error);
      toast.error("Failed to publish exam results.");
    },
  });

  const manualOpenExamMutation = useMutation({
    mutationFn: async ({ examId, startTime, endTime }: { examId: string; startTime: string; endTime: string }) => {
      if (!publicKey || !user?.id) {
        throw new Error("Wallet not connected or user not authenticated");
      }

      // Find the exam data to get necessary info
      const exam = exams?.find(e => e.id === examId);
      if (!exam) {
        throw new Error("Exam not found");
      }

      // First update on Supabase
      await updateExamTimes(examId, startTime, endTime, supabaseClient);
      
      // Then update on blockchain
      const lecturerProfilePubkey = getLecturerProfilePda(publicKey, user.id);
      
      // Create config hash from exam config (you may need to adjust this based on your exam structure)
      const examConfig = {
        duration: exam.duration_secs,
        courseCode: exam.course_code,
        courseTitle: exam.course_title ,
        instructions: exam.instructions,
        examDate: exam.exam_date,
        showScoresImmediately: exam.show_scores_immediately || false,
        showCorrectAnswers: exam.show_correct_answers || false,
      };

      await updateExamMetadata.mutateAsync({
        lecturerProfilePubkey: lecturerProfilePubkey.toString(),
        supabaseExamId: examId,
        newConfig: examConfig,
        newStartTime: new Date(startTime),
        newEndTime: new Date(endTime),
        newPublished: exam.published,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exams', user?.id] });
      toast.success("Exam times updated successfully on both Supabase and blockchain!");
      setIsDialogOpen(false);
    },
    onError: (error) => {
      console.error("Error manually opening exam:", error);
      toast.error("Failed to update exam times: " + (error as Error).message);
    },
  });

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedExamId, setSelectedExamId] = useState<string | null>(null);
  const [newStartTime, setNewStartTime] = useState('');
  const [newEndTime, setNewEndTime] = useState('');

  const handlePublish = async (examId: string) => {
    if (!publicKey) {
      toast.error("Please connect your wallet first");
      return;
    }
    publishExamMutation.mutate({ examId });
  };

  const handleUnpublish = async (examId: string) => {
    if (!publicKey) {
      toast.error("Please connect your wallet first");
      return;
    }
    unpublishExamMutation.mutate({ examId });
  };

  const handlePublishResults = async (examId: string) => {
    publishResultsMutation.mutate({ examId });
  };

  const handleOpenDialog = (examId: string, currentStartTs: string, currentEndTs: string) => {
    setSelectedExamId(examId);
  
    if (currentStartTs && currentStartTs !== '0') {
      const startDate = new Date(currentStartTs);
      setNewStartTime(format(startDate, "yyyy-MM-dd'T'HH:mm"));
    } else {
      setNewStartTime('');
    }
    
    if (currentEndTs && currentEndTs !== '0') {
      const endDate = new Date(currentEndTs);
      setNewEndTime(format(endDate, "yyyy-MM-dd'T'HH:mm"));
    } else {
      setNewEndTime('');
    }
    
    setIsDialogOpen(true);
  };

  const handleManualOpen = async () => {
    if (!selectedExamId || !newStartTime || !newEndTime) {
      toast.error("Please provide both start and end times.");
      return;
    }

    if (!publicKey) {
      toast.error("Please connect your wallet first");
      return;
    }

    const startDate = new Date(newStartTime);
    const endDate = new Date(newEndTime);

    if (endDate <= startDate) {
      toast.error("End time must be after start time.");
      return;
    }

    // Convert to ISO strings for the service
    const startTimeISO = startDate.toISOString();
    const endTimeISO = endDate.toISOString();

    manualOpenExamMutation.mutate({
      examId: selectedExamId,
      startTime: startTimeISO,
      endTime: endTimeISO,
    });
  };

  const isValidTimestamp = (timestamp: string): boolean => {
    return Boolean(timestamp && timestamp !== '0' && !isNaN(new Date(timestamp).getTime()));
  };

  const getSetDisplayName = (set: string): string => {
    return SET_DISPLAY_MAP[set] || set || 'Not Set';
  };

  if (!user) {
    return (
      <div className="max-w-4xl mx-auto p-6 text-center">
        <Loader2 className="w-8 h-8 animate-spin mx-auto" />
        <p className="mt-4">Loading user...</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto p-6 text-center">
        <Loader2 className="w-8 h-8 animate-spin mx-auto" />
        <p className="mt-4">Loading exams...</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="max-w-4xl mx-auto text-center text-red-500">
        <XCircle className="w-8 h-8 mx-auto" />
        <p className="mt-4">Error loading exams.</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-6 h-6" />
            Manage Exams
          </CardTitle>
          <CardDescription>
            View and manage the status of your created exams.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableCaption>A list of all exams you have created.</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Course Code</TableHead>
                <TableHead>Set</TableHead>
                <TableHead>Exam ID</TableHead>
                <TableHead>Published</TableHead>
                <TableHead>Results Published</TableHead>
                <TableHead>Start Time</TableHead>
                <TableHead>End Time</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {exams && exams.length > 0 ? (
                exams.map((exam) => (
                  <TableRow key={exam.id}>
                    <TableCell className="font-medium">{exam.course_title}</TableCell>
                    <TableCell>{exam.course_code}</TableCell>
                    <TableCell>
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {getSetDisplayName(exam.set)}
                      </span>
                    </TableCell>
                    <TableCell>{exam.exam_date}</TableCell>
                    <TableCell>
                      {exam.published ? (
                        <CheckCircle className="w-5 h-5 text-green-500" />
                      ) : (
                        <XCircle className="w-5 h-5 text-red-500" />
                      )}
                    </TableCell>
                    <TableCell>
                      {exam.results_published ? (
                        <CheckCircle className="w-5 h-5 text-green-500" />
                      ) : (
                        <XCircle className="w-5 h-5 text-red-500" />
                      )}
                    </TableCell>
                    <TableCell>
                      {isValidTimestamp(exam.start_ts) ? format(new Date(exam.start_ts), 'PPP p') : 'N/A'}
                    </TableCell>
                    <TableCell>
                      {isValidTimestamp(exam.end_ts) ? format(new Date(exam.end_ts), 'PPP p') : 'N/A'}
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      {!exam.published ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handlePublish(exam.id)}
                          disabled={publishExamMutation.isPending || !publicKey}
                        >
                          {publishExamMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Publish"}
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleUnpublish(exam.id)}
                          disabled={unpublishExamMutation.isPending || !publicKey}
                          className="bg-red-50 hover:bg-red-100 text-red-700 border-red-200"
                        >
                          {unpublishExamMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Unpublish"}
                        </Button>
                      )}
                      {exam.published && !exam.results_published && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handlePublishResults(exam.id)}
                          disabled={publishResultsMutation.isPending}
                          className="bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200"
                        >
                          {publishResultsMutation.isPending ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <>
                              <FileCheck className="w-4 h-4 mr-2" />
                              Publish Results
                            </>
                          )}
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenDialog(exam.id, exam.start_ts, exam.end_ts)}
                        disabled={manualOpenExamMutation.isPending || !publicKey}
                      >
                        <Edit className="w-4 h-4 mr-2" />
                        Set Times
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={9} className="text-center">
                    No exams created yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set Exam Start/End Times</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <label htmlFor="startTime" className="text-right">
                Start Time
              </label>
              <Input
                id="startTime"
                type="datetime-local"
                value={newStartTime}
                onChange={(e) => setNewStartTime(e.target.value)}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <label htmlFor="endTime" className="text-right">
                End Time
              </label>
              <Input
                id="endTime"
                type="datetime-local"
                value={newEndTime}
                onChange={(e) => setNewEndTime(e.target.value)}
                className="col-span-3"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
            <Button 
              onClick={handleManualOpen} 
              disabled={manualOpenExamMutation.isPending || !publicKey}
            >
              {manualOpenExamMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Times"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ManageExamsPage;