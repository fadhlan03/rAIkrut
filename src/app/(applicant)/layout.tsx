"use client";

import React, { useState, useCallback, useMemo } from 'react';
import { usePathname } from 'next/navigation';
import { SiteHeader } from '@/components/dashboard/site-header';
import { AppSidebar } from '@/components/dashboard/app-sidebar';
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Toaster } from '@/components/ui/sonner';
import { DashboardContext, HeaderActionConfig } from '@/contexts/DashboardContext';

export default function ApplicantLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [headerActions, setHeaderActions] = useState<HeaderActionConfig[] | null>(null);
  const [siteTitle, setSiteTitle] = useState<string | null>(null);

  const dynamicHeaderActions = useMemo(() => {
    let baseActions: HeaderActionConfig[] = [];

    // Add any applicant-specific actions based on pathname
    if (pathname === '/verify') {
      // Add verification-specific actions if needed
    }

    // Combine with dynamically registered actions if any
    return headerActions ? [...baseActions, ...headerActions] : baseActions;
  }, [pathname, headerActions]);

  const registerActions = useCallback((actions: HeaderActionConfig[] | null) => {
    console.log("Registering dynamic header actions in applicant layout:", actions);
    setHeaderActions(actions); 
  }, []);

  const updateSiteTitle = useCallback((title: string | null) => {
    console.log("Setting site title in applicant layout:", title);
    setSiteTitle(title);
  }, []);

  // Reset actions and title when the component unmounts
  React.useEffect(() => {
    return () => {
      console.log("ApplicantLayout unmounting, clearing dynamic actions and title");
      setHeaderActions(null);
      setSiteTitle(null);
    };
  }, []);

  return (
    <DashboardContext.Provider value={{ registerHeaderActions: registerActions, setSiteTitle: updateSiteTitle }}>
      <SidebarProvider>
        <AppSidebar variant="inset" />
        <SidebarInset>
          <div className="flex flex-1 flex-col h-screen">
            <SiteHeader actions={dynamicHeaderActions} siteTitle={siteTitle} />
            <main className='flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:py-6 bg-muted/40 overflow-y-auto'>
              {children}
            </main>
          </div>
        </SidebarInset>
      </SidebarProvider>

      <Toaster richColors closeButton position="top-right" />
    </DashboardContext.Provider>
  );
} 