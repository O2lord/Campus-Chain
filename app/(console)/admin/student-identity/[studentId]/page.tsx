"use client";

import React from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, BookOpen, GraduationCap, Trophy, Clock, Calendar } from "lucide-react";
import SkeletonWapper from "@/components/SkeletonWapper";
import ExplorerLink from "@/components/ExplorerLink";
import { getStudentById } from "@/services/studentIdentityService";
import { getStudentAttemptsWithExamDetails } from "@/services/attemptService";
import { getScholarshipApplicationsByStudent } from "@/services/scholarshipService";
import { supabase } from "@/services/supabase";

const StudentDetailsPage = () => {
  const params = useParams();
  const router = useRouter();
  const studentId = params?.studentId as string;

  const { data: student, isLoading: studentLoading, isError: studentError } = useQuery({
    queryKey: ["student", studentId],
    queryFn: async () => {
      console.log("Fetching student with ID:", studentId);
      const result = await getStudentById(studentId, supabase);
      console.log("Student query result:", result);
      return result;
    },
    enabled: !!studentId,
  });

  const { data: attempts, isLoading: attemptsLoading, isError: attemptsError } = useQuery({
    queryKey: ["studentAttempts", studentId],
    queryFn: () => getStudentAttemptsWithExamDetails(studentId, supabase),
    enabled: !!studentId,
  });

  const { data: scholarshipResponse, isLoading: scholarshipLoading, isError: scholarshipError } = useQuery({
    queryKey: ["studentScholarships", studentId],
    queryFn: () => getScholarshipApplicationsByStudent(studentId),
    enabled: !!studentId,
  });

  const scholarshipApplications = scholarshipResponse?.data || [];

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'graded':
        return 'default';
      case 'in_progress':
        return 'secondary';
      case 'submitted':
        return 'outline';
      case 'approved':
        return 'default';
      case 'pending':
        return 'secondary';
      case 'rejected':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  if (studentError || attemptsError || scholarshipError) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardContent className="p-6">
            <p className="text-red-500">Error loading student data. Please try again.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button variant="outline" onClick={() => router.back()}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <h1 className="text-3xl font-bold">Student Details</h1>
      </div>

      <SkeletonWapper isLoading={studentLoading}>
        {student && (
          <>
            {/* Student Overview */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <GraduationCap className="w-5 h-5" />
                  {student.name}
                </CardTitle>
                <CardDescription>
                  {student.matric_no} • {student.set}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <p className="text-sm font-medium text-gray-500">Attendance</p>
                    <p className="text-2xl font-bold">{student.attendance}%</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">Eligibility Status</p>
                    <Badge 
                      variant={student.eligible ? 'default' : 'destructive'}
                      className="mt-1"
                    >
                      {student.eligible ? 'Eligible' : 'Not Eligible'}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">Wallet Address</p>
                    {student?.wallet ? (
                        <ExplorerLink type="address" value={student.wallet}>
                        <span className="font-mono text-sm">
                            {student.wallet.slice(0, 4)}...{student.wallet.slice(-4)}
                        </span>
                        </ExplorerLink>
                    ) : (
                        <p className="text-gray-400 mt-1">Not provided</p>
                    )}
                    </div>
                </div>
              </CardContent>
            </Card>

            {/* Tabs for different sections */}
            <Tabs defaultValue="exams" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="exams" className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4" />
                  Exam Records
                </TabsTrigger>
                <TabsTrigger value="scholarships" className="flex items-center gap-2">
                  <Trophy className="w-4 h-4" />
                  Scholarship Applications
                </TabsTrigger>
              </TabsList>

              {/* Exam Records Tab */}
              <TabsContent value="exams">
                <Card>
                  <CardHeader>
                    <CardTitle>Exam Attempts</CardTitle>
                    <CardDescription>
                      Complete history of exam attempts and scores
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <SkeletonWapper isLoading={attemptsLoading}>
                      {attempts && attempts.length > 0 ? (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Course</TableHead>
                              <TableHead>Exam Date</TableHead>
                              <TableHead>Duration</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead>Score</TableHead>
                              <TableHead>Time Spent</TableHead>
                              <TableHead>Attempt Date</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {attempts.map((attempt) => (
                              <TableRow key={attempt.id}>
                                <TableCell>
                                  <div>
                                    <p className="font-medium">
                                      {attempt.exam?.course_title || 'Unknown Course'}
                                    </p>
                                    <p className="text-sm text-gray-500">
                                      {attempt.exam?.course_code || 'N/A'}
                                    </p>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-2">
                                    <Calendar className="w-4 h-4 text-gray-500" />
                                    {attempt.exam?.exam_date 
                                      ? formatDate(attempt.exam.exam_date)
                                      : 'N/A'
                                    }
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-2">
                                    <Clock className="w-4 h-4 text-gray-500" />
                                    {attempt.exam?.duration_secs 
                                      ? formatDuration(attempt.exam.duration_secs)
                                      : 'N/A'
                                    }
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <div className="flex flex-col gap-1">
                                    <Badge variant={getStatusBadgeVariant(attempt.status)}>
                                      {attempt.status.replace('_', ' ').toUpperCase()}
                                    </Badge>
                                    {attempt.exam?.results_published === false && (
                                      <Badge variant="outline" className="text-xs">
                                        Results Pending
                                      </Badge>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  {attempt.final_score !== null && attempt.final_score !== undefined && attempt.max_possible_score ? (
                                    <div>
                                      <span className="font-medium">
                                        {attempt.final_score}/{attempt.max_possible_score}
                                      </span>
                                      <span className="text-sm text-gray-500 ml-2">
                                        ({Math.round((attempt.final_score / attempt.max_possible_score) * 100)}%)
                                      </span>
                                    </div>
                                  ) : (
                                    <span className="text-gray-400">Not graded</span>
                                  )}
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-2">
                                    <Clock className="w-4 h-4 text-gray-500" />
                                    {attempt.time_spent_seconds 
                                      ? formatDuration(attempt.time_spent_seconds)
                                      : 'N/A'
                                    }
                                  </div>
                                </TableCell>
                                <TableCell>
                                  {attempt.start_ts 
                                    ? formatDate(attempt.start_ts)
                                    : 'N/A'
                                  }
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      ) : (
                        <div className="text-center py-8">
                          <BookOpen className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                          <p className="text-gray-500">No exam attempts found</p>
                        </div>
                      )}
                    </SkeletonWapper>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Scholarship Applications Tab */}
              <TabsContent value="scholarships">
                <Card>
                  <CardHeader>
                    <CardTitle>Scholarship Applications</CardTitle>
                    <CardDescription>
                      History of scholarship applications and their status
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <SkeletonWapper isLoading={scholarshipLoading}>
                      {scholarshipApplications && scholarshipApplications.length > 0 ? (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Application Date</TableHead>
                              <TableHead>Scholarship ID</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead>Attendance</TableHead>
                              <TableHead>Latest Score</TableHead>
                              <TableHead>Reason</TableHead>
                              <TableHead>Lecturer Response</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {scholarshipApplications.map((application) => (
                              <TableRow key={application.id}>
                                <TableCell>
                                  {formatDate(application.created_at)}
                                </TableCell>
                                <TableCell className="font-mono text-sm">
                                  {application.scholarship_id.substring(0, 8)}...
                                </TableCell>
                                <TableCell>
                                  <Badge variant={getStatusBadgeVariant(application.status)}>
                                    {application.status.toUpperCase()}
                                  </Badge>
                                </TableCell>
                                <TableCell>{application.attendance}%</TableCell>
                                <TableCell>
                                  {application.latest_score ?? 'N/A'}
                                </TableCell>
                                <TableCell className="max-w-xs">
                                  <p className="truncate" title={application.reason}>
                                    {application.reason}
                                  </p>
                                </TableCell>
                                <TableCell className="max-w-xs">
                                  {application.lecturer_response ? (
                                    <p className="truncate" title={application.lecturer_response}>
                                      {application.lecturer_response}
                                    </p>
                                  ) : (
                                    <span className="text-gray-400">No response</span>
                                  )}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      ) : (
                        <div className="text-center py-8">
                          <Trophy className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                          <p className="text-gray-500">No scholarship applications found</p>
                        </div>
                      )}
                    </SkeletonWapper>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </>
        )}
      </SkeletonWapper>
    </div>
  );
};

export default StudentDetailsPage;