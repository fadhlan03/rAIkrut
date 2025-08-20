"use client";

import React, { useState, useCallback, useMemo } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { SiteHeader } from '@/components/dashboard/site-header';
import { AppSidebar } from '@/components/dashboard/app-sidebar';
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PlusCircle } from 'lucide-react';
import { Toaster } from '@/components/ui/sonner';
import { DashboardContext, HeaderActionConfig } from '@/contexts/DashboardContext';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [headerActions, setHeaderActions] = useState<HeaderActionConfig[] | null>(null);
  const [siteTitle, setSiteTitle] = useState<string | null>(null);

  // Update site title based on pathname
  React.useEffect(() => {
    if (pathname === '/jobs/new') {
      setSiteTitle('Post New Job');
    } else {
      setSiteTitle(null);
    }
  }, [pathname]);

  const dynamicHeaderActions = useMemo(() => {
    let baseActions: HeaderActionConfig[] = [];

    // Only add the "Post New Job" button if the pathname is exactly '/jobs'
    if (pathname === '/jobs') {
        baseActions.push({
            id: 'post-new-job',
            label: 'Post New Job',
            icon: <PlusCircle />,
            onClick: () => router.push('/jobs/new'),
            variant: 'default',
            size: 'sm',
        });
    }

    // Combine with dynamically registered actions if any
    return headerActions ? [...baseActions, ...headerActions] : baseActions;
  }, [pathname, headerActions, router]);

  const registerActions = useCallback((actions: HeaderActionConfig[] | null) => {
    console.log("Registering dynamic header actions in layout:", actions);
    setHeaderActions(actions); 
  }, []);

  const updateSiteTitle = useCallback((title: string | null) => {
    console.log("Setting site title in layout:", title);
    setSiteTitle(title);
  }, []);

  React.useEffect(() => {
    return () => {
      console.log("DashboardLayout unmounting, clearing dynamic actions and title");
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

      <Dialog >
        <DialogContent className="sm:max-w-[625px] overflow-y-auto max-h-[90vh]">
          <DialogHeader>
            <DialogTitle></DialogTitle>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </DashboardContext.Provider>
  );
} 