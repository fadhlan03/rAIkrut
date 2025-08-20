"use client"

import { usePathname } from "next/navigation"
import * as React from 'react'
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { HeaderActionConfig } from "@/contexts/DashboardContext";
import { Button } from "@/components/ui/button";

function getTitleFromPathname(pathname: string): string {
  if (pathname === "/") return "Customers"
  if (pathname === "/onboard") return "Onboarding - Senior Software Engineer"
  const segments = pathname.split("/").filter(Boolean)
  const baseTitle = segments[segments.length - 1]
    .replace(/-/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase())
  return baseTitle
}

interface SiteHeaderProps {
    actions: HeaderActionConfig[] | null;
    siteTitle?: string | null;
}

export function SiteHeader({ actions, siteTitle }: SiteHeaderProps) {
  const pathname = usePathname()
  const title = siteTitle || getTitleFromPathname(pathname)

  return (
    <header className="group-has-data-[collapsible=icon]/sidebar-wrapper:h-12 flex h-12 shrink-0 items-center justify-between gap-2 border-b transition-[width,height] ease-linear px-4 lg:px-6 relative z-10 bg-background">
      <div className="flex items-center gap-1 lg:gap-2">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mx-2 data-[orientation=vertical]:h-4"
        />
        <h1 className="text-base font-medium">
          {title}
        </h1>
      </div>

      <div className="flex items-center gap-2">
         {actions && actions.map(action => (
            <Button
                key={action.id}
                size={action.size || "sm"}
                variant={action.variant}
                onClick={action.onClick}
            >
                {action.icon && React.isValidElement<{ className?: string }>(action.icon) && React.cloneElement(action.icon, { className: `${action.icon.props.className || ''} size-4 mr-1`.trim() })}
                {action.label}
            </Button>
         ))}
      </div>
    </header>
  )
}
