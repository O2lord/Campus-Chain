"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useSupabaseClient } from "@supabase/auth-helpers-react";
import { Eye, EyeOff, Mail, Lock, User, UserPlus, GraduationCap, Users, Building } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { addStudent } from '@/services/studentIdentityService';
import { createLecturerDetails } from '@/services/lecturerService';

type UserRole = "student" | "lecturer";

export default function RegisterPage() {
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    fullName: "",
    matricNo: "",
    set: "",
    department: "",
    role: "student" as UserRole,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);

  const supabaseClient = useSupabaseClient();
  const router = useRouter();
  const { publicKey } = useWallet();

 
  useEffect(() => {
    if (publicKey) {
      setWalletAddress(publicKey.toBase58());
    } else {
      setWalletAddress(null);
    }
  }, [publicKey]);

  const handleInputChange = (field: string, value: string) => {
  setFormData(prev => ({
    ...prev,
    [field]: field === 'set' ? value.toUpperCase().trim() : value
  }));
};

  const validateForm = () => {
    if (!formData.email || !formData.password || !formData.fullName) {
      setError("Please fill in all required fields.");
      return false;
    }

    if (formData.password.length < 6) {
      setError("Password must be at least 6 characters long.");
      return false;
    }

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match.");
      return false;
    }

    if (formData.role === "student") {
      if (!formData.matricNo) {
        setError("Matric number is required for students.");
        return false;
      }
      if (!formData.set) {
        setError("Set is required for students.");
        return false;
      }
    }

    if (formData.role === "lecturer" && !formData.department) {
      setError("Department is required for lecturers.");
      return false;
    }

    if (!agreedToTerms) {
      setError("Please agree to the terms and conditions.");
      return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setError("Please enter a valid email address.");
      return false;
    }

    return true;
  };

