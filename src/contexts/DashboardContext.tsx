"use client";

import React, { createContext, useContext } from 'react';

// --- Define HeaderActionConfig type here ---
export interface HeaderActionConfig {
  id: string; // Unique key for React list rendering
  label: string;
  icon?: React.ReactElement; // Optional icon component
  onClick: () => void;
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link"; // Optional button variant
  size?: "default" | "sm" | "lg" | "icon"; // Optional button size
}

// --- Dashboard Context ---
interface DashboardContextType {
  registerHeaderActions: (actions: HeaderActionConfig[] | null) => void;
  setSiteTitle: (title: string | null) => void;
}

const DashboardContext = createContext<DashboardContextType | undefined>(undefined);

export function useDashboard() {
  const context = useContext(DashboardContext);
  if (context === undefined) {
    throw new Error('useDashboard must be used within a DashboardProvider defined in layout.tsx');
  }
  return context;
}

export { DashboardContext }; 