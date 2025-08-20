import { LoaderCircle } from 'lucide-react';

export default function Loading() {
  return (
    <div className="flex justify-center items-center min-h-screen">
      <LoaderCircle className="animate-spin h-16 w-16" />
    </div>
  );
} 