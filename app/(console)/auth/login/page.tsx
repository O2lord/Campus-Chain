"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useSupabaseClient } from "@supabase/auth-helpers-react";
import { Eye, EyeOff, Mail, Lock, LogIn, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { getProfileById } from "@/services/profileService";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [authLoaded, setAuthLoaded] = useState(false);
  
  const supabaseClient = useSupabaseClient();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Set up auth state change listener to handle initial authentication state
  useEffect(() => {
  const { data: { subscription } } = supabaseClient.auth.onAuthStateChange(
    async (event, session) => {
      setAuthLoaded(true);

      // If user is authenticated, handle redirection
      if (session?.user) {
        try {
          // Fetch the user's profile to determine their role
          const profile = await getProfileById(session.user.id, supabaseClient);
          
          // Determine default redirect path based on user role
          let defaultRedirectPath = "/";
          if (profile?.role === "admin") {
            defaultRedirectPath = "/admin";
          } else if (profile?.role === "lecturer") {
            defaultRedirectPath = "/admin";
          } else if (profile?.role === "student") {
            defaultRedirectPath = "/student";
          }

          const redirectedFrom = searchParams.get('redirectedFrom');
          
          // Determine target path: prioritize redirectedFrom, otherwise use role-based default
          const targetPath = (redirectedFrom && redirectedFrom !== '/') 
            ? redirectedFrom 
            : defaultRedirectPath;

          // Get current path to prevent unnecessary redirects
          const currentPath = window.location.pathname;
          
          // Only redirect if we're not already on the target path
          if (currentPath !== targetPath) {
            router.push(targetPath);
            router.refresh();
          }
        } catch (error) {
          console.error("Error fetching profile during auth state change:", error);
          // Fallback to home page if profile fetch fails
          const redirectedFrom = searchParams.get('redirectedFrom');
          const fallbackPath = (redirectedFrom && redirectedFrom !== '/') ? redirectedFrom : "/";
          
          if (window.location.pathname !== fallbackPath) {
            router.push(fallbackPath);
            router.refresh();
          }
        }
      }
    }
  );

  // Cleanup subscription on unmount
  return () => {
    subscription.unsubscribe();
  };
}, [supabaseClient, searchParams, router]); // Added supabaseClient to dependencies
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const { error } = await supabaseClient.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setError(error.message);
        return;
      }

      // The onAuthStateChange listener will handle the redirection
      // No need for router.push here anymore
    } catch (err) {
      setError("An unexpected error occurred. Please try again.");
      console.error("Login error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError("");

    try {
      // Include the redirectedFrom parameter in the OAuth redirect
      const redirectedFrom = searchParams.get('redirectedFrom');
      const redirectTo = redirectedFrom 
        ? `${window.location.origin}/auth/callback?redirectedFrom=${encodeURIComponent(redirectedFrom)}`
        : `${window.location.origin}/auth/callback`;

      const { error } = await supabaseClient.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo,
        },
      });

      if (error) {
        setError(error.message);
      }
    } catch (err) {
      setError("An unexpected error occurred with Google sign-in.");
      console.error("Google login error:", err);
    } finally {
      setLoading(false);
    }
  };

  // Show loading spinner while authentication state is being determined
  if (!authLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <p className="text-sm text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="space-y-1">
          <div className="flex items-center justify-center mb-4">
            <div className="flex aspect-square size-12 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <LogIn className="size-6" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold text-center">Welcome Back</CardTitle>
          <CardDescription className="text-center">
            Sign in to your Campus Chain account
          </CardDescription>
        </CardHeader>
        
        <form onSubmit={handleLogin}>
          <CardContent className="space-y-4">
            {error && (
              <Alert className="border-red-200 bg-red-50">
                <AlertDescription className="text-red-700">
                  {error}
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 size-4" />
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 size-4" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <Link 
                href="/auth/forgot-password" 
                className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
              >
                Forgot password?
              </Link>
            </div>

            <Button 
              type="submit" 
              className="w-full" 
              disabled={loading}
            >
              {loading ? "Signing in..." : "Sign In"}
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">Or continue with</span>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={handleGoogleLogin}
              disabled={loading}
            >
              <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Continue with Google
            </Button>
          </CardContent>
        </form>

        <CardFooter className="flex flex-col space-y-2">
          <div className="text-sm text-center text-gray-600">
            Don&apos;t have an account?{" "}
            <Link 
              href="/auth/register" 
              className="text-blue-600 hover:text-blue-800 hover:underline font-medium"
            >
              Sign up
            </Link>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}