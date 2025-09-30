// src/app/(console)/student/page.tsx
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
import { Cog, Users, Clock, BarChart3 } from "lucide-react";
import Link from "next/link";
import { useUser } from '@supabase/auth-helpers-react';
import { useWallet } from '@solana/wallet-adapter-react';
import useExaminatorProgram from '@/hooks/useExaminator';
import { useEffect, useState } from 'react'; // Import useState
import { toast } from 'sonner';


export default function Home() {
    const user = useUser();
  const { publicKey } = useWallet();
  const { createStudentProfile, getStudentProfiles, getStudentProfilePda } = useExaminatorProgram();

  const [profileCreationAttempted, setProfileCreationAttempted] = useState(false); // New state

  useEffect(() => {
    if (user?.id && publicKey && !profileCreationAttempted) {
      // Only proceed if profiles data is loaded and not fetching
      if (getStudentProfiles.isSuccess && !getStudentProfiles.isFetching) {
        const studentProfilePda = getStudentProfilePda(publicKey, user.id);

        const existingProfile = getStudentProfiles.data?.find(
          (profile) => profile.publicKey.equals(studentProfilePda)
        );

        if (!existingProfile) {
          // Profile does not exist, create it
          createStudentProfile.mutateAsync({ supabaseId: user.id })
            .then(() => toast.success("Student profile created on Solana!"))
            .catch((error) => console.error("Error ensuring student profile on Solana:", error));
        }
        setProfileCreationAttempted(true); // Mark as attempted to prevent re-runs
      }
    }
  }, [user?.id, publicKey, createStudentProfile, getStudentProfiles.isSuccess, getStudentProfiles.isFetching, getStudentProfiles.data, getStudentProfilePda, profileCreationAttempted]);


  return (
    <div className="min-h-screen p-6 container mx-auto">
      <header className="mb-8">
        <h1 className="text-3xl font-bold">
          
        </h1>
        <div className="h-1 w-16 bg-gradient-to-r from-emerald-400 to-emerald-500 mt-2"></div>
      </header>

      <Card className="bg-[#1a2236] border-0 shadow-lg mb-8">
        <CardHeader>
          <CardTitle className="text-xl text-white">
            Student Dashboard
            <p className="mt-2 text-xs">
              Welcome 
            </p>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-[#141c2f] p-6 rounded-lg text-white">
            <p>
              As a student you can take exams, see your results and ask for any corrections.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Take Exam Card */}
        <Card className="bg-[#1a2236] border-0 shadow-lg relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-400 via-cyan-500 to-purple-600"></div>
          <CardHeader className="pb-2">
            <div className="bg-emerald-500 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
              <Cog className="h-6 w-6 text-white" />
            </div>
            <CardTitle className="text-white">Take Exam</CardTitle>
            <CardDescription className="text-gray-400">
              View availble exams
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Link href="/student/exam">
              <Button className="w-full bg-emerald-500 hover:bg-emerald-600 text-white">
                View
              </Button>
            </Link>
          </CardFooter>
        </Card>

        {/* Profile Card */}
        <Card className="bg-[#1a2236] border-0 shadow-lg relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-400 via-cyan-500 to-purple-600"></div>
          <CardHeader className="pb-2">
            <div className="bg-blue-500 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
              <Users className="h-6 w-6 text-white" />
            </div>
            <CardTitle className="text-white">Profile</CardTitle>
            <CardDescription className="text-gray-400">
              Manage your profile, register courses and view eligibilty
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Link href="/student/profile">
              <Button
                variant="outline"
                className="w-full border-gray-700 text-white hover:bg-gray-800"
              >
                View
              </Button>
            </Link>
          </CardFooter>
        </Card>

        {/* Results Card */}
        <Card className="bg-[#1a2236] border-0 shadow-lg relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-400 via-cyan-500 to-purple-600"></div>
          <CardHeader className="pb-2">
            <div className="bg-[#1a2236] border border-gray-700 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
              <Clock className="h-6 w-6 text-white" />
            </div>
            <CardTitle className="text-white">Exam Results</CardTitle>
            <CardDescription className="text-gray-400">
              View the results of exams your have taken
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Link href={"/student/results"}>
              <Button className="w-full bg-gradient-to-r from-purple-500 to-purple-700 hover:from-purple-600 hover:to-purple-800 text-white">
                View History
              </Button>
            </Link>
          </CardFooter>
        </Card>

        {/* Loan Card */}
        <Card className="bg-[#1a2236] border-0 shadow-lg relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-400 via-cyan-500 to-purple-600"></div>
          <CardHeader className="pb-2">
            <div className="bg-amber-500 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
              <BarChart3 className="h-6 w-6 text-white" />
            </div>
            <CardTitle className="text-white">Loans</CardTitle>
            <CardDescription className="text-gray-400">
              Request for loans and repay
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Link href="/loan">
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
