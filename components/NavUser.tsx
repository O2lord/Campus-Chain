"use client";
import {
  BadgeCheck,
  Bell,
  ChevronsUpDown,
  LogOut,
  User,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSupabaseClient, useUser } from "@supabase/auth-helpers-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { useQuery } from "@tanstack/react-query";
import { SupabaseClient } from '@supabase/supabase-js';


interface ExtendedProfile {
  id: string;
  full_name: string;
  role: 'student' | 'lecturer' | 'admin';
  created_at?: string;
  updated_at?: string;
  matric_no?: string | null;
  set?: string | null;
  department?: string | null;
}

/**
 * Fetches user profile with role-specific data joined from appropriate tables
 */
async function getExtendedProfileById(userId: string, supabase: SupabaseClient): Promise<ExtendedProfile | null> {
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, full_name, role, created_at, updated_at')
    .eq('id', userId)
    .single();

  if (profileError) {
    if (profileError.code === 'PGRST116') {
      return null;
    }
    console.error('Error fetching profile:', profileError.message, profileError);
    throw new Error(`Failed to fetch profile: ${profileError.message}`);
  }

  const extendedProfile: ExtendedProfile = {
    ...profile,
  };

  // Based on the role, fetch additional data from the appropriate table
  if (profile.role === 'student') {
    const { data: studentData, error: studentError } = await supabase
      .from('students')
      .select('matric_no, set')
      .eq('id', userId)
      .single();

    if (studentError && studentError.code !== 'PGRST116') {
      console.error('Error fetching student data:', studentError.message, studentError);
    } else if (studentData) {
      extendedProfile.matric_no = studentData.matric_no;
      extendedProfile.set = studentData.set;
    }
  } else if (profile.role === 'lecturer') {
    const { data: lecturerData, error: lecturerError } = await supabase
      .from('lecturers')
      .select('department')
      .eq('id', userId)
      .single();

    if (lecturerError && lecturerError.code !== 'PGRST116') {
      console.error('Error fetching lecturer data:', lecturerError.message, lecturerError);
    } else if (lecturerData) {
      extendedProfile.department = lecturerData.department;
    }
  }

  return extendedProfile;
}

export function NavUser() {
  const { isMobile } = useSidebar();
  const supabaseClient = useSupabaseClient();
  const user = useUser();
  const router = useRouter();

  // Fetch user profile with role-specific data
  const { data: profile, isLoading: isProfileLoading } = useQuery({
    queryKey: ['extendedUserProfile', user?.id],
    queryFn: () => getExtendedProfileById(user!.id, supabaseClient),
    enabled: !!user?.id,
  });

  const handleLogout = async () => {
    try {
      await supabaseClient.auth.signOut();
      router.push('/');
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  const getDisplaySubtitle = () => {
    if (isProfileLoading) return 'Loading...';
    if (!profile) return user?.email || 'User';
    
    switch (profile.role) {
      case 'student':
        return profile.matric_no || user?.email || 'Student';
      case 'lecturer':
        return profile.department || user?.email || 'Lecturer';
      case 'admin':
        return 'Administrator';
      default:
        return user?.email || 'User';
    }
  };

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              {user ? (
                <>
                  <Avatar className="h-8 w-8 rounded-lg">
                    <AvatarImage
                      src={user.user_metadata?.avatar_url || ''}
                      alt={user.user_metadata?.full_name || user.email || 'User'}
                    />
                    <AvatarFallback className="rounded-lg">
                      {user.user_metadata?.full_name?.charAt(0) || user.email?.charAt(0) || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold">
                      {user.user_metadata?.full_name || profile?.full_name || user.email?.split('@')[0] || 'User'}
                    </span>
                    <span className="truncate text-xs">
                      {getDisplaySubtitle()}
                    </span>
                  </div>
                  <ChevronsUpDown className="ml-auto size-4" />
                </>
              ) : (
                <>
                  <Avatar className="h-8 w-8 rounded-lg">
                    <AvatarFallback className="rounded-lg">
                      <User className="h-4 w-4" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold">Login / Sign Up</span>
                    <span className="truncate text-xs">Not authenticated</span>
                  </div>
                  <ChevronsUpDown className="ml-auto size-4" />
                </>
              )}
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            {user ? (
              <>
                <DropdownMenuLabel className="p-0 font-normal">
                  <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                    <Avatar className="h-8 w-8 rounded-lg">
                      <AvatarImage
                        src={user.user_metadata?.avatar_url || ''}
                        alt={user.user_metadata?.full_name || user.email || 'User'}
                      />
                      <AvatarFallback className="rounded-lg">
                        {user.user_metadata?.full_name?.charAt(0) || user.email?.charAt(0) || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="grid flex-1 text-left text-sm leading-tight">
                      <span className="truncate font-semibold">
                        {user.user_metadata?.full_name || profile?.full_name || user.email?.split('@')[0] || 'User'}
                      </span>
                      <span className="truncate text-xs">
                        {getDisplaySubtitle()}
                      </span>
                    </div>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuItem asChild>
                    <Link href="/student/mint-history" className="flex items-center gap-2 cursor-pointer">
                      <BadgeCheck />
                      Profile
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/notifications" className="flex items-center gap-2 cursor-pointer">
                      <Bell />
                      Notifications
                    </Link>
                  </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="cursor-pointer">
                  <LogOut />
                  Log out
                </DropdownMenuItem>
              </>
            ) : (
              <>
                <DropdownMenuLabel className="p-0 font-normal">
                  <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                    <Avatar className="h-8 w-8 rounded-lg">
                      <AvatarFallback className="rounded-lg">
                        <User className="h-4 w-4" />
                      </AvatarFallback>
                    </Avatar>
                    <div className="grid flex-1 text-left text-sm leading-tight">
                      <span className="truncate font-semibold">Not logged in</span>
                      <span className="truncate text-xs">Please authenticate</span>
                    </div>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/auth/login" className="flex items-center gap-2 cursor-pointer">
                    <User />
                    Login / Sign Up
                  </Link>
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}