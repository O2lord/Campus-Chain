"use client";
import  SolanaProvider from "./solanaProvider";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React, { PropsWithChildren } from "react";
import AppThemeProvider from "./AppThemeProvider";
import { SidebarInset, SidebarProvider } from "../ui/sidebar";
import { AppSidebar } from "../AppSidebar";
import { Toaster } from "../ui/sonner";
import { ToastContainer } from "react-toastify";

const queryClient = new QueryClient();

const AppProvider: React.FC<PropsWithChildren> = ({ children }) => {
  return (
    <QueryClientProvider client={queryClient}>
      <AppThemeProvider>
            <SolanaProvider>
              <Toaster richColors position="bottom-right" />
              <SidebarProvider>
                <AppSidebar />
                <SidebarInset>{children}</SidebarInset>
              </SidebarProvider>
              <ToastContainer />
            </SolanaProvider>
      </AppThemeProvider>
    </QueryClientProvider>
  );
};

export default AppProvider;
