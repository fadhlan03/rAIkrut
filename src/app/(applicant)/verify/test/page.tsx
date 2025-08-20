'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Shield, 
  Eye, 
  Video, 
  Mic, 
  User, 
  CheckCircle, 
  AlertCircle, 
  Loader2, 
  Play, 
  RefreshCw,
  FileVideo,
  FileImage,
  Volume2,
  Brain,
  Zap,
  Activity,
  Camera,
  Upload,
  Square,
  RotateCcw
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useDashboard } from '@/contexts/DashboardContext';
import { fetchWithAuth } from '@/lib/fetchWithAuth';

interface AnalysisStep {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  score?: number;
  details?: string;
}

interface VerificationResult {
  id: string;
  videoUrl: string;
  photoUrl: string;
  audioUrl: string;
  deepfakeScore?: number;
  faceVerificationScore?: number;
  voiceVerificationScore?: number;
  overallStatus: 'pending' | 'processing' | 'verified' | 'rejected' | 'failed';
  metadata?: any;
  createdAt: string;
  testVideoUrl?: string;
  testPhotoUrl?: string;
  testAudioUrl?: string;
  originalVideoUrl?: string;
  originalPhotoUrl?: string;
  originalAudioUrl?: string;
}

interface MediaFiles {
  video: Blob | null;
  photo: Blob | null;
  audio: Blob | null;
}

// Indonesian text for test recording
const TEST_RECORDING_SCRIPT = `
Halo, ini adalah tes verifikasi identitas saya. 
Nama saya adalah [sebutkan nama lengkap Anda].
Saya sedang melakukan verifikasi untuk memastikan identitas saya autentik.
Ini adalah rekaman kedua untuk proses verifikasi.
Terima kasih.
`;

// Audio conversion utility (copied from verify page)
const audioBufferToWav = async (audioBuffer: AudioBuffer): Promise<Blob> => {
  const length = audioBuffer.length;
  const sampleRate = audioBuffer.sampleRate;
  const buffer = new ArrayBuffer(44 + length * 2);
  const view = new DataView(buffer);
  
  // WAV header
  const writeString = (offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };
  
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + length * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, length * 2, true);
  
  // Audio data
  const channelData = audioBuffer.getChannelData(0);
  let offset = 44;
  for (let i = 0; i < length; i++) {
    const sample = Math.max(-1, Math.min(1, channelData[i]));
    view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
    offset += 2;
  }
  
  return new Blob([buffer], { type: 'audio/wav' });
};

