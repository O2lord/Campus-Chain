"use client";
import React from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableCaption } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { GraduationCap, Users, Loader2, XCircle } from "lucide-react";
import { useSupabaseClient, useUser } from '@supabase/auth-helpers-react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { getExamsByAuthority } from '@/services/examService';
import { withRoleProtection } from '@/components/withRoleProtection';

const GradeExamsPage = () => {
  const supabaseClient = useSupabaseClient();
  const user = useUser();

  const { data: exams, isLoading, isError } = useQuery({
    queryKey: ['exams', user?.id],
    queryFn: () => getExamsByAuthority(user!.id, supabaseClient),
    enabled: !!user?.id && !!supabaseClient,
  });

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
      <div className="max-w-4xl mx-auto p-6 text-center text-red-500">
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
            <GraduationCap className="w-6 h-6" />
            Grade Exams
          </CardTitle>
          <CardDescription>
            Select an exam to view and grade student attempts.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableCaption>A list of your exams available for grading.</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Course Code</TableHead>
                <TableHead>Exam ID</TableHead>
                <TableHead>Published</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {exams && exams.length > 0 ? (
                exams.map((exam) => (
                  <TableRow key={exam.id}>
                    <TableCell className="font-medium">{exam.course_title}</TableCell>
                    <TableCell>{exam.course_code}</TableCell>
                    <TableCell>{exam.exam_date}</TableCell>
                    <TableCell>
                      <span className={`inline-flex px-2 py-1 text-xs rounded-full ${
                        exam.published ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                      }`}>
                        {exam.published ? "Published" : "Draft"}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Link href={`/admin/grade-exams/${exam.id}`}>
                        <Button size="sm" variant="outline">
                          <Users className="w-4 h-4 mr-2" />
                          View Attempts
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="text-center">
                    No exams created yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default withRoleProtection(GradeExamsPage, ['admin','lecturer']);