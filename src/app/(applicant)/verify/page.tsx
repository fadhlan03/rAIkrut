'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Camera, 
  Video, 
  Mic, 
  Upload, 
  CheckCircle, 
  AlertCircle, 
  Play, 
  Square, 
  RotateCcw,
  FileVideo,
  FileImage,
  Volume2,
  Shield,
  Eye,
  Loader2,
  X
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useDashboard } from '@/contexts/DashboardContext';
import { fetchWithAuth } from '@/lib/fetchWithAuth';

interface VerificationStep {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  completed: boolean;
}

interface MediaFiles {
  video: Blob | null;
  photo: Blob | null;
  audio: Blob | null;
}

interface VerificationScores {
  deepfakeScore?: number;
  faceVerificationScore?: number;
  voiceVerificationScore?: number;
}

// Indonesian text for users to read during recording
const RECORDING_SCRIPT = `
Halo, nama saya adalah [sebutkan nama lengkap Anda]. 
Saya sedang melamar pekerjaan di perusahaan ini. 
Saya menyatakan bahwa identitas yang saya berikan adalah benar dan saya bertanggung jawab penuh atas informasi yang saya sampaikan. 
Terima kasih atas perhatiannya.
`;

export default function VerificationPage() {
  const { setSiteTitle } = useDashboard();
  const { isAuthenticated, userType } = useAuth(); // Add userType to debug
  const router = useRouter();
  
  // Recording states
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [recordedChunks, setRecordedChunks] = useState<Blob[]>([]);
  
  // Media files
  const [mediaFiles, setMediaFiles] = useState<MediaFiles>({
    video: null,
    photo: null,
    audio: null
  });
  
  // UI states
  const [currentStep, setCurrentStep] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [verificationScores, setVerificationScores] = useState<VerificationScores>({});
  const [verificationStatus, setVerificationStatus] = useState<'pending' | 'processing' | 'verified' | 'rejected' | 'failed'>('pending');
  const [showSecurityAlert, setShowSecurityAlert] = useState(true);
  
  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const steps: VerificationStep[] = [
    {
      id: 'setup',
      title: 'Setup Camera',
      description: 'Allow camera access and position yourself clearly in frame',
      icon: <Camera className="h-5 w-5" />,
      completed: !!stream
    },
    {
      id: 'record',
      title: 'Record Video',
      description: 'Record a 15-second video of yourself speaking clearly',
      icon: <Video className="h-5 w-5" />,
      completed: !!mediaFiles.video
    },
    {
      id: 'extract',
      title: 'Process Media',
      description: 'Automatically extract photo and audio from your video',
      icon: <FileImage className="h-5 w-5" />,
      completed: !!mediaFiles.photo && !!mediaFiles.audio
    },
    {
      id: 'submit',
      title: 'Submit',
      description: 'Upload your media files for identity verification',
      icon: <Upload className="h-5 w-5" />,
      completed: verificationStatus === 'verified'
    }
  ];

  useEffect(() => {
    setSiteTitle('ID Submission');
    return () => setSiteTitle(null);
  }, [setSiteTitle]);

  // Initialize camera
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
      toast.success('Camera initialized successfully');
    } catch (error) {
      console.error('Error accessing camera:', error);
      toast.error('Failed to access camera. Please ensure camera permissions are granted.');
    }
  }, []);

  // Start recording
  const startRecording = useCallback(() => {
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
        setMediaFiles(prev => ({ ...prev, video: videoBlob }));
        setRecordedChunks(chunks);
        extractMediaFromVideo(videoBlob);
      };
      
      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
      setRecordingTime(0);
      
      // Timer for 15 seconds
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => {
          if (prev >= 14) {
            stopRecording();
            return 15;
          }
          return prev + 1;
        });
      }, 1000);
      
      toast.success('Recording started');
    } catch (error) {
      console.error('Error starting recording:', error);
      toast.error('Failed to start recording');
    }
  }, [stream]);

  // Stop recording
  const stopRecording = useCallback(() => {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop();
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      toast.success('Recording completed');
    }
  }, [mediaRecorder, isRecording]);

  // Extract photo and audio from video
  const extractMediaFromVideo = useCallback(async (videoBlob: Blob) => {
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
              setMediaFiles(prev => ({ ...prev, photo: photoBlob }));
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
      setMediaFiles(prev => ({ ...prev, audio: audioBlob }));
      
      URL.revokeObjectURL(video.src);
      toast.success('Media extracted successfully');
      setCurrentStep(2);
    } catch (error) {
      console.error('Error extracting media:', error);
      toast.error('Failed to extract media from video');
    }
  }, []);

  // Convert audio buffer to WAV blob
  const audioBufferToWav = useCallback(async (audioBuffer: AudioBuffer): Promise<Blob> => {
    const length = audioBuffer.length;
    const arrayBuffer = new ArrayBuffer(44 + length * 2);
    const view = new DataView(arrayBuffer);
    
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
    view.setUint32(24, audioBuffer.sampleRate, true);
    view.setUint32(28, audioBuffer.sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, length * 2, true);
    
    // Convert float32 to int16
    const channelData = audioBuffer.getChannelData(0);
    let offset = 44;
    for (let i = 0; i < length; i++) {
      const sample = Math.max(-1, Math.min(1, channelData[i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
      offset += 2;
    }
    
    return new Blob([arrayBuffer], { type: 'audio/wav' });
  }, []);

  // Upload and verify
  const uploadAndVerify = useCallback(async () => {
    if (!mediaFiles.video || !mediaFiles.photo || !mediaFiles.audio) {
      toast.error('All media files are required for submission');
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    setVerificationStatus('processing');

    try {
      // Create FormData for upload
      const formData = new FormData();
      formData.append('video', mediaFiles.video, 'id_video.webm');
      formData.append('photo', mediaFiles.photo, 'id_photo.jpg');
      formData.append('audio', mediaFiles.audio, 'voice_sample.wav');

      // Upload with progress tracking
      const response = await fetchWithAuth('/api/verification/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      setUploadProgress(100);
      const result = await response.json();
      
      setVerificationStatus('verified');
      setCurrentStep(3);
      
      toast.success('Media files submitted successfully!');
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Upload failed. Please try again.');
      setVerificationStatus('failed');
    } finally {
      setIsUploading(false);
    }
  }, [mediaFiles]);

  // Reset verification
  const resetVerification = useCallback(() => {
    setMediaFiles({ video: null, photo: null, audio: null });
    setRecordedChunks([]);
    setCurrentStep(0);
    setUploadProgress(0);
    setVerificationScores({});
    setVerificationStatus('pending');
    
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  }, [stream]);

  // Auto-initialize camera on mount
  useEffect(() => {
    if (isAuthenticated) {
      initializeCamera();
    }
    
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isAuthenticated, initializeCamera]);

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

  // Redirect to pre-interview when verification is successful
  useEffect(() => {
    if (verificationStatus === 'verified') {
      router.push('/pre-interview');
    }
  }, [verificationStatus, router]);

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Please log in to access the ID submission system.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">

      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold">ID Submission</h1>
        <p className="text-muted-foreground">
          Submit your video, photo, and audio for identity verification
        </p>
      </div>

      {/* Security Notice */}
      {showSecurityAlert && (
        <div className="mx-auto max-w-2xl">
          <Alert className="border-green-200 bg-green-50 relative">
            <Shield className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800 pr-8">
              <strong>Keamanan Data Terjamin:</strong> Semua media yang Anda upload dilindungi dengan enkripsi tingkat tinggi dan hanya digunakan untuk proses verifikasi identitas. Data Anda tidak akan dibagikan kepada pihak ketiga.
            </AlertDescription>
            <button
              onClick={() => setShowSecurityAlert(false)}
              className="absolute top-2 right-2 p-1 rounded-full hover:bg-green-100 text-green-600 transition-colors"
              aria-label="Close alert"
            >
              <X className="h-4 w-4" />
            </button>
          </Alert>
        </div>
      )}

      {/* Progress Steps */}
      <div className="flex justify-center mb-8">
        <div className="flex items-center space-x-4">
          {steps.map((step, index) => (
            <div key={step.id} className="flex items-center">
              <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 ${
                step.completed 
                  ? 'bg-primary border-primary text-primary-foreground' 
                  : currentStep === index
                    ? 'border-primary text-primary'
                    : 'border-muted text-muted-foreground'
              }`}>
                {step.completed ? <CheckCircle className="h-5 w-5" /> : step.icon}
              </div>
              {index < steps.length - 1 && (
                <div className={`w-16 h-0.5 ml-4 ${
                  step.completed ? 'bg-primary' : 'bg-muted'
                }`} />
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Video Preview */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Camera className="h-5 w-5" />
              Camera Preview
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
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
            
            {/* Reading Script */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-medium text-blue-900 mb-2 flex items-center gap-2">
                <Mic className="h-4 w-4" />
                Bacakan teks berikut dengan jelas:
              </h3>
              <div className="text-sm text-blue-800 bg-white p-3 rounded border leading-relaxed">
                {RECORDING_SCRIPT}
              </div>
            </div>
            
            <canvas ref={canvasRef} className="hidden" />
            
            <div className="flex gap-2">
              {!stream ? (
                <Button onClick={initializeCamera} className="flex-1">
                  <Camera className="h-4 w-4 mr-2" />
                  Initialize Camera
                </Button>
              ) : !isRecording ? (
                <Button onClick={startRecording} className="flex-1" disabled={!!mediaFiles.video}>
                  <Play className="h-4 w-4 mr-2" />
                  Start Recording
                </Button>
              ) : (
                <Button onClick={stopRecording} variant="destructive" className="flex-1">
                  <Square className="h-4 w-4 mr-2" />
                  Stop Recording
                </Button>
              )}
              
              {mediaFiles.video && (
                <Button onClick={resetVerification} variant="outline">
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Reset
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Media Files Preview */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileVideo className="h-5 w-5" />
              Captured Media
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Video Preview */}
            {mediaFiles.video && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Video className="h-4 w-4" />
                  <span className="text-sm font-medium">Video</span>
                  <Badge variant="secondary">
                    {(mediaFiles.video.size / (1024 * 1024)).toFixed(2)} MB
                  </Badge>
                </div>
                <video
                  src={URL.createObjectURL(mediaFiles.video)}
                  controls
                  className="w-full aspect-video rounded bg-muted"
                />
              </div>
            )}

            {/* Photo Preview */}
            {mediaFiles.photo && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <FileImage className="h-4 w-4" />
                  <span className="text-sm font-medium">Photo</span>
                  <Badge variant="secondary">
                    {(mediaFiles.photo.size / 1024).toFixed(0)} KB
                  </Badge>
                </div>
                <img
                  src={URL.createObjectURL(mediaFiles.photo)}
                  alt="Extracted photo"
                  className="w-full max-w-xs rounded border"
                />
              </div>
            )}

            {/* Audio Preview */}
            {mediaFiles.audio && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Volume2 className="h-4 w-4" />
                  <span className="text-sm font-medium">Audio</span>
                  <Badge variant="secondary">
                    {(mediaFiles.audio.size / 1024).toFixed(0)} KB
                  </Badge>
                </div>
                <audio
                  src={URL.createObjectURL(mediaFiles.audio)}
                  controls
                  className="w-full"
                />
              </div>
            )}

            {/* Upload Button */}
            {mediaFiles.video && mediaFiles.photo && mediaFiles.audio && verificationStatus === 'pending' && (
              <Button 
                onClick={uploadAndVerify} 
                className="w-full" 
                disabled={isUploading}
              >
                {isUploading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Uploading... {uploadProgress}%
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Submit Media Files
                  </>
                )}
              </Button>
            )}

            {/* Upload Progress */}
            {isUploading && (
              <div className="space-y-2">
                <Progress value={uploadProgress} className="w-full" />
                <p className="text-sm text-muted-foreground text-center">
                  {uploadProgress < 100 ? 'Uploading files...' : 'Finalizing submission...'}
                </p>
              </div>
            )}

            {/* Success Message */}
            {verificationStatus === 'verified' && (
              <div className="text-center space-y-2 bg-green-50 border border-green-200 rounded-lg p-4">
                <CheckCircle className="h-8 w-8 text-green-600 mx-auto" />
                <h3 className="font-medium text-green-800">Submission Successful!</h3>
                <p className="text-sm text-green-700">
                  Your media files have been successfully submitted for identity verification.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>Petunjuk Penggunaan</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <h4 className="font-medium mb-2">Panduan Rekaman:</h4>
              <ul className="space-y-1 text-muted-foreground">
                <li>• Posisikan wajah Anda dengan jelas dalam frame kamera</li>
                <li>• Pastikan pencahayaan yang cukup dan terlihat jelas</li>
                <li>• Bacakan teks yang disediakan dengan jelas dan lantang</li>
                <li>• Durasi rekaman adalah 15 detik</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-2">Kebutuhan Sistem:</h4>
              <ul className="space-y-1 text-muted-foreground">
                <li>• Akses kamera dan mikrofon</li>
                <li>• Koneksi internet yang stabil</li>
                <li>• Browser yang mendukung perekaman video</li>
                <li>• Lingkungan yang tenang untuk audio yang jernih</li>
              </ul>
            </div>
          </div>
          
        </CardContent>
      </Card>
    </div>
  );
} 