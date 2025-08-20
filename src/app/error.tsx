'use client'; // Error components must be Client Components

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error(error);
  }, [error]);

  return (
    <div className="flex h-screen items-center justify-center">
      <Card className="w-[420px]">
        <CardHeader>
          <CardTitle>Oops! Something went wrong.</CardTitle>
          <CardDescription>
            An unexpected error occurred. You can try again.
          </CardDescription>
        </CardHeader>
        {/* Optional: Add CardContent here if you want to display more error details */}
        {/* <CardContent>
          <p className="text-sm text-muted-foreground">
            {error.message || 'No further details available.'}
          </p>
        </CardContent> */}
        <CardFooter>
          <Button onClick={() => reset()}>Try again</Button>
        </CardFooter>
      </Card>
    </div>
  );
} 