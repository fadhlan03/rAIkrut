import React, { useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface AudioVisualizerProps {
  micVolume: number; // Volume from microphone (0-1+)
  apiVolume: number; // Volume from API output (0-1+)
  active: boolean;
}

const AudioVisualizer: React.FC<AudioVisualizerProps> = ({ micVolume, apiVolume, active }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameId = useRef<number | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    const draw = () => {
      animationFrameId.current = requestAnimationFrame(draw);

      if (!ctx || !canvas) return;

      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);

      const centerX = width / 2;
      const centerY = height / 2;
      const baseRadius = Math.min(width, height) * 0.25;
      const bars = 60;
      const theta = (2 * Math.PI) / bars;
      const maxBarLength = Math.min(width, height) * 0.35;
      const minBarLength = 2;

      const gradient = ctx.createLinearGradient(0, centerY - baseRadius - maxBarLength, 0, centerY + baseRadius + maxBarLength);
      gradient.addColorStop(0, 'rgb(255, 200, 0)');    // Yellow-Orange
      gradient.addColorStop(0.5, 'rgb(255, 165, 0)');    // Standard Orange
      gradient.addColorStop(1, 'rgba(255, 140, 0, 0.8)'); // Deeper Orange

      ctx.strokeStyle = gradient;
      ctx.lineWidth = 2.5;

      // Combine volumes - use the louder of the two signals
      const combinedVolume = Math.max(micVolume, apiVolume);

      for (let i = 0; i < bars; ++i) {
        const variation = Math.sin(Date.now() / 300 + i * (Math.PI / (bars / 6)));
        // Drive animation with the combined volume
        const dynamicVolume = combinedVolume * (1 + variation * 0.4);

        let barLength = Math.max(minBarLength, dynamicVolume * maxBarLength);
        barLength = Math.min(barLength, maxBarLength);

        const startX = centerX + baseRadius * Math.cos(theta * i);
        const startY = centerY + baseRadius * Math.sin(theta * i);
        const endX = centerX + (baseRadius + barLength) * Math.cos(theta * i);
        const endY = centerY + (baseRadius + barLength) * Math.sin(theta * i);

        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);
        ctx.stroke();
      }
    };

    if (animationFrameId.current) {
      cancelAnimationFrame(animationFrameId.current);
    }
    draw();

    return () => {
       animationFrameId.current && cancelAnimationFrame(animationFrameId.current);
    }

  // Rerun effect if either volume changes or active state changes
  }, [micVolume, apiVolume, active]);


  return (
    <div className={cn(
      'audio-visualizer-container w-full h-full flex items-center justify-center',
      !active && 'opacity-50'
    )}>
       <canvas
         ref={canvasRef}
         width={300}
         height={300}
         className="block w-full h-full max-w-[300px] max-h-[300px]"
       />
    </div>
  );
};

export default AudioVisualizer;