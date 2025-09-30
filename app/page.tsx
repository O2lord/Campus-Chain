"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSupabaseClient, useUser } from "@supabase/auth-helpers-react";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { getProfileById } from "@/services/profileService";

export default function Home() {
  const [isRedirecting, setIsRedirecting] = useState(true);
  const [showDashboard, setShowDashboard] = useState(false);
  const user = useUser();
  const supabaseClient = useSupabaseClient();
  const router = useRouter();

  useEffect(() => {
    const handleUserRedirection = async () => {
      // If no user is authenticated, show the dashboard (public access)
      if (!user) {
        setIsRedirecting(false);
        setShowDashboard(true);
        return;
      }

      try {
        // Fetch user's profile to determine their role
        const profile = await getProfileById(user.id, supabaseClient);
        
        if (profile?.role) {
          // Redirect based on user role
          switch (profile.role) {
            case 'admin':
              router.push('/admin');
              return;
            case 'lecturer':
              router.push('/admin');
              return;
            case 'student':
              router.push('/student');
              return;
            default:
              // If role is not recognized, stay on current page
              setIsRedirecting(false);
              setShowDashboard(true);
              return;
          }
        } else {
          // If no profile or role found, stay on current page
          setIsRedirecting(false);
          setShowDashboard(true);
        }
      } catch (error) {
        console.error('Error fetching profile for redirection:', error);
        // On error, stay on current page
        setIsRedirecting(false);
        setShowDashboard(true);
      }
    };

    handleUserRedirection();
  }, [user, supabaseClient, router]);

  // Show loading state while checking for redirection
  if (isRedirecting) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <p className="text-sm text-gray-600">Redirecting...</p>
        </div>
      </div>
    );
  }

  // Show dashboard if redirection is not needed
  if (!showDashboard) {
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">
          Campus Chain
        </h1>
        <div className="h-1 w-16 bg-gradient-to-r from-emerald-400 to-emerald-500 mx-auto mb-6"></div>
        <p className="text-lg text-gray-600 mb-8 max-w-2xl">
          Please{" "}
          <Link href="/auth/login" className="text-blue-600 hover:text-blue-800 underline">
            sign in
          </Link>{" "}
          to access your dashboard.
        </p>
      </div>
    </div>
  );
}