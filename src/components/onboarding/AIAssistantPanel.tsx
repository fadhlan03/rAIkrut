import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sparkles, Send, Mic, Brain, Eye, ChevronRight, AlertCircle, Volume2 } from 'lucide-react';
import AudioVisualizer from '@/components/call/AudioVisualizer';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'ai';
  timestamp: Date;
}

interface AIAssistantPanelProps {
  className?: string;
  onToggleVisibility?: () => void;
  onboardingData?: any; // Pass onboarding data from parent component
}

const AIAssistantPanel: React.FC<AIAssistantPanelProps> = ({
  className = '',
  onToggleVisibility,
  onboardingData
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Dummy audio levels for the visualizer
  const [micVolume, setMicVolume] = useState(0);
  const [apiVolume, setApiVolume] = useState(0);

  // Audio playback state
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [hasUserInteracted, setHasUserInteracted] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Simulate AI speaking animation
  useEffect(() => {
    if (isPlayingAudio) {
      const interval = setInterval(() => {
        setApiVolume(Math.random() * 0.8 + 0.2);
      }, 100);
      
      return () => clearInterval(interval);
    } else {
      setApiVolume(0);
    }
  }, [isPlayingAudio]);

  // TTS function
  const playTextToSpeech = async (text: string) => {
    // Don't play TTS until user has interacted with the page
    if (!hasUserInteracted) {
      return;
    }

    console.log('TTS Request - Sending text:', text?.length, 'chars:', text?.substring(0, 100));

    if (!text?.trim()) {
      console.warn('TTS: Empty text provided');
      return;
    }

    try {
      setIsPlayingAudio(true);
      
      let response = await fetch('/api/tts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ text }),
      });

      // If 401, try to refresh token and retry once
      if (response.status === 401) {
        const refreshResponse = await fetch('/api/auth/refresh', {
          method: 'POST',
          credentials: 'include',
        });
        
        if (refreshResponse.ok) {
          // Retry TTS with new token
          response = await fetch('/api/tts', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify({ text }),
          });
        }
      }

      if (!response.ok) {
        throw new Error(`TTS failed: ${response.status}`);
      }

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = audioUrl;
        audioRef.current.onended = () => {
          setIsPlayingAudio(false);
          URL.revokeObjectURL(audioUrl);
        };
        audioRef.current.onerror = () => {
          setIsPlayingAudio(false);
          URL.revokeObjectURL(audioUrl);
        };
        
        try {
          await audioRef.current.play();
        } catch (playError) {
          console.warn('Audio play failed:', playError);
          setIsPlayingAudio(false);
          URL.revokeObjectURL(audioUrl);
        }
      }
    } catch (error) {
      console.error('TTS Error:', error);
      setIsPlayingAudio(false);
      // Don't show toast for TTS errors to avoid spam
    }
  };

  // Initialize chat with welcome message
  useEffect(() => {
    if (!isInitialized) {
      const welcomeText = getWelcomeMessage();
      const welcomeMessage: Message = {
        id: '1',
        text: welcomeText,
        sender: 'ai',
        timestamp: new Date()
      };
      setMessages([welcomeMessage]);
      setIsInitialized(true);
      
      // Play TTS for welcome message
      playTextToSpeech(welcomeText);
    }
  }, [onboardingData, isInitialized]);

  // Create audio element
  useEffect(() => {
    audioRef.current = new Audio();
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const getWelcomeMessage = (): string => {
    if (onboardingData?.welcomeContent?.roleTitle && onboardingData?.companyContent?.companyName) {
      return `Halo! Saya asisten AI onboarding Anda untuk ${onboardingData.companyContent.companyName}. Saya di sini untuk membantu Anda dengan pertanyaan tentang peran Anda sebagai ${onboardingData.welcomeContent.roleTitle}, perusahaan, tim, atau proses onboarding. Apa yang ingin Anda ketahui?`;
    }
    return "Halo! Saya asisten AI onboarding Anda. Saya di sini untuk membantu Anda dengan pertanyaan tentang peran, perusahaan, tim, atau proses onboarding Anda. Apa yang ingin Anda ketahui?";
  };

  const callChatAPI = async (message: string): Promise<string> => {
    const response = await fetch('/api/chat/onboarding', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({
        message,
        onboardingData,
        conversationHistory: messages.filter(msg => msg.sender !== 'ai' || msg.id !== '1') // Exclude initial welcome message
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Server error: ${response.status}`);
    }

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error || 'Failed to get response');
    }

    return data.response;
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isTyping) return;

    // Mark that user has interacted (enables TTS)
    if (!hasUserInteracted) {
      setHasUserInteracted(true);
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      text: inputValue,
      sender: 'user',
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    const currentInput = inputValue;
    setInputValue('');
    setIsTyping(true);
    setError(null);

    try {
      // Call the real API
      const aiResponseText = await callChatAPI(currentInput);
      
      setIsTyping(false);
      
      const aiResponse: Message = {
        id: (Date.now() + 1).toString(),
        text: aiResponseText,
        sender: 'ai',
        timestamp: new Date()
      };

      setMessages(prev => [...prev, aiResponse]);

      // Play TTS for AI response
      await playTextToSpeech(aiResponseText);

    } catch (error: any) {
      console.error('Chat API error:', error);
      setIsTyping(false);
      
      let errorMessage = 'Maaf, saya mengalami kesalahan. Silakan coba lagi.';
      
      if (error.message.includes('Unauthorized')) {
        errorMessage = 'Silakan masuk untuk melanjutkan percakapan.';
      } else if (error.message.includes('temporarily unavailable')) {
        errorMessage = 'Layanan AI sementara tidak tersedia. Silakan coba lagi sebentar lagi.';
      } else if (error.message.includes('safety guidelines')) {
        errorMessage = 'Silakan rumuskan ulang pertanyaan Anda dengan cara yang berbeda.';
      }
      
      const errorResponse: Message = {
        id: (Date.now() + 1).toString(),
        text: errorMessage,
        sender: 'ai',
        timestamp: new Date()
      };

      setMessages(prev => [...prev, errorResponse]);
      setError(error.message);
      toast.error('Gagal mendapatkan respons AI. Silakan coba lagi.');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    setInputValue(suggestion.toLowerCase());
  };

  const enableAudio = () => {
    setHasUserInteracted(true);
    // Play the welcome message if it exists
    if (messages.length > 0 && messages[0].sender === 'ai') {
      playTextToSpeech(messages[0].text);
    }
  };

  const getSuggestions = (): string[] => {
    const baseSuggestions = ['Budaya', 'Peran', 'Tim', 'Tunjangan'];

    if (onboardingData?.companyContent?.techStack?.length > 0) {
      baseSuggestions.push('Teknologi');
    }

    return baseSuggestions;
  };

  return (
    <div className={`flex flex-col h-full overflow-hidden ${className}`}>
      {/* Header with Toggle Button */}
      <div className="flex-shrink-0 flex items-center justify-between p-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <h3 className="text-base font-semibold text-foreground">AI Assistant</h3>
          {error && (
            <span title={error}>
              <AlertCircle className="h-4 w-4 text-destructive" />
            </span>
          )}
        </div>
        {onToggleVisibility && (
          <Button
            onClick={onToggleVisibility}
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* AI Visualizer */}
      <div className="flex-shrink-0 p-0">
        <div className="p-3">
          <div className="h-16 w-16 mx-auto flex items-center justify-center">
            <AudioVisualizer
              micVolume={micVolume}
              apiVolume={apiVolume}
              active={isPlayingAudio || isTyping}
            />
          </div>
          <div className="text-center text-xs text-muted-foreground mt-1 flex items-center justify-center gap-1">
            {isPlayingAudio ? (
              <>
                <Mic className="h-3 w-3" />
                Berbicara...
              </>
            ) : isTyping ? (
              <>
                <Brain className="h-3 w-3" />
                Berpikir...
              </>
            ) : (
              <>
                <Eye className="h-3 w-3" />
                Siap...
              </>
            )}
          </div>
          {!hasUserInteracted && (
            <div className="text-center mt-2">
              <Button
                onClick={enableAudio}
                variant="outline"
                size="sm"
                className="h-7 text-xs"
              >
                <Volume2 className="h-3 w-3 mr-1" />
                Aktifkan Suara
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Chat Messages - Flexible Area with Fixed Height */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <div className="h-full overflow-y-auto p-4">
          <div className="space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] p-3 rounded-lg ${
                    message.sender === 'user'
                      ? 'bg-primary text-primary-foreground rounded-br-sm'
                      : 'bg-accent text-foreground rounded-bl-sm'
                  }`}
                >
                  {message.sender === 'ai' ? (
                    <div className="text-sm leading-relaxed prose prose-sm max-w-none dark:prose-invert">
                      <ReactMarkdown 
                        components={{
                          p: (props: any) => <p className="mb-2 last:mb-0">{props.children}</p>,
                          ul: (props: any) => <ul className="mb-2 last:mb-0 pl-4">{props.children}</ul>,
                          ol: (props: any) => <ol className="mb-2 last:mb-0 pl-4">{props.children}</ol>,
                          li: (props: any) => <li className="mb-1">{props.children}</li>,
                          strong: (props: any) => <strong className="font-semibold">{props.children}</strong>,
                          em: (props: any) => <em className="italic">{props.children}</em>,
                          code: (props: any) => <code className="bg-accent/50 px-1 py-0.5 rounded text-xs">{props.children}</code>,
                          pre: (props: any) => <pre className="bg-accent/50 p-2 rounded text-xs overflow-x-auto">{props.children}</pre>,
                        }}
                      >
                        {message.text}
                      </ReactMarkdown>
                    </div>
                  ) : (
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.text}</p>
                  )}
                  <p className={`text-xs mt-1 ${
                    message.sender === 'user' ? 'text-primary-foreground/70' : 'text-muted-foreground'
                  }`}>
                    {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            ))}
            {isTyping && (
              <div className="flex justify-start">
                <div className="bg-accent text-accent-foreground p-3 rounded-lg rounded-bl-sm">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                    <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>
      </div>

      {/* Chat Input - Fixed at Bottom */}
      <div className="flex-shrink-0 p-3">
        <div className="flex space-x-2">
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={onboardingData ? "Tanyakan tentang peran atau perusahaan Anda..." : "Tanyakan tentang proses onboarding..."}
            className="flex-1 text-sm"
            disabled={isTyping}
          />
          <Button
            onClick={handleSendMessage}
            disabled={!inputValue.trim() || isTyping}
            size="sm"
          >
            <Send className="h-3 w-3" />
          </Button>
        </div>
        <div className="mt-2 flex flex-wrap gap-1">
          {getSuggestions().map((suggestion) => (
            <button
              key={suggestion}
              onClick={() => handleSuggestionClick(suggestion)}
              className="text-xs bg-accent text-foreground px-2 py-1 rounded hover:bg-accent/80 transition-colors"
              disabled={isTyping}
            >
              {suggestion}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AIAssistantPanel; 