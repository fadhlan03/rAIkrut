"use client"

import * as React from "react"
import {
  // ArrowUpCircleIcon,
  // CameraIcon,
  // ClipboardListIcon,
  // DatabaseIcon,
  // FileCodeIcon,
  // FileIcon,
  // FileTextIcon,
  // HelpCircleIcon,
  // SearchIcon,
  // SettingsIcon,
  // BarChartIcon,
  // FolderIcon,
  // ListIcon,
  Files,
  FileStack,
  Briefcase,
  Send,
  Users,
  FileText,
  ComputerIcon,
  LayoutDashboard,
  MoonIcon,
  SunIcon,
  DoorOpen,
  UserRoundPen,
  ListChecks,
  UserCheck,
  ListTodo,
  Users as UsersIcon,
  Shield,
  Network,
  type LucideIcon,
} from "lucide-react"
import Link from "next/link"
import { useTheme } from "next-themes"
import { usePathname } from "next/navigation"
import { useDashboard } from "@/contexts/DashboardContext"
import { useAuth } from "@/contexts/AuthContext"
import { getCookie } from "cookies-next"

import { NavMain } from "@/components/dashboard/nav-main"
import { NavUser } from "@/components/dashboard/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

interface NavItem {
  title: string;
  url: string;
  icon: LucideIcon;
  siteTitle?: string;
  addSeparatorAfter?: boolean;
}

// User data interface
interface UserData {
  name: string;
  email: string;
  avatar: string;
}

// Navigation items for the admin section
const adminNavMain: NavItem[] = [
  {
    title: "Job Posts",
    url: "/jobs",
    icon: Briefcase,
    siteTitle: "Job Posts",
  },
  // {
  //   title: "Benchmarking",
  //   url: "/benchmarks",
  //   icon: ListChecks,
  //   siteTitle: "Jobs Benchmarking",
  // },
  // {
  //   title: "Requirements",
  //   url: "/requirements",
  //   icon: ListTodo,
  //   siteTitle: "Job Requirements Builder",
  // },
  {
    title: "Applicants",
    url: "/candidates",
    icon: Users,
    siteTitle: "Applicants Management",
  },
  {
    title: "Pre-Interview",
    url: "/interview",
    icon: UserCheck,
    siteTitle: "Pre-Interview Assessment",
  },
  {
    title: "Onboarding",
    url: "/onboarding",
    icon: DoorOpen,
    siteTitle: "Onboarding Candidates",
  },
  {
    title: "Manage Users",
    url: "/manage-users",
    icon: UsersIcon,
    siteTitle: "Manage Users (Admin & Applicants)",
  },
  {
    title: "Bulk Process",
    url: "/bulk-process",
    icon: FileStack,
    siteTitle: "Bulk Process CVs",
  },
    {
    title: "Organization",
    url: "/organization",
    icon: Network,
    siteTitle: "Organization Structure",
  },
]

