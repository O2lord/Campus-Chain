import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import AppProvider from "@/components/providers/AppProvider";
import { Toaster } from "@/components/ui/sonner";
import SupabaseProvider from '@/components/providers/SupabaseProvider';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Campus Chain",
  description: "The ultimate tool for Lecturers and Students",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <SupabaseProvider>
          <AppProvider>
            {children}
            <Toaster />
          </AppProvider>
        </SupabaseProvider>
      </body>
    </html>
  );
}