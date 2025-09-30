"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Cog, Users, CreditCard, Clock, BarChart3 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react"; 
import { useUser } from '@supabase/auth-helpers-react';
import { useWallet } from '@solana/wallet-adapter-react';
import useExaminatorProgram from '@/hooks/useExaminator';
import { toast } from 'sonner';
import { updateLecturerWallet } from '@/services/lecturerService';

export default function Home() {
  const user = useUser();
  const { publicKey } = useWallet();
  const { createLecturerProfile, getLecturerProfiles, getLecturerProfilePda } = useExaminatorProgram();

  const [hasAttemptedLecturerProfileCreation, setHasAttemptedLecturerProfileCreation] = useState(false);

 useEffect(() => {
  const ensureLecturerProfile = async () => {
    if (user?.id && publicKey && !hasAttemptedLecturerProfileCreation) {
      setHasAttemptedLecturerProfileCreation(true); 

      const lecturerProfilePda = getLecturerProfilePda(publicKey, user.id);

      try {
        const { data: profiles, error: fetchError } = await getLecturerProfiles.refetch();

        if (fetchError) {
          console.error("Error fetching lecturer profiles:", fetchError);
          toast.error("Failed to check existing Solana lecturer profile.");
          return; 
        }

        const existingProfile = profiles?.find(
          (profile) => profile.publicKey.equals(lecturerProfilePda)
        );

        if (!existingProfile) {
          await createLecturerProfile.mutateAsync({ supabaseId: user.id });
          toast.success("Lecturer profile created on Solana!");
        } else {
          console.log("Lecturer profile already exists on Solana.");
        }

        // Always attempt to update the Supabase record with the current wallet address
        const { error: updateError } = await updateLecturerWallet(user.id, publicKey.toBase58());
        if (updateError) {
          console.error("Failed to update lecturer wallet in Supabase:", updateError);
          toast.error("Failed to save wallet address to profile.");
        } else {
          console.log("Lecturer wallet updated in Supabase.");
        }

      } catch (error) {
        console.error("Error ensuring lecturer profile on Solana:", error);
        toast.error("Failed to verify/create Solana lecturer profile.");
      }
    }
  };

  ensureLecturerProfile();
}, [
  user?.id,
  publicKey,
  createLecturerProfile,
  getLecturerProfiles,
  getLecturerProfilePda,
  hasAttemptedLecturerProfileCreation 
]); 

  return (
    <div className="min-h-screen p-6 container mx-auto">
      <header className="mb-8">
        <h1 className="text-3xl font-bold">
          Campus Chain
        </h1>
        <div className="h-1 w-16 bg-gradient-to-r from-emerald-400 to-emerald-500 mt-2"></div>
      </header>

      <Card className="bg-[#1a2236] border-0 shadow-lg mb-8">
        <CardHeader>
          <CardTitle className="text-xl text-white">
           Lecturer&apos;s Dashboard
           <p className="text-xs mt-2">
            Welcome.
           </p>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-[#141c2f] p-6 rounded-lg text-white">
            <p className="mb-4">
              This platform allows lecturers to create, manage, grade exams and review student&apos;s submissions.
            </p>

          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Question Submission Card */}
        <Card className="bg-[#1a2236] border-0 shadow-lg relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-400 via-cyan-500 to-purple-600"></div>
          <CardHeader className="pb-2">
            <div className="bg-emerald-500 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
              <Cog className="h-6 w-6 text-white" />
            </div>
            <CardTitle className="text-white">Questions</CardTitle>
            <CardDescription className="text-gray-400">
              Add exam questions to the question bank
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Link href="/admin/submit-questions">
              <Button className="w-full bg-emerald-500 hover:bg-emerald-600 text-white">
               Submit Questions
              </Button>
            </Link>
          </CardFooter>
        </Card>

        {/* Student identity Card */}
        <Card className="bg-[#1a2236] border-0 shadow-lg relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-400 via-cyan-500 to-purple-600"></div>
          <CardHeader className="pb-2">
            <div className="bg-blue-500 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
              <Users className="h-6 w-6 text-white" />
            </div>
            <CardTitle className="text-white">Student identity</CardTitle>
            <CardDescription className="text-gray-400">
              Manage student list for exam eligibilty
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Link href="/admin/student-identity">
              <Button
                variant="outline"
                className="w-full bg-blue-500 border-gray-700 text-white hover:bg-gray-800"
              >
                View
              </Button>
            </Link>
          </CardFooter>
        </Card>

        {/* Create Exam Card */}
        <Card className="bg-[#1a2236] border-0 shadow-lg relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-400 via-cyan-500 to-purple-600"></div>
          <CardHeader className="pb-2">
            <div className="bg-[#4263eb] w-12 h-12 rounded-lg flex items-center justify-center mb-4">
              <CreditCard className="h-6 w-6 text-white" />
            </div>
            <CardTitle className="text-white">Exams</CardTitle>
            <CardDescription className="text-gray-400">
              Create assessment for students
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Link href="/admin/create-exams">
              <Button className="w-full bg-[#4263eb] hover:bg-[#3b5bdb] text-white">
               Create Exams
              </Button>
            </Link>
          </CardFooter>
        </Card>

        {/* Manage Exam Card */}
        <Card className="bg-[#1a2236] border-0 shadow-lg relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-400 via-cyan-500 to-purple-600"></div>
          <CardHeader className="pb-2">
            <div className="bg-[#1a2236] border border-gray-700 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
              <Clock className="h-6 w-6 text-white" />
            </div>
            <CardTitle className="text-white">Manage Exams</CardTitle>
            <CardDescription className="text-gray-400">
              View created exams and publish them or release results
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Link href={"/admin/manage-exams"}>
              <Button className="w-full bg-gradient-to-r from-purple-500 to-purple-700 hover:from-purple-600 hover:to-purple-800 text-white">
                View
              </Button>
            </Link>
          </CardFooter>
        </Card>

        {/* Grade Exams Card */}
        <Card className="bg-[#1a2236] border-0 shadow-lg relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-400 via-cyan-500 to-purple-600"></div>
          <CardHeader className="pb-2">
            <div className="bg-amber-500 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
              <BarChart3 className="h-6 w-6 text-white" />
            </div>
            <CardTitle className="text-white">Grade Exams</CardTitle>
            <CardDescription className="text-gray-400">
              View Student&apos;s attempts, request for remarks and grade them
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Link href="/admin/grade-exams">
              <Button className="w-full bg-amber-500 hover:bg-amber-600 text-white">
               View
              </Button>
            </Link>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}