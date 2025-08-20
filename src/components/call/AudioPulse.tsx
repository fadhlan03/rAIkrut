"use client";

// import styles from "./audio-pulse.module.scss"; // Removed SCSS module import
import React from "react";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils"; // Import cn
// import c from "classnames"; // Removed classnames import

const lineCount = 3;

export type AudioPulseProps = {
  active: boolean;
  volume: number;
  hover?: boolean;
};

export default function AudioPulse({ active, volume, hover }: AudioPulseProps) {
  const lines = useRef<HTMLDivElement[]>([]);

  useEffect(() => {
    let timeout: number | null = null;
    const update = () => {
      lines.current.forEach(
        (line, i) =>
        (line.style.height = `${Math.min(
          24,
          4 + volume * (i === 1 ? 400 : 60),
        )}px`),
      );
      timeout = window.setTimeout(update, 100);
    };

    update();

    return () => clearTimeout((timeout as number)!);
  }, [volume]);

  return (
    <div className={cn(
      "audio-pulse", // Base class if needed for global styles
      "flex w-6 justify-evenly items-center h-1", // Flex, width, justify, align, height
      "transition-opacity", // Opacity transition
      !active && "opacity-50", // Less opaque when inactive
      active && "opacity-100" // Fully opaque when active
      // hover state is handled by the animation class on children
    )}>
      {Array(lineCount)
        .fill(null)
        .map((_, i) => (
          <div
            key={i}
            ref={(el) => { if (el) lines.current[i] = el; }}
            className={cn(
              "rounded-full w-1 min-h-1 transition-[height] duration-100", // Base styles for lines
              active ? "bg-foreground" : "bg-muted-foreground", // Active/inactive color - adjust if needed
              hover && "animate-audio-pulse-hover" // Apply animation class on hover
            )}
            style={{ animationDelay: `${i * 133}ms` }} // Keep animation delay
          />
        ))}

      {/* Global styles for the hover animation keyframes */}
      <style jsx global>{`
        @keyframes audio-pulse-hover-animation {
          from {
            transform: translateY(0);
          }
          to {
            transform: translateY(-3.5px);
          }
        }
        .animate-audio-pulse-hover {
          animation: audio-pulse-hover-animation 1.4s infinite alternate ease-in-out;
        }
      `}</style>
    </div>
  );
}