// Navigation items for the applicant section
const applicantNavMain: NavItem[] = [
  {
    title: "Apply",
    url: "/apply",
    icon: Send,
    siteTitle: "Apply for a Job",
  },
    {
    title: "Multi Apply",
    url: "/multi-apply",
    icon: Files,
    siteTitle: "Apply to Multiple Jobs at Once",
  },
  {
    title: "Verification",
    url: "/verify",
    icon: UserCheck,
    siteTitle: "ID Verification",
  },
  {
    title: "Pre-Interview",
    url: "/pre-interview",
    icon: UserRoundPen,
    siteTitle: "Pre-Interview Call",
  },
  {
    title: "Onboard",
    url: "/onboard",
    icon: DoorOpen,
    siteTitle: "Proceed to Onboarding",
  },
]

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { theme, setTheme, resolvedTheme } = useTheme()
  const pathname = usePathname()
  const { setSiteTitle } = useDashboard()
  const { isAuthenticated, userType } = useAuth()
  const [userData, setUserData] = React.useState<UserData>({
    name: "Loading...",
    email: "Loading...",
    avatar: "/user.png",
  })

  // Debug logging (uncomment for debugging)
  // React.useEffect(() => {
  //   console.log('[AppSidebar] Auth state:', { isAuthenticated, userType });
  // }, [isAuthenticated, userType])

  // Helper function to decode JWT token and extract user info
  const decodeToken = React.useCallback((token: string) => {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]))
      return { userId: payload.userId, email: payload.email, type: payload.type }
    } catch (error) {
      console.error('[AppSidebar] Error decoding token:', error)
      return null
    }
  }, [])

  // Load user data from API
  React.useEffect(() => {
    const loadUserData = async () => {
      // Reset to loading state
      setUserData({
        name: "Loading...",
        email: "Loading...",
        avatar: "/user.png",
      })

      if (!isAuthenticated) {
        // Set default user data when not authenticated
        setUserData({
          name: "Guest",
          email: "",
          avatar: "/user.png",
        })
        return
      }

      try {
        const tokenValue = getCookie('access_token')
        const token = typeof tokenValue === 'string' ? tokenValue : null

        if (!token) {
          setUserData({
            name: "No Token",
            email: "",
            avatar: "/user.png",
          })
          return
        }

        const decoded = decodeToken(token)
        if (!decoded) {
          setUserData({
            name: "Invalid Token",
            email: "",
            avatar: "/user.png",
          })
          return
        }

        // Try to fetch full user details from API
        try {
          const response = await fetch(`/api/users/${decoded.userId}`)
          if (response.ok) {
            const userDetails = await response.json()
            setUserData({
              name: userDetails.full_name || decoded.email.split('@')[0],
              email: userDetails.email || decoded.email,
              avatar: "/user.png",
            })
          } else {
            // API failed, use token data as fallback
            setUserData({
              name: decoded.email.split('@')[0],
              email: decoded.email,
              avatar: "/user.png",
            })
          }
        } catch (apiError) {
          console.error('[AppSidebar] API call failed:', apiError)
          // Use token data as fallback
          setUserData({
            name: decoded.email.split('@')[0],
            email: decoded.email,
            avatar: "/user.png",
          })
        }
      } catch (error) {
        console.error('[AppSidebar] Error loading user data:', error)
        setUserData({
          name: "Error",
          email: "",
          avatar: "/user.png",
        })
      }
    }

    loadUserData()
  }, [isAuthenticated])

  // Determine which nav set should be rendered based on the current pathname.
  const navMain = React.useMemo(() => {
    // Paths that belong to the applicant side always start with one of these prefixes.
    const applicantPrefixes = [
      "/apply",
      "/verify",
      "/onboard",
      "/pre-interview",
      "/multi-apply",
    ] as const

    const isApplicantRoute = applicantPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
    return isApplicantRoute ? applicantNavMain : adminNavMain
  }, [pathname])

  // Update the site title in the layout when the route changes.
  React.useEffect(() => {
    const currentNavItem = [...adminNavMain, ...applicantNavMain].find((item) => pathname.startsWith(item.url))
    if (currentNavItem && currentNavItem.siteTitle) {
      setSiteTitle(currentNavItem.siteTitle)
    } else {
      setSiteTitle(null)
    }
  }, [pathname, setSiteTitle])

  const cycleTheme = () => {
    if (theme === "light") {
      setTheme("dark")
    } else if (theme === "dark") {
      setTheme("system")
    } else {
      setTheme("light")
    }
  }

  const ThemeIcon = resolvedTheme === 'dark' ? MoonIcon : SunIcon;

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:!p-1.5"
            >
              <a href="#" className="px-2">
                {
                  // if the system is light theme, show the black logo, otherwise show the white logo
                  resolvedTheme === 'light' ? <img src="/ic-lamarin-black.png" alt="Lamarin AI Logo" className="h-5 w-5" />
                  : <img src="/ic-lamarin-white.png" alt="Lamarin AI Logo" className="h-5 w-5" />
                }
                
                <div className="flex items-center gap-2">
                  <span className="text-base font-semibold">rAIkrut</span>
                  {userType && (
                    <span className="text-xs font-light text-muted-foreground">
                      ({userType === 'admin' ? 'Admin' : 'Applicant'})
                    </span>
                  )}
                </div>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={navMain} />
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenuItem className="ml-2 list-none">
          <SidebarMenuButton onClick={cycleTheme}>
            {theme === 'system' ? (
              <ComputerIcon className="size-5 mr-1" />
            ) : (
              <ThemeIcon className="size-5 mr-1" />
            )}
            <span >
              Theme: {theme === 'system' ? 'System' : theme === 'dark' ? 'Dark' : 'Light'}
            </span>
          </SidebarMenuButton>
        </SidebarMenuItem>
        <NavUser user={userData} />
      </SidebarFooter>
    </Sidebar>
  )
}
