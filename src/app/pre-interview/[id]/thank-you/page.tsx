import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import Link from "next/link";

export default function ThankYouPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-8">
      <div className="max-w-4xl w-full text-center space-y-12">
        <div className="space-y-8">
          <h1 className="text-6xl md:text-7xl font-bold text-gray-900 mb-6">
            Thank You!
          </h1>
          
          <div className="space-y-6">
            <p className="text-xl md:text-2xl text-gray-700 leading-relaxed max-w-3xl mx-auto">
              Your interview has been successfully recorded. We will review your responses and notify you about the next steps soon.
            </p>
            
          </div>
        </div>
        
        <div className="pt-8">
          <Link href="/apply">
            <Button size="lg" className="px-12 py-4 text-lg">
              Back to Applications
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
