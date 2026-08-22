'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useTheme } from '@/context/ThemeContext';

interface EqualizerHeroProps {
  className?: string;
  accentColor?: string;
}

export default function EqualizerHero({
  className = 'w-72 h-72 md:w-96 md:h-96',
  accentColor,
}: EqualizerHeroProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const { activeTheme } = useTheme();
  const [reducedMotion, setReducedMotion] = useState(false);

  // Check prefers-reduced-motion
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mediaQuery.matches);

    const handleChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  // Direct HTML5 Canvas 2D Render Loop (Zero React State Overhead = 60-120 FPS Smooth)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let startTime = Date.now();

    const NUM_BARS = 32;

    const render = () => {
      const width = canvas.width;
      const height = canvas.height;
      const elapsed = (Date.now() - startTime) / 1000;

      // 1. Clear Canvas
      ctx.clearRect(0, 0, width, height);

      // 2. Fetch Active Theme Colors directly from CSS variables
      const computed = window.getComputedStyle(document.documentElement);
      const mainColor = accentColor || computed.getPropertyValue('--theme-accent').trim() || activeTheme.accent || '#00F0FF';
      const glowColor = computed.getPropertyValue('--theme-glow').trim() || 'rgba(0,240,255,0.4)';

      // 3. Create Multi-stop Theme Gradient Fill
      const gradient = ctx.createLinearGradient(0, 0, width, 0);
      gradient.addColorStop(0, mainColor);
      gradient.addColorStop(0.5, '#FFFFFF');
      gradient.addColorStop(1, mainColor);

      // Bar dimensions
      const totalWidth = width * 0.85;
      const startX = (width - totalWidth) / 2;
      const barWidth = totalWidth / NUM_BARS - 3;
      const centerY = height * 0.48;

      ctx.save();
      ctx.shadowColor = glowColor;
      ctx.shadowBlur = 15;
      ctx.fillStyle = gradient;

      // 4. Draw Main Equalizer Bars
      for (let i = 0; i < NUM_BARS; i++) {
        let barHeight = 25;

        if (!reducedMotion) {
          // Ultra-smooth multi-frequency sine wave calculation
          const wave1 = Math.sin(elapsed * 4.2 + i * 0.22) * 32;
          const wave2 = Math.cos(elapsed * 6.5 - i * 0.15) * 22;
          const wave3 = Math.sin(elapsed * 2.5 + i * 0.35) * 18;

          // Symmetrical curve envelope
          const centerDist = Math.abs(i - (NUM_BARS - 1) / 2) / ((NUM_BARS - 1) / 2);
          const envelope = Math.cos(centerDist * Math.PI * 0.42);

          barHeight = Math.max(12, (40 + wave1 + wave2 + wave3) * envelope);
        } else {
          // Static balanced frame for reduced motion
          const centerDist = Math.abs(i - (NUM_BARS - 1) / 2) / ((NUM_BARS - 1) / 2);
          barHeight = 20 + Math.cos(centerDist * Math.PI * 0.5) * 60;
        }

        const x = startX + i * (barWidth + 3);
        const y = centerY - barHeight / 2;

        // Draw Rounded Rect Bar
        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(x, y, barWidth, barHeight, 3);
        } else {
          ctx.rect(x, y, barWidth, barHeight);
        }
        ctx.fill();
      }
      ctx.restore();

      // 5. Draw Faint Reflection Mirror fading into Dais Platform
      ctx.save();
      ctx.globalAlpha = 0.25;
      ctx.fillStyle = mainColor;

      for (let i = 0; i < NUM_BARS; i++) {
        let barHeight = 25;
        if (!reducedMotion) {
          const wave1 = Math.sin(elapsed * 4.2 + i * 0.22) * 32;
          const wave2 = Math.cos(elapsed * 6.5 - i * 0.15) * 22;
          const wave3 = Math.sin(elapsed * 2.5 + i * 0.35) * 18;
          const centerDist = Math.abs(i - (NUM_BARS - 1) / 2) / ((NUM_BARS - 1) / 2);
          const envelope = Math.cos(centerDist * Math.PI * 0.42);
          barHeight = Math.max(12, (40 + wave1 + wave2 + wave3) * envelope);
        } else {
          const centerDist = Math.abs(i - (NUM_BARS - 1) / 2) / ((NUM_BARS - 1) / 2);
          barHeight = 20 + Math.cos(centerDist * Math.PI * 0.5) * 60;
        }

        const x = startX + i * (barWidth + 3);
        const refHeight = barHeight * 0.5;
        const y = centerY + barHeight / 2 + 10;

        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(x, y, barWidth, refHeight, 2);
        } else {
          ctx.rect(x, y, barWidth, refHeight);
        }
        ctx.fill();
      }
      ctx.restore();

      if (!reducedMotion) {
        animationFrameId = requestAnimationFrame(render);
      }
    };

    render();

    return () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
    };
  }, [reducedMotion, accentColor, activeTheme]);

  // Handle Resize for Canvas Crisp Resolution
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = container.clientWidth || 360;
      const height = container.clientHeight || 360;

      canvas.width = width * dpr;
      canvas.height = height * dpr;
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const activeAccent = accentColor || activeTheme?.accent || 'var(--theme-accent, #00F0FF)';

  return (
    <div
      ref={containerRef}
      className={`relative flex items-center justify-center select-none ${className}`}
    >
      {/* BACKGROUND DAIS PLATFORM & CONCENTRIC PULSE RINGS */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
        {/* Radial Theme Glow Light */}
        <div
          className="w-64 h-64 md:w-80 md:h-80 rounded-full blur-3xl opacity-35 transition-all duration-700"
          style={{ backgroundColor: activeAccent }}
        />

        {/* Concentric Pulse Rings */}
        {!reducedMotion && (
          <>
            <div
              className="absolute w-48 h-48 md:w-60 md:h-60 rounded-full border border-dashed opacity-50 animate-ping transition-colors duration-700"
              style={{ borderColor: activeAccent, animationDuration: '3.5s' }}
            />
            <div
              className="absolute w-60 h-60 md:w-76 md:h-76 rounded-full border opacity-30 animate-pulse transition-colors duration-700"
              style={{ borderColor: activeAccent, animationDuration: '2.5s' }}
            />
          </>
        )}

        {/* Dais Pedestal Disk */}
        <div
          className="absolute bottom-4 w-56 h-14 md:w-72 md:h-16 rounded-[100%] border-2 transition-all duration-700 shadow-[0_0_30px_rgba(0,0,0,0.9)]"
          style={{
            borderColor: activeAccent,
            backgroundColor: 'rgba(10, 20, 45, 0.85)',
            boxShadow: `0 0 35px ${activeAccent}40`,
          }}
        >
          <div
            className="w-full h-full rounded-[100%] border opacity-50 transition-colors duration-700"
            style={{ borderColor: activeAccent }}
          />
        </div>
      </div>

      {/* BUTTER-SMOOTH CANVAS EQUALIZER */}
      <canvas
        ref={canvasRef}
        className="relative z-10 w-full h-full pointer-events-none"
      />
    </div>
  );
}
