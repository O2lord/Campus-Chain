"use client"
import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { withRoleProtection } from '@/components/withRoleProtection';

const CreateExamPage = () => {
  const router = useRouter();

  useEffect(() => {
    router.push('/admin/create-exams/basic');
  }, [router]);

  return (
    <div className="max-w-4xl mx-auto p-6 text-center">
      <p>Redirecting to exam creation...</p>
    </div>
  );
};

export default withRoleProtection(CreateExamPage, ['lecturer', 'admin']);