export default function VerificationTestPage() {
  const { setSiteTitle } = useDashboard();
  const { isAuthenticated } = useAuth();
  
  // States
  const [verificationData, setVerificationData] = useState<VerificationResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [currentAnalysisStep, setCurrentAnalysisStep] = useState<string | null>(null);
  
  // Media URL states for presigned URLs
  const [mediaUrls, setMediaUrls] = useState<{
    videoUrl?: string;
    photoUrl?: string;
    audioUrl?: string;
    testVideoUrl?: string;
    testPhotoUrl?: string;
    testAudioUrl?: string;
  }>({});
  
  // Test media upload states
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [testMediaFiles, setTestMediaFiles] = useState<MediaFiles>({
    video: null,
    photo: null,
    audio: null
  });
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [testMediaSubmitted, setTestMediaSubmitted] = useState(false);
  
  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  
  const [analysisSteps, setAnalysisSteps] = useState<AnalysisStep[]>([
    {
      id: 'video-deepfake',
      title: 'Video Deepfake Detection',
      description: 'Analyzing video for deepfake artifacts and manipulation',
      icon: <Video className="h-5 w-5" />,
      status: 'pending'
    },
    {
      id: 'face-verification',
      title: 'Face Verification',
      description: 'Verifying facial features and authenticity',
      icon: <User className="h-5 w-5" />,
      status: 'pending'
    },
    {
      id: 'voice-verification',
      title: 'Voice Identity Verification',
      description: 'Analyzing voice patterns and authenticity',
      icon: <Mic className="h-5 w-5" />,
      status: 'pending'
    }
  ]);

  useEffect(() => {
    setSiteTitle('Verification Test');
    return () => setSiteTitle(null);
  }, [setSiteTitle]);

  // Initialize camera for test media
  const initializeCamera = useCallback(async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user'
        },
        audio: true
      });
      
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      toast.success('Camera initialized for test recording');
    } catch (error) {
      console.error('Error accessing camera:', error);
      toast.error('Failed to access camera for test recording');
    }
  }, []);

  // Start test recording
  const startTestRecording = useCallback(() => {
    if (!stream) {
      toast.error('Camera not initialized');
      return;
    }

    try {
      const recorder = new MediaRecorder(stream, {
        mimeType: 'video/webm;codecs=vp8,opus'
      });
      
      const chunks: Blob[] = [];
      
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };
      
      recorder.onstop = () => {
        const videoBlob = new Blob(chunks, { type: 'video/webm' });
        setTestMediaFiles(prev => ({ ...prev, video: videoBlob }));
        extractTestMediaFromVideo(videoBlob);
      };
      
      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
      setRecordingTime(0);
      
      // Timer for 15 seconds
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => {
          if (prev >= 14) {
            stopTestRecording();
            return 15;
          }
          return prev + 1;
        });
      }, 1000);
      
      toast.success('Test recording started');
    } catch (error) {
      console.error('Error starting test recording:', error);
      toast.error('Failed to start test recording');
    }
  }, [stream]);

  // Stop test recording
  const stopTestRecording = useCallback(() => {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop();
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      toast.success('Test recording completed');
    }
  }, [mediaRecorder, isRecording]);

  // Extract photo and audio from test video
  const extractTestMediaFromVideo = useCallback(async (videoBlob: Blob) => {
    try {
      // Extract photo (frame at 5 seconds)
      const video = document.createElement('video');
      video.src = URL.createObjectURL(videoBlob);
      
      await new Promise((resolve) => {
        video.onloadedmetadata = () => {
          video.currentTime = 5; // Extract frame at 5 seconds
          video.onseeked = resolve;
        };
      });
      
      // Capture frame to canvas
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          ctx.drawImage(video, 0, 0);
          
          canvas.toBlob((photoBlob) => {
            if (photoBlob) {
              setTestMediaFiles(prev => ({ ...prev, photo: photoBlob }));
            }
          }, 'image/jpeg', 0.8);
        }
      }
      
      // Extract audio using Web Audio API
      const audioContext = new AudioContext();
      const arrayBuffer = await videoBlob.arrayBuffer();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      
      // Convert to WAV
      const audioBlob = await audioBufferToWav(audioBuffer);
      setTestMediaFiles(prev => ({ ...prev, audio: audioBlob }));
      
      URL.revokeObjectURL(video.src);
      toast.success('Test media extracted successfully');
    } catch (error) {
      console.error('Error extracting test media:', error);
      toast.error('Failed to extract test media from video');
    }
  }, []);

  // Reset test media
  const resetTestMedia = useCallback(() => {
    setTestMediaFiles({ video: null, photo: null, audio: null });
    setUploadProgress(0);
    setTestMediaSubmitted(false);
    
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  }, [stream]);

  // Generate presigned URL for media
  const generatePresignedUrl = useCallback(async (uri: string): Promise<string | null> => {
    try {
      const response = await fetchWithAuth('/api/verification/presigned-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uri })
      });
      if (!response.ok) throw new Error('Failed to generate presigned URL');
      const { url } = await response.json();
      return url;
    } catch (error) {
      console.error('Error generating presigned URL:', error);
      return null;
    }
  }, []);

  // Fetch verification data
  const fetchVerificationData = useCallback(async () => {
    try {
      const response = await fetchWithAuth('/api/verification/latest');
      if (!response.ok) throw new Error('Failed to fetch verification data');
      
      const data = await response.json();
      setVerificationData(data);
      
      // Generate presigned URLs for media display
      const urls: any = {};
      
      // Get original media URLs (stored in originalXxxUrl fields)
      const originalVideoUrl = data.originalVideoUrl;
      const originalPhotoUrl = data.originalPhotoUrl; 
      const originalAudioUrl = data.originalAudioUrl;
      
      if (originalVideoUrl) {
        urls.videoUrl = await generatePresignedUrl(originalVideoUrl);
      }
      if (originalPhotoUrl) {
        urls.photoUrl = await generatePresignedUrl(originalPhotoUrl);
      }
      if (originalAudioUrl) {
        urls.audioUrl = await generatePresignedUrl(originalAudioUrl);
      }
      if (data.testVideoUrl) {
        urls.testVideoUrl = await generatePresignedUrl(data.testVideoUrl);
      }
      if (data.testPhotoUrl) {
        urls.testPhotoUrl = await generatePresignedUrl(data.testPhotoUrl);
      }
      if (data.testAudioUrl) {
        urls.testAudioUrl = await generatePresignedUrl(data.testAudioUrl);
      }
      setMediaUrls(urls);
      
      // Check if test media already exists
      if (data.testVideoUrl && data.testPhotoUrl && data.testAudioUrl) {
        setTestMediaSubmitted(true);
      }
    } catch (error) {
      console.error('Error fetching verification data:', error);
      toast.error('Failed to load verification data');
    } finally {
      setIsLoading(false);
    }
  }, [generatePresignedUrl]);

  // Upload test media
  const uploadTestMedia = useCallback(async () => {
    if (!testMediaFiles.video || !testMediaFiles.photo || !testMediaFiles.audio) {
      toast.error('All test media files are required');
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      const formData = new FormData();
      formData.append('video', testMediaFiles.video, 'test_video.webm');
      formData.append('photo', testMediaFiles.photo, 'test_photo.jpg');
      formData.append('audio', testMediaFiles.audio, 'test_audio.wav');

      const response = await fetchWithAuth('/api/verification/upload-test', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error('Test media upload failed');

      const result = await response.json();
      
      // Update verification data with test media URLs
      setVerificationData(prev => prev ? {
        ...prev,
        testVideoUrl: result.urls.testVideoUrl,
        testPhotoUrl: result.urls.testPhotoUrl,
        testAudioUrl: result.urls.testAudioUrl
      } : null);

      // Generate presigned URLs for the newly uploaded test media
      const newUrls: any = { ...mediaUrls };
      if (result.urls.testVideoUrl) {
        newUrls.testVideoUrl = await generatePresignedUrl(result.urls.testVideoUrl);
      }
      if (result.urls.testPhotoUrl) {
        newUrls.testPhotoUrl = await generatePresignedUrl(result.urls.testPhotoUrl);
      }
      if (result.urls.testAudioUrl) {
        newUrls.testAudioUrl = await generatePresignedUrl(result.urls.testAudioUrl);
      }
      setMediaUrls(newUrls);

      setUploadProgress(100);
      setTestMediaSubmitted(true);
      toast.success('Test media uploaded successfully!');
    } catch (error) {
      console.error('Test upload error:', error);
      toast.error('Failed to upload test media');
    } finally {
      setIsUploading(false);
    }
  }, [testMediaFiles, generatePresignedUrl, mediaUrls]);

  // Update analysis step status
  const updateStepStatus = useCallback((stepId: string, status: AnalysisStep['status'], score?: number, details?: string) => {
    setAnalysisSteps(prev => prev.map(step => 
      step.id === stepId 
        ? { ...step, status, score, details }
        : step
    ));
  }, []);

  // Start video deepfake analysis
  const analyzeVideoDeepfake = useCallback(async (originalVideoUrl: string, testVideoUrl: string) => {
    setCurrentAnalysisStep('video-deepfake');
    updateStepStatus('video-deepfake', 'processing');
    
    try {
      const response = await fetchWithAuth('/api/verification/analyze-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ originalVideoUrl, testVideoUrl })
      });
      
      if (!response.ok) {
        if (response.status === 404) {
          // Video verification skipped
          const result = await response.json();
          console.log('Video verification skipped:', result.message);
          updateStepStatus('video-deepfake', 'failed', 0, 'Video verification unavailable');
          return null;
        }
        throw new Error('Video analysis failed');
      }
      
      const result = await response.json();
      updateStepStatus('video-deepfake', 'completed', result.score, result.details);
      
      return result.score;
    } catch (error) {
      console.error('Video analysis error:', error);
      updateStepStatus('video-deepfake', 'failed');
      return null;
    }
  }, [updateStepStatus]);

  // Start face verification
  const analyzeFaceVerification = useCallback(async (originalPhotoUrl: string, testVideoUrl: string) => {
    setCurrentAnalysisStep('face-verification');
    updateStepStatus('face-verification', 'processing');
    
    try {
      const response = await fetchWithAuth('/api/verification/analyze-face', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ originalPhotoUrl, testVideoUrl })
      });
      
      if (!response.ok) throw new Error('Face analysis failed');
      
      const result = await response.json();
      updateStepStatus('face-verification', 'completed', result.score, result.details);
      
      return result.score;
    } catch (error) {
      console.error('Face analysis error:', error);
      updateStepStatus('face-verification', 'failed');
      throw error;
    }
  }, [updateStepStatus]);

  // Start voice verification
  const analyzeVoiceVerification = useCallback(async (originalVideoUrl: string, testVideoUrl: string) => {
    setCurrentAnalysisStep('voice-verification');
    updateStepStatus('voice-verification', 'processing');
    
    try {
      const response = await fetchWithAuth('/api/verification/analyze-voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ originalVideoUrl, testVideoUrl })
      });
      
      if (!response.ok) {
        if (response.status === 422) {
          // Voice verification skipped
          const result = await response.json();
          console.log('Voice verification skipped:', result.message);
          updateStepStatus('voice-verification', 'failed', 0, 'Voice verification unavailable');
          return null;
        }
        throw new Error('Voice analysis failed');
      }
      
      const result = await response.json();
      updateStepStatus('voice-verification', 'completed', result.score, result.details);
      
      return result.score;
    } catch (error) {
      console.error('Voice analysis error:', error);
      updateStepStatus('voice-verification', 'failed');
      return null;
    }
  }, [updateStepStatus]);

  // Run complete analysis
  const runCompleteAnalysis = useCallback(async () => {
    if (!verificationData) return;

    // Check if test media exists
    if (!verificationData.testVideoUrl || !verificationData.testPhotoUrl || !verificationData.testAudioUrl) {
      toast.error('Test media not found. Please upload test media first.');
      return;
    }

    // Check if original media exists
    if (!verificationData.originalVideoUrl || !verificationData.originalPhotoUrl || !verificationData.originalAudioUrl) {
      toast.error('Original media not found. Please upload original media first.');
      return;
    }

    setIsAnalyzing(true);
    setAnalysisProgress(0);
    
    try {
      // Reset all steps
      setAnalysisSteps(prev => prev.map(step => ({ ...step, status: 'pending' })));
      
      // Step 1: Video Deepfake Detection (33%)
      const videoScore = await analyzeVideoDeepfake(verificationData.originalVideoUrl, verificationData.testVideoUrl);
      setAnalysisProgress(33);
      
      // Step 2: Face Verification (66%)
      const faceScore = await analyzeFaceVerification(verificationData.originalPhotoUrl, verificationData.testVideoUrl);
      setAnalysisProgress(66);
      
      // Step 3: Voice Verification (100%)
      const voiceScore = await analyzeVoiceVerification(verificationData.originalVideoUrl, verificationData.testVideoUrl);
      setAnalysisProgress(100);
      
      // Calculate overall status based only on successful verifications
      const scores = [videoScore, faceScore, voiceScore].filter(score => score !== null);
      const successfulVerifications = scores.length;
      const overallStatus = scores.length > 0 && scores.every(score => score > 0.7) ? 'verified' : 'rejected';
      
      // Save results
      await fetchWithAuth('/api/verification/update-results', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: verificationData.id,
          deepfakeScore: videoScore,
          faceVerificationScore: faceScore,
          voiceVerificationScore: voiceScore,
          overallStatus
        })
      });
      
      setVerificationData(prev => prev ? {
        ...prev,
        deepfakeScore: videoScore,
        faceVerificationScore: faceScore,
        voiceVerificationScore: voiceScore,
        overallStatus
      } : null);
      
      toast.success('Analysis completed successfully!');
    } catch (error) {
      console.error('Analysis error:', error);
      toast.error('Analysis failed. Please try again.');
    } finally {
      setIsAnalyzing(false);
      setCurrentAnalysisStep(null);
    }
  }, [verificationData, analyzeVideoDeepfake, analyzeFaceVerification, analyzeVoiceVerification]);

  // Load verification data on mount
  useEffect(() => {
    if (isAuthenticated) {
      fetchVerificationData();
    }
  }, [isAuthenticated, fetchVerificationData]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [stream]);

  // Cleanup camera when page visibility changes or user navigates away
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && stream) {
        // Page is hidden, stop camera
        stream.getTracks().forEach(track => track.stop());
        setStream(null);
      }
    };

    const handleBeforeUnload = () => {
      // User is navigating away, stop camera
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };

    // Listen for page visibility changes
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [stream]);

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Please log in to access the verification test system.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto" />
          <p className="text-muted-foreground">Loading verification data...</p>
        </div>
      </div>
    );
  }

  if (!verificationData) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            No verification data found. Please submit your media files first at{' '}
            <a href="/verify" className="text-primary hover:underline">
              /verify
            </a>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold">Verification Test</h1>
        <p className="text-muted-foreground">
          Submit test media to verify against your original submission
        </p>
      </div>

      {/* Step 1: Submit Test Media */}
      {!testMediaSubmitted && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Video className="h-5 w-5" />
              Step 1: Submit Test Media for Verification
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <Alert className="border-blue-200 bg-blue-50">
              <Shield className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-800">
                <strong>Test Verification:</strong> Record new media that will be compared against your original submission to verify your identity.
              </AlertDescription>
            </Alert>

            {/* Camera Preview */}
            <div className="space-y-4">
              <div className="relative aspect-video bg-muted rounded-lg overflow-hidden">
                <video
                  ref={videoRef}
                  autoPlay
                  muted
                  playsInline
                  className="w-full h-full object-cover"
                />
                {isRecording && (
                  <div className="absolute top-4 right-4 flex items-center gap-2 bg-red-500 text-white px-3 py-1 rounded-full">
                    <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                    REC {recordingTime}s
                  </div>
                )}
              </div>

              {/* Reading Script for Test */}
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h3 className="font-medium text-green-900 mb-2 flex items-center gap-2">
                  <Mic className="h-4 w-4" />
                  Bacakan teks berikut untuk verifikasi test:
                </h3>
                <div className="text-sm text-green-800 bg-white p-3 rounded border leading-relaxed">
                  {TEST_RECORDING_SCRIPT}
                </div>
              </div>

              <canvas ref={canvasRef} className="hidden" />

              {/* Recording Controls */}
              <div className="flex gap-4">
                {!stream ? (
                  <Button onClick={initializeCamera} className="flex-1">
                    <Camera className="h-4 w-4 mr-2" />
                    Initialize Camera for Test
                  </Button>
                ) : !isRecording ? (
                  <Button onClick={startTestRecording} className="flex-1" disabled={!!testMediaFiles.video}>
                    <Play className="h-4 w-4 mr-2" />
                    Start Test Recording
                  </Button>
                ) : (
                  <Button onClick={stopTestRecording} variant="destructive" className="flex-1">
                    <Square className="h-4 w-4 mr-2" />
                    Stop Recording
                  </Button>
                )}
                
                {testMediaFiles.video && (
                  <Button onClick={resetTestMedia} variant="outline">
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Reset
                  </Button>
                )}
              </div>
            </div>

            {/* Test Media Preview */}
            {(testMediaFiles.video || testMediaFiles.photo || testMediaFiles.audio) && (
              <div className="space-y-4">
                <h3 className="font-medium">Test Media Preview:</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Test Video */}
                  {testMediaFiles.video && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Video className="h-4 w-4" />
                        <span className="text-sm font-medium">Test Video</span>
                        <Badge variant="secondary">
                          {(testMediaFiles.video.size / (1024 * 1024)).toFixed(2)} MB
                        </Badge>
                      </div>
                      <video
                        src={URL.createObjectURL(testMediaFiles.video)}
                        controls
                        className="w-full aspect-video rounded bg-muted"
                      />
                    </div>
                  )}

                  {/* Test Photo */}
                  {testMediaFiles.photo && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <FileImage className="h-4 w-4" />
                        <span className="text-sm font-medium">Test Photo</span>
                        <Badge variant="secondary">
                          {(testMediaFiles.photo.size / 1024).toFixed(0)} KB
                        </Badge>
                      </div>
                      <img
                        src={URL.createObjectURL(testMediaFiles.photo)}
                        alt="Test photo"
                        className="w-full aspect-square object-cover rounded bg-muted"
                      />
                    </div>
                  )}

                  {/* Test Audio */}
                  {testMediaFiles.audio && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Volume2 className="h-4 w-4" />
                        <span className="text-sm font-medium">Test Audio</span>
                        <Badge variant="secondary">
                          {(testMediaFiles.audio.size / 1024).toFixed(0)} KB
                        </Badge>
                      </div>
                      <audio
                        src={URL.createObjectURL(testMediaFiles.audio)}
                        controls
                        className="w-full"
                      />
                    </div>
                  )}
                </div>

                {/* Upload Test Media Button */}
                {testMediaFiles.video && testMediaFiles.photo && testMediaFiles.audio && (
                  <Button 
                    onClick={uploadTestMedia} 
                    className="w-full" 
                    disabled={isUploading}
                  >
                    {isUploading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Uploading Test Media... {uploadProgress}%
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4 mr-2" />
                        Submit Test Media for Verification
                      </>
                    )}
                  </Button>
                )}

                {/* Upload Progress */}
                {isUploading && (
                  <div className="space-y-2">
                    <Progress value={uploadProgress} className="w-full" />
                    <p className="text-sm text-muted-foreground text-center">
                      {uploadProgress < 100 ? 'Uploading test media...' : 'Finalizing test submission...'}
                    </p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 2: Analysis (only show when test media is submitted) */}
      {testMediaSubmitted && (
        <>
          {/* Analysis Progress */}
          {isAnalyzing && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Brain className="h-5 w-5" />
                  Analysis in Progress
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Overall Progress</span>
                    <span>{analysisProgress}%</span>
                  </div>
                  <Progress value={analysisProgress} className="w-full" />
                </div>
                
                {currentAnalysisStep && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Activity className="h-4 w-4 animate-pulse" />
                    <span>
                      Currently analyzing: {analysisSteps.find(s => s.id === currentAnalysisStep)?.title}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Analysis Steps */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5" />
                Verification Analysis Steps
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {analysisSteps.map((step) => (
                  <div key={step.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 ${
                        step.status === 'completed' 
                          ? 'bg-green-100 border-green-500 text-green-700'
                          : step.status === 'processing'
                            ? 'bg-blue-100 border-blue-500 text-blue-700 animate-pulse'
                            : step.status === 'failed'
                              ? 'bg-red-100 border-red-500 text-red-700'
                              : 'bg-gray-100 border-gray-300 text-gray-500'
                      }`}>
                        {step.status === 'completed' ? <CheckCircle className="h-5 w-5" /> : 
                         step.status === 'processing' ? <Loader2 className="h-5 w-5 animate-spin" /> :
                         step.status === 'failed' ? <AlertCircle className="h-5 w-5" /> : step.icon}
                      </div>
                      <div>
                        <h3 className="font-medium">{step.title}</h3>
                        <p className="text-sm text-muted-foreground">{step.description}</p>
                        {step.details && (
                          <p className="text-xs text-muted-foreground mt-1">{step.details}</p>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge variant={
                        step.status === 'completed' ? 'default' :
                        step.status === 'processing' ? 'secondary' :
                        step.status === 'failed' ? 'destructive' : 'outline'
                      }>
                        {step.status === 'completed' && step.score !== undefined ? 
                          `${(step.score * 100).toFixed(1)}%` : 
                          step.status.charAt(0).toUpperCase() + step.status.slice(1)
                        }
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Start Analysis Button */}
          {!isAnalyzing && verificationData.testVideoUrl && (
            <div className="text-center">
              <Button 
                onClick={runCompleteAnalysis} 
                size="lg"
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
              >
                <Brain className="h-5 w-5 mr-2" />
                Start AI Verification Analysis
              </Button>
            </div>
          )}
        </>
      )}

      {/* Original Media Preview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Original Submitted Media
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileVideo className="h-4 w-4" />
                  Video
                </CardTitle>
              </CardHeader>
              <CardContent>
                {mediaUrls.videoUrl ? (
                  <video
                    src={mediaUrls.videoUrl}
                    controls
                    className="w-full aspect-video rounded bg-muted"
                  />
                ) : (
                  <div className="w-full aspect-video rounded bg-muted flex items-center justify-center">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileImage className="h-4 w-4" />
                  Photo
                </CardTitle>
              </CardHeader>
              <CardContent>
                {mediaUrls.photoUrl ? (
                  <img
                    src={mediaUrls.photoUrl}
                    alt="Verification photo"
                    className="w-full aspect-square object-cover rounded bg-muted"
                  />
                ) : (
                  <div className="w-full aspect-square rounded bg-muted flex items-center justify-center">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Volume2 className="h-4 w-4" />
                  Audio
                </CardTitle>
              </CardHeader>
              <CardContent>
                {mediaUrls.audioUrl ? (
                  <audio
                    src={mediaUrls.audioUrl}
                    controls
                    className="w-full"
                  />
                ) : (
                  <div className="w-full h-12 rounded bg-muted flex items-center justify-center">
                    <Loader2 className="h-4 w-4 animate-spin" />
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>

      {/* Test Media Preview */}
      {testMediaSubmitted && (mediaUrls.testVideoUrl || mediaUrls.testPhotoUrl || mediaUrls.testAudioUrl) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Video className="h-5 w-5" />
              Test Media Submitted for Verification
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileVideo className="h-4 w-4" />
                    Test Video
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {mediaUrls.testVideoUrl ? (
                    <video
                      src={mediaUrls.testVideoUrl}
                      controls
                      className="w-full aspect-video rounded bg-muted"
                    />
                  ) : (
                    <div className="w-full aspect-video rounded bg-muted flex items-center justify-center">
                      <Loader2 className="h-6 w-6 animate-spin" />
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileImage className="h-4 w-4" />
                    Test Photo
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {mediaUrls.testPhotoUrl ? (
                    <img
                      src={mediaUrls.testPhotoUrl}
                      alt="Test verification photo"
                      className="w-full aspect-square object-cover rounded bg-muted"
                    />
                  ) : (
                    <div className="w-full aspect-square rounded bg-muted flex items-center justify-center">
                      <Loader2 className="h-6 w-6 animate-spin" />
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Volume2 className="h-4 w-4" />
                    Test Audio
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {mediaUrls.testAudioUrl ? (
                    <audio
                      src={mediaUrls.testAudioUrl}
                      controls
                      className="w-full"
                    />
                  ) : (
                    <div className="w-full h-12 rounded bg-muted flex items-center justify-center">
                      <Loader2 className="h-4 w-4 animate-spin" />
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Verification Results */}
      {(verificationData.deepfakeScore !== undefined || verificationData.faceVerificationScore !== undefined || verificationData.voiceVerificationScore !== undefined) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Verification Results
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="text-center space-y-2">
                <h3 className="font-medium">Overall Status</h3>
                <Badge 
                  variant={verificationData.overallStatus === 'verified' ? 'default' : 'destructive'}
                  className="text-lg py-2 px-4"
                >
                  {verificationData.overallStatus === 'verified' ? 'VERIFIED' : 'REJECTED'}
                </Badge>
              </div>
              
              {verificationData.deepfakeScore !== undefined && (
                <div className="text-center space-y-2">
                  <h3 className="font-medium">Deepfake Score</h3>
                  <div className="text-2xl font-bold">
                    {(verificationData.deepfakeScore * 100).toFixed(1)}%
                  </div>
                  <Badge variant={verificationData.deepfakeScore > 0.7 ? 'default' : 'destructive'}>
                    {verificationData.deepfakeScore > 0.7 ? 'Authentic' : 'Suspicious'}
                  </Badge>
                </div>
              )}

              {verificationData.faceVerificationScore !== undefined && (
                <div className="text-center space-y-2">
                  <h3 className="font-medium">Face Match</h3>
                  <div className="text-2xl font-bold">
                    {(verificationData.faceVerificationScore * 100).toFixed(1)}%
                  </div>
                  <Badge variant={verificationData.faceVerificationScore > 0.7 ? 'default' : 'destructive'}>
                    {verificationData.faceVerificationScore > 0.7 ? 'Verified' : 'Failed'}
                  </Badge>
                </div>
              )}

              {verificationData.voiceVerificationScore !== undefined && (
                <div className="text-center space-y-2">
                  <h3 className="font-medium">Voice Match</h3>
                  <div className="text-2xl font-bold">
                    {(verificationData.voiceVerificationScore * 100).toFixed(1)}%
                  </div>
                  <Badge variant={verificationData.voiceVerificationScore > 0.7 ? 'default' : 'destructive'}>
                    {verificationData.voiceVerificationScore > 0.7 ? 'Verified' : 'Failed'}
                  </Badge>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
} 