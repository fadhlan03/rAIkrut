'use client';

import React, { useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';
import { ChevronLeft, ChevronRight, Loader2, Download, ZoomIn, ZoomOut } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Configure PDF.js worker
// This is crucial for react-pdf to work correctly.
// The path might need adjustment based on your project structure and how pdfjs-dist is served.
// Often, it's copied to the public folder during build.
if (typeof window !== 'undefined') { // Ensure this runs only in the browser
  pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`;
}

interface SheetResumeViewerProps {
  fileUrl: string | null;
  candidateName?: string;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

export function SheetResumeViewer({
  fileUrl,
  candidateName = 'Resume',
  isOpen,
  onOpenChange,
}: SheetResumeViewerProps) {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.0);
  const [isLoadingPdf, setIsLoadingPdf] = useState<boolean>(true);
  const [pdfError, setPdfError] = useState<string | null>(null);

  function onDocumentLoadSuccess({ numPages: nextNumPages }: { numPages: number }) {
    setNumPages(nextNumPages);
    setPageNumber(1); // Reset to first page on new document load
    setScale(1.0);    // Reset zoom
    setIsLoadingPdf(false);
    setPdfError(null);
  }

  function onDocumentLoadError(error: Error) {
    console.error('Error loading PDF document:', error);
    setPdfError('Failed to load resume. Please try again or check the file.');
    setIsLoadingPdf(false);
  }

  const goToPreviousPage = () => setPageNumber(prevPageNumber => Math.max(1, prevPageNumber - 1));
  const goToNextPage = () => setPageNumber(prevPageNumber => Math.min(numPages || 1, prevPageNumber + 1));

  const zoomIn = () => setScale(prevScale => Math.min(3, prevScale + 0.2));
  const zoomOut = () => setScale(prevScale => Math.max(0.5, prevScale - 0.2));
  
  // Reset state when sheet is closed or fileUrl changes
  React.useEffect(() => {
    if (!isOpen) {
      setIsLoadingPdf(true);
      setPdfError(null);
      setNumPages(null);
      setPageNumber(1);
      setScale(1.0);
    }
  }, [isOpen]);

  React.useEffect(() => {
    console.log('[SheetResumeViewer] fileUrl changed:', fileUrl);
    if (fileUrl) {
      setIsLoadingPdf(true);
      setPdfError(null);
      setPageNumber(1);
    } else {
      setIsLoadingPdf(false);
      setPdfError(null);
      setNumPages(null);
    }
  }, [fileUrl]);

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent className="w-[95vw] sm:max-w-3xl p-0 flex flex-col" side="right">
        <SheetHeader className="p-4 border-b sticky top-0 bg-background z-10">
          <SheetTitle>{candidateName}</SheetTitle>
          {fileUrl && !isLoadingPdf && !pdfError && numPages && (
            <SheetDescription className="flex items-center justify-between text-xs text-muted-foreground pt-1">
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={zoomOut} disabled={scale <= 0.5}>
                  <ZoomOut className="size-4" />
                </Button>
                <Button variant="outline" onClick={zoomIn} disabled={scale >= 3}>
                  <ZoomIn className="size-4" />
                </Button>
                <span className='px-2'>{Math.round(scale * 100)}%</span>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={goToPreviousPage} disabled={pageNumber <= 1}>
                  <ChevronLeft className="size-4" />
                </Button>
                <span>
                  Page {pageNumber} of {numPages}
                </span>
                <Button variant="outline" onClick={goToNextPage} disabled={pageNumber >= numPages}>
                  <ChevronRight className="size-4" />
                </Button>
              </div>
              <Button variant="outline" size="sm" asChild>
                <a href={fileUrl} download={`${candidateName.replace(/ /g, '_')}_Resume.pdf`}>
                  <Download className="size-4 mr-2" /> Download
                </a>
              </Button>
            </SheetDescription>
          )}
        </SheetHeader>

        <ScrollArea className="flex-grow min-h-0 bg-muted/30">
          <div className="p-4 flex justify-center items-start">
            {isLoadingPdf && fileUrl && (
              <div className="flex flex-col items-center justify-center h-full py-10">
                <Loader2 className="size-8 animate-spin text-primary" />
                <p className="mt-2 text-muted-foreground">Loading resume...</p>
              </div>
            )}
            {pdfError && (
              <div className="flex flex-col items-center justify-center h-full py-10 text-destructive">
                <p>{pdfError}</p>
              </div>
            )}
            {!isLoadingPdf && fileUrl && !pdfError && (
              <Document
                file={fileUrl}
                onLoadSuccess={onDocumentLoadSuccess}
                onLoadError={onDocumentLoadError}
                loading={null} // We handle loading state outside
                error={null}   // We handle error state outside
                className="shadow-lg"
              >
                <Page pageNumber={pageNumber} scale={scale} renderTextLayer={true} renderAnnotationLayer={true} />
              </Document>
            )}
            {!fileUrl && !isLoadingPdf && (
                 <div className="flex flex-col items-center justify-center h-full py-10">
                    <p className="text-muted-foreground">No resume to display.</p>
                </div>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
} 