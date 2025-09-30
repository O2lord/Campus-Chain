"use client";

import Link from "next/link";
import { CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function RegistrationSuccessPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-blue-100 p-4">
      <Card className="w-full max-w-md shadow-lg text-center">
        <CardHeader className="space-y-1">
          <div className="flex items-center justify-center mb-4">
            <CheckCircle className="size-12 text-green-500" />
          </div>
          <CardTitle className="text-2xl font-bold">Registration Successful!</CardTitle>
          <CardDescription>
            Your account has been created. Please check your email for a verification link if required.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/auth/login">
            <Button className="w-full">Go to Login</Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
