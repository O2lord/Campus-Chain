"use client";
import * as React from "react";
import {
  ArrowDownUpIcon,
  Globe2Icon,
  GlobeIcon,
  LeafyGreenIcon,
  LifeBuoy,
  PlusCircleIcon,
  RefreshCwIcon,
  Send,
  SettingsIcon,
  UsersIcon,
} from "lucide-react";

import { NavMain } from "@/components/NavMain";
import { NavSecondary } from "@/components/NavSecondary";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { NavUser } from "./NavUser";
import { useAuth } from "@/hooks/useAuth";

const getNavigationByRole = (role: string | undefined) => {
  const baseNavSecondary = [
    {
      title: "Support",
      url: "#",
      icon: LifeBuoy,
    },
    {
      title: "Feedback",
      url: "#",
      icon: Send,
    },
  ];

  switch (role) {
    case 'student':
      return {
        navMainSimulator: [
          {
            title: "Take Exams",
            url: "/student/exam",
            icon: PlusCircleIcon,
          },
          {
            title: "View Results",
            url: "/student/results",
            icon: Globe2Icon,
          },
          {
            title: "Profile",
            url: "/student/profile",
            icon: GlobeIcon,
            isActive: true,
          },
          {
            title: "OSCE Simulator",
            url: "/web2/ede84f08-0de1-4a63-a5d6-ced8e940ade4",
            icon: Globe2Icon,
          },
        ],
        navMainForLoans: [
          {
            title: "Apply",
            url: "/scholarship/student",
            icon: RefreshCwIcon,
          },
        ],
        navElection: [
          {
            title: "Vote for Candidates",
            url: "/student/voting",
            icon: Globe2Icon,
          }
        ],
        navSwiftPay: [
          {
            title: "Pay",
            url: "/swift-pay",
            icon: RefreshCwIcon,
          },
        ],
        navMain: [], 
        navLecturerSimulator: [],
        navSecondary: baseNavSecondary,
      };

    case 'admin':
      case 'lecturer':
      return {
        navMainSimulator: [],
        navMain: [
          {
            title: "Submit Questions",
            url: "/admin/submit-questions",
            icon: SettingsIcon,
            isActive: true,
          },
          {
            title: "Create Exams",
            url: "/admin/create-exams",
            icon: PlusCircleIcon,
          },
          {
            title: "Student Identity",
            url: "/admin/student-identity",
            icon: UsersIcon,
          },
          {
            title: "Manage Exams",
            url: "/admin/manage-exams",
            icon: SettingsIcon,
            isActive: true,
          },
          {
            title: "Grade Exams",
            url: "/admin/grade-exams",
            icon: SettingsIcon,
            isActive: true,
          },
        ],
         navLecturerSimulator: [
          {
            title: "Exam Simulator",
            url: "/simulator",
            icon: Globe2Icon,
          },
        ],
         navMainForLoans: [
            {
            title: "Create",
            url: "/scholarship/lecturer",
            icon: ArrowDownUpIcon,
            isActive: true,
          },
        ],
         navElection: [
          {
            title: "Create Poll",
            url: "/admin/polls/create-poll",
            icon: Globe2Icon,
          },
          {
            title: "Results",
            url: "/admin/polls/declare-results",
            icon: Globe2Icon,
          }
        ],
        navSwiftPay: [
          {
            title: "Pay",
            url: "/swift-pay",
            icon: RefreshCwIcon,
          },
        ],
        navSecondary: baseNavSecondary,
      };

    default:
      return {
        navMainSimulator: [],
        navMain: [],
        navLecturerSimulator: [],
        navMainForLoans: [],
        navElection: [],
        navSwiftPay: [],
        navSecondary: baseNavSecondary,
      };
  }
};

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { role, loading } = useAuth();
  
  if (loading) {
    return (
      <Sidebar variant="inset" {...props}>
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg" asChild>
                <a href="#">
                  <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                    <LeafyGreenIcon className="size-4" />
                  </div>
                  <div className="grid flex-1 text-left text-xl leading-tight">
                    <span className="truncate font-semibold">Campus Chain </span>
                  </div>
                </a>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>
        <SidebarContent>
          <div className="flex items-center justify-center p-4">
            <span>Loading...</span>
          </div>
        </SidebarContent>
      </Sidebar>
    );
  }

  const navigation = getNavigationByRole(role);

  return (
    <Sidebar variant="inset" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <a href="#">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                  <LeafyGreenIcon className="size-4" />
                </div>
                <div className="grid flex-1 text-left text-xl leading-tight">
                  <span className="truncate font-semibold">Campus Chain </span>
                </div>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        {navigation.navMainSimulator.length > 0 && (
          <NavMain label="SIMULATOR" items={navigation.navMainSimulator} />
        )}
        {navigation.navMain.length > 0 && (
          <NavMain label="ADMIN" items={navigation.navMain} />
        )}
        {navigation.navLecturerSimulator.length > 0 && (
          <NavMain label="SIMULATOR" items={navigation.navLecturerSimulator} />
        )}
        {navigation.navMainForLoans.length > 0 && (
          <NavMain label="SCHOLARSHIP" items={navigation.navMainForLoans} />
        )}
        {navigation.navElection.length > 0 && (
          <NavMain label="Elections" items={navigation.navElection} />
        )}
        {navigation.navSwiftPay.length > 0 && (
          <NavMain label="Swift Pay" items={navigation.navSwiftPay} />
        )}
        <NavSecondary items={navigation.navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
    </Sidebar>
  );
}