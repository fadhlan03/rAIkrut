"use client";

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Shield, AlertTriangle } from 'lucide-react';

interface Challenge {
  type: 'math' | 'word_complete' | 'count_letters';
  question: string;
  answer: string;
  hint?: string;
}

const CHALLENGES: Challenge[] = [
  // Math challenges
  { type: 'math', question: 'What is 47 + 23?', answer: '70' },
  { type: 'math', question: 'What is 84 - 29?', answer: '55' },
  { type: 'math', question: 'What is 12 × 6?', answer: '72' },
  { type: 'math', question: 'What is 96 ÷ 8?', answer: '12' },
  { type: 'math', question: 'What is 35 + 48?', answer: '83' },
  
  // Word completion challenges
  { type: 'word_complete', question: 'Complete this word: INTER____', answer: 'INTERVIEW', hint: 'Related to job applications' },
  { type: 'word_complete', question: 'Complete this word: VERI_____ION', answer: 'VERIFICATION', hint: 'Security process' },
  { type: 'word_complete', question: 'Complete this word: APPLI____', answer: 'APPLICATION', hint: 'What you submitted for this job' },
  { type: 'word_complete', question: 'Complete this word: SECU____', answer: 'SECURITY', hint: 'Protection measure' },
  
  // Letter counting challenges
  { type: 'count_letters', question: 'How many letters are in "AUTHENTICITY"?', answer: '12' },
  { type: 'count_letters', question: 'How many letters are in "VERIFICATION"?', answer: '12' },
  { type: 'count_letters', question: 'How many letters are in "INTERVIEW"?', answer: '9' },
  { type: 'count_letters', question: 'How many letters are in "CHALLENGE"?', answer: '9' },
];

interface AntiCheatChallengeProps {
  isVisible: boolean;
  onComplete: () => void;
}

export default function AntiCheatChallenge({ isVisible, onComplete }: AntiCheatChallengeProps) {
  const [currentChallenge, setCurrentChallenge] = useState<Challenge | null>(null);
  const [userAnswer, setUserAnswer] = useState('');
  const [attempts, setAttempts] = useState(0);
  const [isWrong, setIsWrong] = useState(false);
  const [showHint, setShowHint] = useState(false);

  // Generate random challenge when component becomes visible
  useEffect(() => {
    if (isVisible && !currentChallenge) {
      const randomChallenge = CHALLENGES[Math.floor(Math.random() * CHALLENGES.length)];
      setCurrentChallenge(randomChallenge);
      setUserAnswer('');
      setAttempts(0);
      setIsWrong(false);
      setShowHint(false);
    }
  }, [isVisible, currentChallenge]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!currentChallenge || !userAnswer.trim()) return;

    const normalizedAnswer = userAnswer.trim().toUpperCase();
    const correctAnswer = currentChallenge.answer.toUpperCase();

    if (normalizedAnswer === correctAnswer) {
      // Correct answer - close the challenge
      onComplete();
      setCurrentChallenge(null);
      setUserAnswer('');
      setAttempts(0);
      setIsWrong(false);
      setShowHint(false);
    } else {
      // Wrong answer
      setAttempts(prev => prev + 1);
      setIsWrong(true);
      setUserAnswer('');
      
      // Show hint after 2 wrong attempts
      if (attempts >= 1 && currentChallenge.hint) {
        setShowHint(true);
      }
      
      // Reset wrong indicator after 2 seconds
      setTimeout(() => setIsWrong(false), 2000);
    }
  };

  if (!isVisible || !currentChallenge) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
      <Card className="w-full max-w-md mx-auto shadow-2xl border-2 border-primary">
        <CardHeader className="text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Shield className="h-6 w-6 text-primary" />
            <CardTitle className="text-xl">Security Verification</CardTitle>
          </div>
          <p className="text-sm text-muted-foreground">
            Please solve this challenge to continue the interview
          </p>
        </CardHeader>
        
        <CardContent className="space-y-4">
          <div className="text-center">
            <div className="bg-muted p-4 rounded-lg mb-4">
              <p className="text-lg font-medium">
                {currentChallenge.question}
              </p>
            </div>
            
            {showHint && currentChallenge.hint && (
              <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg mb-4">
                <p className="text-sm text-blue-800">
                  💡 Hint: {currentChallenge.hint}
                </p>
              </div>
            )}
            
            {isWrong && (
              <div className="flex items-center justify-center gap-2 text-red-600 mb-3">
                <AlertTriangle className="h-4 w-4" />
                <span className="text-sm">Incorrect answer. Please try again.</span>
              </div>
            )}
            
            {attempts > 0 && (
              <p className="text-xs text-muted-foreground mb-3">
                Attempts: {attempts}/3
              </p>
            )}
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Input
                type="text"
                value={userAnswer}
                onChange={(e) => setUserAnswer(e.target.value)}
                placeholder="Enter your answer..."
                className={`text-center text-lg ${isWrong ? 'border-red-500 ring-red-500' : ''}`}
                autoComplete="off"
                autoFocus
              />
            </div>
            
            <Button 
              type="submit" 
              className="w-full"
              disabled={!userAnswer.trim()}
            >
              Submit Answer
            </Button>
          </form>
          
          <div className="text-center">
            <p className="text-xs text-muted-foreground">
              This challenge ensures interview security and authenticity
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 