const handleRegister = async (e: React.FormEvent) => {
  e.preventDefault();
  setError("");

  if (!validateForm()) {
    return;
  }

  setLoading(true);

  try {
    console.log("Starting registration process...");

   
    const { data, error: signUpError } = await supabaseClient.auth.signUp({
      email: formData.email,
      password: formData.password,
      options: {
        data: {
          full_name: formData.fullName,
          role: formData.role,
          matric_no: formData.matricNo,
          set: formData.set,
          department: formData.department,
          wallet_address: walletAddress,
        },
      },
    });

    console.log("Signup response:", { data, error: signUpError });

    if (signUpError) {
      console.error("Signup error:", signUpError);
      setError(signUpError.message);
      return;
    }

    if (data.user) {
      console.log("User created successfully:", data.user.id);

     
      if (!data.session) {
        setError("Please check your email and click the confirmation link to complete your registration.");
        return;
      }

     
      const { data: profileCheck } = await supabaseClient
        .from('profiles')
        .select('id')
        .eq('id', data.user.id)
        .single();

      if (!profileCheck) {
        console.log("Trigger failed, creating records manually...");

       
        const { error: profileError } = await supabaseClient
          .from("profiles")
          .insert({
            id: data.user.id,
            full_name: formData.fullName,
            role: formData.role,
          });

        if (profileError) {
          console.error("Profile creation error:", profileError);
          setError("Failed to create user profile. Please try again.");
          return;
        }

       
        if (formData.role === "student") {
          const { error: studentError } = await addStudent({
            name: formData.fullName,
            matric_no: formData.matricNo,
            set: formData.set,
            wallet: walletAddress,
            attendance: 0,
          });

          if (studentError) {
            console.error("Student record creation error:", studentError);
            setError("Failed to create student record. Please try again.");
            return;
          }
        } else if (formData.role === "lecturer") {
          const { error: lecturerError } = await createLecturerDetails({
            id: data.user.id,
            department: formData.department,
            wallet: walletAddress,
          });

          if (lecturerError) {
            console.error("Lecturer record creation error:", lecturerError);
            setError("Failed to create lecturer record. Please try again.");
            return;
          }
        }
      }

      console.log("Registration completed successfully!");
      router.push("/auth/registration-success");
    }
  } catch (err) {
    console.error("Unexpected registration error:", err);
    setError("An unexpected error occurred. Please try again.");
  } finally {
    setLoading(false);
  }
};

  const handleGoogleSignUp = async () => {
    setLoading(true);
    setError("");

    try {
      const { error } = await supabaseClient.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        setError(error.message);
      }
    } catch (err) {
      setError("An unexpected error occurred with Google sign-up.");
      console.error("Google signup error:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-blue-100 p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="space-y-1">
          <div className="flex items-center justify-center mb-4">
            <div className="flex aspect-square size-12 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <UserPlus className="size-6" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold text-center">Create Account</CardTitle>
          <CardDescription className="text-center">
            Join Campus Chain and start your learning journey
          </CardDescription>
        </CardHeader>

        <form onSubmit={handleRegister}>
          <CardContent className="space-y-4">
            {error && (
              <Alert className="border-red-200 bg-red-50">
                <AlertDescription className="text-red-700">
                  {error}
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name *</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 size-4" />
                <Input
                  id="fullName"
                  type="text"
                  placeholder="Enter your full name"
                  value={formData.fullName}
                  onChange={(e) => handleInputChange("fullName", e.target.value)}
                  className="pl-10"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 size-4" />
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your email"
                  value={formData.email}
                  onChange={(e) => handleInputChange("email", e.target.value)}
                  className="pl-10"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">Role *</Label>
              <Select value={formData.role} onValueChange={(value) => handleInputChange("role", value)}>
                <SelectTrigger className="w-full">
                  <div className="flex items-center">
                    {formData.role === "student" ? (
                      <GraduationCap className="mr-2 size-4" />
                    ) : (
                      <Users className="mr-2 size-4" />
                    )}
                    <SelectValue />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="student">
                    <div className="flex items-center">
                      <GraduationCap className="mr-2 size-4" />
                      Student
                    </div>
                  </SelectItem>
                  <SelectItem value="lecturer">
                    <div className="flex items-center">
                      <Users className="mr-2 size-4" />
                      Lecturer
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formData.role === "student" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="matricNo">Matric Number *</Label>
                  <Input
                    id="matricNo"
                    type="text"
                    placeholder="Enter your matric number"
                    value={formData.matricNo}
                    onChange={(e) => handleInputChange("matricNo", e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="set">Set *</Label>
                  <Input
                    id="set"
                    type="text"
                    placeholder="Enter your set (e.g., 2020, 2021)"
                    value={formData.set}
                    onChange={(e) => handleInputChange("set", e.target.value)}
                    required
                  />
                </div>
              </>
            )}

            {formData.role === "lecturer" && (
              <div className="space-y-2">
                <Label htmlFor="department">Department *</Label>
                <div className="relative">
                  <Building className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 size-4" />
                  <Input
                    id="department"
                    type="text"
                    placeholder="Enter your department"
                    value={formData.department}
                    onChange={(e) => handleInputChange("department", e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>
            )}

            {/* New Wallet Address Field 
            <div className="space-y-2">
              <Label htmlFor="walletAddress">Solana Wallet Address (Optional)</Label>
              <div className="relative">
                <Input
                  id="walletAddress"
                  type="text"
                  placeholder="Connect wallet or enter address"
                  value={walletAddress || ""}
                  onChange={(e) => setWalletAddress(e.target.value)}
                  className="pr-10"
                />
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                  <WalletMultiButton />
                </div>
              </div>
              <p className="text-xs text-gray-500">Your connected wallet address will appear here.</p>
            </div>

            */}

            <div className="space-y-2">
              <Label htmlFor="password">Password *</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 size-4" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Create a password"
                  value={formData.password}
                  onChange={(e) => handleInputChange("password", e.target.value)}
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
              <p className="text-xs text-gray-500">Must be at least 6 characters long</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password *</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 size-4" />
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Confirm your password"
                  value={formData.confirmPassword}
                  onChange={(e) => handleInputChange("confirmPassword", e.target.value)}
                  className="pl-10 pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showConfirmPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="terms"
                checked={agreedToTerms}
                onCheckedChange={(checked) => setAgreedToTerms(checked as boolean)}
              />
              <Label htmlFor="terms" className="text-sm text-gray-600">
                I agree to the{" "}
                <Link href="/terms" className="text-blue-600 hover:underline">
                  Terms of Service
                </Link>{" "}
                and{" "}
                <Link href="/privacy" className="text-blue-600 hover:underline">
                  Privacy Policy
                </Link>
              </Label>
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={loading}
            >
              {loading ? "Creating Account..." : "Create Account"}
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
              onClick={handleGoogleSignUp}
              disabled={loading}
            >
              <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
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
            Already have an account?{" "}
            <Link
              href="/auth/login"
              className="text-blue-600 hover:text-blue-800 hover:underline font-medium"
            >
              Sign in
            </Link>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
