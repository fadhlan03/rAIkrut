'use client'

import { LoginForm } from "@/components/auth/login-form"
import { useTheme } from "next-themes";

export default function LoginPage() {
  const { resolvedTheme } = useTheme();

  console.log("Current theme:", resolvedTheme);
  return (
     <>
      {resolvedTheme === 'light' ? (
        <div className="flex min-h-svh flex-col items-center justify-center bg-lamarin-light">
          <div className="w-full max-w-sm md:max-w-3xl">
            <LoginForm />
          </div>
        </div>
      ) : (
        <div className="flex min-h-svh flex-col items-center justify-center bg-lamarin-dark">
          <div className="w-full max-w-sm md:max-w-3xl">
            <LoginForm />
          </div>
        </div>
      )}
    </>
  )
}
