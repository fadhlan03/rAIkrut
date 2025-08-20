"use client";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetClose
} from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Building2, Search, TrendingUp, X, ZoomIn, ZoomOut, Maximize } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import mermaid from "mermaid";

interface CompanyStructure {
  company: string;
  industry: string;
  structure: {
    name: string;
    level: number;
    parent?: string;
  }[];
}

interface BenchmarkData {
  inferredIndustry: string;
  companies: CompanyStructure[];
  groundingMetadata?: {
    webSearchQueries: string[];
    groundingChunks: {
      web: {
        uri: string;
        title: string;
      }
    }[];
    groundingSupports: any[];
  };
}

interface SheetBenchmarkStructuresProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  currentStructure?: any; // The current org chart data
}

export function SheetBenchmarkStructures({
  isOpen,
  onOpenChange,
  currentStructure
}: SheetBenchmarkStructuresProps) {
  const [industry, setIndustry] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false);
  const [benchmarkData, setBenchmarkData] = React.useState<BenchmarkData | null>(null);
  const [activeTab, setActiveTab] = React.useState<string>("input");
  const [fullscreenChart, setFullscreenChart] = React.useState<{ mermaidCode: string; companyName: string } | null>(null);
  const [zoomLevel, setZoomLevel] = React.useState(1);
  const [panOffset, setPanOffset] = React.useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = React.useState(false);
  const [dragStart, setDragStart] = React.useState({ x: 0, y: 0 });
  const [lastTouchDistance, setLastTouchDistance] = React.useState<number | null>(null);
  const fullscreenChartRef = React.useRef<HTMLDivElement>(null);

  // Initialize Mermaid
  React.useEffect(() => {
    mermaid.initialize({
      startOnLoad: true,
      theme: 'default',
      securityLevel: 'loose',
      flowchart: {
        useMaxWidth: true,
        htmlLabels: true,
        curve: 'linear',
        padding: 20,
        nodeSpacing: 50,
        rankSpacing: 80,
        diagramPadding: 20
      }
    });
  }, []);

  const handleSearch = async () => {
    if (!industry.trim()) {
      toast.error("Please enter an industry");
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/benchmark-structures', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          industry: industry.trim(),
          currentStructure,
          temperature: 0.3
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to fetch benchmark data');
      }

      const result = await response.json();
      if (result.success) {
        setBenchmarkData(result.data);
        setActiveTab("results");
        toast.success("Benchmark structures loaded successfully!");
      } else {
        throw new Error(result.error || 'Failed to fetch benchmark data');
      }
    } catch (error) {
      console.error('Error fetching benchmark data:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to fetch benchmark data');
    } finally {
      setIsLoading(false);
    }
  };

  // Move hooks to component level to avoid conditional hook calls
  const chartRefs = React.useRef<Record<string, HTMLDivElement | null>>({});
  const chartIds = React.useRef<Record<string, string>>({});
  const fullscreenChartId = React.useRef<string>("");

  // Reset zoom and pan when opening fullscreen
  const resetZoomAndPan = () => {
    setZoomLevel(1);
    setPanOffset({ x: 0, y: 0 });
  };

  // Handle zoom with mouse wheel
  const handleWheel = React.useCallback((e: WheelEvent) => {
    if (!fullscreenChart) return;
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setZoomLevel(prev => Math.max(0.1, Math.min(3, prev + delta)));
  }, [fullscreenChart]);

  // Handle mouse down for dragging
  const handleMouseDown = React.useCallback((e: React.MouseEvent) => {
    if (!fullscreenChart) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
  }, [fullscreenChart, panOffset]);

  // Handle mouse move for dragging
  const handleMouseMove = React.useCallback((e: MouseEvent) => {
    if (!isDragging || !fullscreenChart) return;
    setPanOffset({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  }, [isDragging, fullscreenChart, dragStart]);

  // Handle mouse up to stop dragging
  const handleMouseUp = React.useCallback(() => {
    setIsDragging(false);
  }, []);

  // Calculate distance between two touch points
  const getTouchDistance = (touches: React.TouchList) => {
    if (touches.length < 2) return null;
    const touch1 = touches[0];
    const touch2 = touches[1];
    return Math.sqrt(
      Math.pow(touch2.clientX - touch1.clientX, 2) +
      Math.pow(touch2.clientY - touch1.clientY, 2)
    );
  };

  // Handle touch start for mobile
  const handleTouchStart = React.useCallback((e: React.TouchEvent) => {
    if (!fullscreenChart) return;

    if (e.touches.length === 1) {
      // Single touch - start dragging
      setIsDragging(true);
      setDragStart({
        x: e.touches[0].clientX - panOffset.x,
        y: e.touches[0].clientY - panOffset.y
      });
    } else if (e.touches.length === 2) {
      // Two touches - start pinch zoom
      setIsDragging(false);
      const distance = getTouchDistance(e.touches);
      setLastTouchDistance(distance);
    }
  }, [fullscreenChart, panOffset]);

  // Handle touch move for mobile
  const handleTouchMove = React.useCallback((e: React.TouchEvent) => {
    if (!fullscreenChart) return;
    e.preventDefault();

    if (e.touches.length === 1 && isDragging) {
      // Single touch - pan
      setPanOffset({
        x: e.touches[0].clientX - dragStart.x,
        y: e.touches[0].clientY - dragStart.y
      });
    } else if (e.touches.length === 2 && lastTouchDistance) {
      // Two touches - pinch zoom
      const currentDistance = getTouchDistance(e.touches);
      if (currentDistance) {
        const scale = currentDistance / lastTouchDistance;
        setZoomLevel(prev => Math.max(0.1, Math.min(3, prev * scale)));
        setLastTouchDistance(currentDistance);
      }
    }
  }, [fullscreenChart, isDragging, dragStart, lastTouchDistance]);

  // Handle touch end for mobile
  const handleTouchEnd = React.useCallback(() => {
    setIsDragging(false);
    setLastTouchDistance(null);
  }, []);

  // Add event listeners for fullscreen interactions
  React.useEffect(() => {
    if (fullscreenChart) {
      document.addEventListener('wheel', handleWheel, { passive: false });
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
      return () => {
        document.removeEventListener('wheel', handleWheel);
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.removeEventListener('touchmove', (e) => e.preventDefault());
      };
    }
  }, [fullscreenChart, handleWheel, handleMouseMove, handleMouseUp]);

  // Render fullscreen chart
  const renderFullscreenChart = React.useCallback(async () => {
    if (!fullscreenChart || !fullscreenChartRef.current) return;

    try {
      if (!fullscreenChartId.current) {
        fullscreenChartId.current = `mermaid-fullscreen-${Math.random().toString(36).substr(2, 9)}`;
      }

      fullscreenChartRef.current.innerHTML = '';
      const { svg } = await mermaid.render(fullscreenChartId.current, fullscreenChart.mermaidCode);
      fullscreenChartRef.current.innerHTML = svg;
      
      // Force SVG to scale to fill container height
      const svgElement = fullscreenChartRef.current.querySelector('svg');
      if (svgElement) {
        svgElement.style.width = '100%';
        svgElement.style.height = '100%';
        svgElement.style.maxWidth = 'none';
        svgElement.style.maxHeight = 'none';
        svgElement.removeAttribute('width');
        svgElement.removeAttribute('height');
      }
    } catch (error) {
      console.error('Error rendering fullscreen Mermaid chart:', error);
      if (fullscreenChartRef.current) {
        fullscreenChartRef.current.innerHTML = `
          <div class="text-red-500 text-sm p-4">
            <p>Error rendering chart for ${fullscreenChart.companyName}</p>
          </div>
        `;
      }
    }
  }, [fullscreenChart]);

  // Render fullscreen chart when it changes
  React.useEffect(() => {
    if (fullscreenChart) {
      setTimeout(renderFullscreenChart, 100);
    }
  }, [fullscreenChart, renderFullscreenChart]);

  const renderMermaidChart = React.useCallback((mermaidCode: string, companyName: string) => {
    // Generate unique ID for this chart if not exists
    if (!chartIds.current[companyName]) {
      chartIds.current[companyName] = `mermaid-${Math.random().toString(36).substr(2, 9)}`;
    }
    const chartId = chartIds.current[companyName];

    // Render chart when element is available
    const renderChart = async () => {
      const chartElement = chartRefs.current[companyName];
      if (chartElement && mermaidCode) {
        try {
          chartElement.innerHTML = '';
          const { svg } = await mermaid.render(chartId, mermaidCode);
          chartElement.innerHTML = svg;
          
          // Force SVG to scale to fill container height
          const svgElement = chartElement.querySelector('svg');
          if (svgElement) {
            svgElement.style.width = '100%';
            svgElement.style.height = '100%';
            svgElement.style.maxWidth = 'none';
            svgElement.style.maxHeight = 'none';
            svgElement.removeAttribute('width');
            svgElement.removeAttribute('height');
          }
        } catch (error) {
          console.error('Error rendering Mermaid chart:', error);
          chartElement.innerHTML = `
            <div class="text-red-500 text-sm p-4">
              <p>Error rendering chart for ${companyName}</p>
              <details class="mt-2">
                <summary class="cursor-pointer">Show Mermaid Code</summary>
                <pre class="mt-2 text-xs bg-gray-100 p-2 rounded overflow-x-auto">${mermaidCode}</pre>
              </details>
            </div>
          `;
        }
      }
    };

    // Delay rendering to ensure element is mounted
    setTimeout(renderChart, 100);

    return (
      <div className="border rounded-lg p-4 bg-muted/30">
        {/* <div className="text-xs font-mono text-muted-foreground mb-4">
          Organization Chart for {companyName}
        </div> */}
        <div
          ref={(el) => { chartRefs.current[companyName] = el; }}
          className="mermaid-chart overflow-x-auto bg-white rounded border p-4 cursor-pointer hover:bg-gray-50 transition-colors"
          style={{
            height: 'auto',
            overflowY: 'visible',
            overflowX: 'auto'
          }}
          onClick={() => {
            setFullscreenChart({ mermaidCode, companyName });
            resetZoomAndPan();
          }}
          title="Click to view in fullscreen"
        />
      </div>
    );
  }, []);

  // Convert current structure to mermaid chart
  const generateCurrentStructureMermaid = React.useCallback(() => {
    if (!currentStructure) return '';

    const generateMermaidFromNode = (node: any, nodeId: string = 'root'): string => {
      let mermaidCode = '';
      const sanitizedId = nodeId.replace(/[^a-zA-Z0-9_]/g, '_');

      // Create node definition with proper escaping
      const nodeName = (node.name || 'Organization').replace(/"/g, '&quot;');
      // const description = node.description ? `<br/>${node.description.replace(/"/g, '&quot;')}` : '';
      const jobCount = node.jobCount ? `<br/>${node.jobCount} roles` : '';

      mermaidCode += `    ${sanitizedId}["${nodeName}${jobCount}"]\n`;

      // Process children
      if (node.children && node.children.length > 0) {
        node.children.forEach((child: any, index: number) => {
          const childId = `${sanitizedId}_child_${index}`;
          mermaidCode += generateMermaidFromNode(child, childId);
          mermaidCode += `    ${sanitizedId} --> ${childId}\n`;
        });
      }

      return mermaidCode;
    };

    const mermaidCode = `flowchart TD\n${generateMermaidFromNode(currentStructure)}`;
    return mermaidCode;
  }, [currentStructure]);

  // Generate Mermaid chart from company structure data (simplified)
  const generateCompanyMermaid = React.useCallback((structure: CompanyStructure['structure']) => {
    if (!structure || structure.length === 0) return '';

    let mermaidCode = 'flowchart TD\n';
    const nodeMap = new Map<string, string>();

    // Create sanitized node IDs
    structure.forEach((dept, index) => {
      const sanitizedId = dept.name.replace(/[^a-zA-Z0-9_]/g, '_') + '_' + index;
      nodeMap.set(dept.name, sanitizedId);
    });

    // Generate node definitions (simplified - department names only)
    structure.forEach((dept) => {
      const nodeId = nodeMap.get(dept.name)!;
      const nodeName = dept.name.replace(/"/g, '&quot;');
      
      mermaidCode += `    ${nodeId}["${nodeName}"]\n`;
    });

    // Generate connections based on parent-child relationships
    structure.forEach((dept) => {
      if (dept.parent && nodeMap.has(dept.parent)) {
        const parentId = nodeMap.get(dept.parent)!;
        const childId = nodeMap.get(dept.name)!;
        mermaidCode += `    ${parentId} --> ${childId}\n`;
      }
    });

    return mermaidCode;
  }, []);

  // Effect to re-render current structure chart when sheet opens
  React.useEffect(() => {
    if (isOpen && currentStructure) {
      // Delay to ensure the sheet is fully rendered and visible
      const timer = setTimeout(() => {
        const mermaidCode = generateCurrentStructureMermaid();
        if (mermaidCode && chartRefs.current['Current Structure']) {
          const renderChart = async () => {
            const chartElement = chartRefs.current['Current Structure'];
            if (chartElement) {
              try {
                chartElement.innerHTML = '';
                const chartId = `mermaid-current-${Math.random().toString(36).substr(2, 9)}`;
                const { svg } = await mermaid.render(chartId, mermaidCode);
                chartElement.innerHTML = svg;
                
                // Force SVG to scale to fill container height
                const svgElement = chartElement.querySelector('svg');
                if (svgElement) {
                  svgElement.style.width = '100%';
                  svgElement.style.height = '100%';
                  svgElement.style.maxWidth = 'none';
                  svgElement.style.maxHeight = 'none';
                  svgElement.removeAttribute('width');
                  svgElement.removeAttribute('height');
                }
              } catch (error) {
                console.error('Error rendering current structure chart:', error);
                chartElement.innerHTML = `
                  <div class="text-red-500 text-sm p-4">
                    <p>Error rendering current structure chart</p>
                  </div>
                `;
              }
            }
          };
          renderChart();
        }
      }, 200); // Increased delay to ensure sheet is fully visible

      return () => clearTimeout(timer);
    }
  }, [isOpen, currentStructure, generateCurrentStructureMermaid]);

  // Render current structure mermaid chart
  const renderCurrentStructureMermaid = React.useCallback(() => {
    const mermaidCode = generateCurrentStructureMermaid();
    if (!mermaidCode) {
      return (
        <div className="p-3 border rounded-lg bg-muted/30">
          <div className="text-sm text-muted-foreground">No structure data available</div>
        </div>
      );
    }

    return renderMermaidChart(mermaidCode, 'Current Structure');
  }, [generateCurrentStructureMermaid, renderMermaidChart]);

  const renderStructureList = (structure: CompanyStructure['structure']) => {
    const groupedByLevel = structure.reduce((acc, item) => {
      if (!acc[item.level]) acc[item.level] = [];
      acc[item.level].push(item);
      return acc;
    }, {} as Record<number, typeof structure>);

    return (
      <div className="space-y-3">
        {Object.entries(groupedByLevel)
          .sort(([a], [b]) => parseInt(a) - parseInt(b))
          .map(([level, items]) => (
            <div key={level} className="space-y-2">
              <div className="text-sm font-medium text-muted-foreground">
                Level {level}
              </div>
              <div className="grid gap-2">
                {items.map((item, index) => (
                  <div key={index} className="border rounded-lg p-3 bg-card">
                    <div className="font-medium text-sm">{item.name}</div>
                    {item.parent && (
                      <div className="text-xs text-muted-foreground mt-1">
                        Reports to: {item.parent}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
      </div>
    );
  };

  return (
    <>
      <Sheet open={isOpen} onOpenChange={onOpenChange}>
        <SheetContent
          className="p-0 flex flex-col max-w-full sm:max-w-4xl w-full h-svh"
          side="right"
          style={{
            isolation: 'isolate',
            zIndex: 100
          }}
        >
          <SheetHeader className="p-6 pb-4 border-b shrink-0">
            <div className="flex items-start justify-between">
              <div className="flex-1 pr-8">
                <SheetTitle className="text-xl font-semibold tracking-tight flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Benchmark Organization Structures
                </SheetTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Compare your organization structure with industry leaders
                </p>
              </div>
            </div>
          </SheetHeader>

          <div className="px-6 pt-4 pb-0">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="w-full grid grid-cols-2">
                <TabsTrigger value="input">Search</TabsTrigger>
                <TabsTrigger value="results" disabled={!benchmarkData}>
                  Results {benchmarkData && `(${benchmarkData.companies.length})`}
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <ScrollArea className="flex-1 overflow-auto">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsContent value="input" className="mt-0">
                <div className="px-6 pt-4 pb-6 space-y-6">
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="industry" className="text-sm font-medium">
                        Industry
                      </Label>
                      <div className="mt-1.5">
                        <Input
                          id="industry"
                          placeholder="e.g., Technology, Healthcare, Finance, Manufacturing"
                          value={industry}
                          onChange={(e) => setIndustry(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !isLoading) {
                              handleSearch();
                            }
                          }}
                        />
                      </div>
                    </div>

                    <Button
                      onClick={handleSearch}
                      disabled={isLoading || !industry.trim()}
                      className="w-full"
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Analyzing Industry Structures...
                        </>
                      ) : (
                        <>
                          <Search className="h-4 w-4" />
                          Find Benchmark Structures
                        </>
                      )}
                    </Button>

                    {currentStructure && (
                      <div>
                        <Label className="text-sm font-medium">Current Structure Preview</Label>
                        <div className="mt-1.5">
                          {renderCurrentStructureMermaid()}
                        </div>
                      </div>
                    )}

                  </div>
                </div>
              </TabsContent>

              <TabsContent value="results" className="mt-0">
                <div className="px-6 pt-4 pb-6">
                  {benchmarkData && (
                    <div className="space-y-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-lg font-semibold">Industry: {benchmarkData.inferredIndustry}</h3>
                          {/* <p className="text-sm text-muted-foreground">
                            {benchmarkData.companies.length} company structures found
                          </p> */}
                        </div>
                        <Badge variant="outline">
                          {benchmarkData.companies.length} Companies
                        </Badge>
                      </div>

                      <div className="space-y-6">
                        {benchmarkData.companies.map((company, index) => (
                          <Card key={index} className="border-l-4 border-l-primary">
                            <CardHeader>
                              <CardTitle className="flex items-center text-lg">
                                <Building2 className="h-5 w-5 mr-2" />
                                {company.company}
                              </CardTitle>
                              {/* <Badge variant="secondary" className="w-fit">
                              {company.industry}
                            </Badge> */}
                            </CardHeader>
                            <CardContent className="space-y-4">
                              {/* <div>
                              <h4 className="text-sm font-medium mb-3">Organization Structure</h4>
                              {renderStructureList(company.structure)}
                            </div> */}

                              <div>
                                {/* <h4 className="text-sm font-medium mb-3">Mermaid Visualization</h4> */}
                                {renderMermaidChart(generateCompanyMermaid(company.structure), company.company)}
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>

                      {/* Citation References */}
                      <div id="references" className="mt-6 pt-4 border-t border-border">
                        <h4 className="text-sm font-semibold mb-2">References</h4>
                        <div className="text-xs text-muted-foreground space-y-1">
                          {benchmarkData?.groundingMetadata?.groundingChunks && benchmarkData.groundingMetadata.groundingChunks.length > 0 ? (
                            benchmarkData.groundingMetadata.groundingChunks.map((chunk, index) => (
                              <div key={index} className="flex items-start gap-2 mb-1">
                                <span className="font-medium">[{index + 1}]</span>
                                <a 
                                  href={chunk.web.uri} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="hover:underline text-primary break-words"
                                >
                                  {chunk.web.title}
                                </a>
                              </div>
                            ))
                          ) : (
                            <div>
                              <div className="text-xs text-orange-600 mb-2 italic">
                                No direct web sources available. Showing search queries used:
                              </div>
                              {benchmarkData?.groundingMetadata?.webSearchQueries && benchmarkData.groundingMetadata.webSearchQueries.length > 0 ? (
                                benchmarkData.groundingMetadata.webSearchQueries.map((query, index) => (
                                  <div key={`ref-${index}`} className="flex items-start gap-2">
                                    <span className="font-medium text-muted-foreground">[{index + 1}]</span>
                                    <a 
                                      href={`https://www.google.com/search?q=${encodeURIComponent(query)}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="hover:underline text-primary break-words"
                                    >
                                      Search: "{query}"
                                    </a>
                                  </div>
                                ))
                              ) : (
                                <div className="flex items-start gap-2 mb-2">
                                  <span className="font-medium text-muted-foreground">[1]</span>
                                  <span className="text-muted-foreground">No references available</span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </ScrollArea>
        </SheetContent>
      </Sheet>

      {/* Fullscreen Chart Modal */}
      <Dialog open={!!fullscreenChart} onOpenChange={(open) => !open && setFullscreenChart(null)}>
        <DialogContent
          className="!w-screen !h-screen !max-w-none !max-h-none !p-0 !overflow-hidden !fixed !inset-0 !translate-x-0 !translate-y-0 !rounded-none !border-0 !left-0 !top-0 !transform-none"
          style={{ zIndex: 9999, width: '100vw', height: '100vh', left: 0, top: 0, transform: 'none' }}
        >
          <DialogHeader className="p-4 pb-2 border-b shrink-0 bg-white relative z-10">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-lg font-semibold">
                {fullscreenChart?.companyName} - Organization Chart
              </DialogTitle>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setZoomLevel(prev => Math.max(0.1, prev - 0.2))}
                  disabled={zoomLevel <= 0.1}
                >
                  <ZoomOut className="h-4 w-4" />
                </Button>
                <span className="text-sm font-mono min-w-[60px] text-center">
                  {Math.round(zoomLevel * 100)}%
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setZoomLevel(prev => Math.min(3, prev + 0.2))}
                  disabled={zoomLevel >= 3}
                >
                  <ZoomIn className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={resetZoomAndPan}
                >
                  <Maximize className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setFullscreenChart(null)}
                  className="ml-2"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-hidden relative bg-white" style={{ height: 'calc(100vh - 80px)' }}>
            <div
              className="w-full h-full overflow-hidden cursor-grab active:cursor-grabbing touch-none flex items-center justify-center"
              onMouseDown={handleMouseDown}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              style={{
                transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoomLevel})`,
                transformOrigin: 'center center',
                transition: isDragging ? 'none' : 'transform 0.1s ease-out'
              }}
            >
              <div
                ref={fullscreenChartRef}
                className="mermaid-chart min-w-full min-h-full flex items-center justify-center bg-white rounded border p-4"
                style={{ width: 'max-content', height: 'max-content' }}
              />
            </div>

            {/* Instructions overlay */}
            {/* <div className="absolute bottom-4 left-4 bg-black/70 text-white text-xs px-3 py-2 rounded-lg z-10">
            <div>• Mouse wheel / Pinch: Zoom in/out</div>
            <div>• Click & drag / Touch & drag: Pan around</div>
            <div>• Use controls above to reset</div>
          </div> */}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}