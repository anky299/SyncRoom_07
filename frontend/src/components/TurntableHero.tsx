'use client';

import React, { useState, useEffect, useRef, memo } from 'react';
import { Music } from 'lucide-react';

interface TurntableHeroProps {
  isPlaying: boolean;
  playbackStatus?: 'READY' | 'PLAYING' | 'PAUSED' | 'BUFFERING' | 'ERROR';
  coverUrl?: string;
  trackTitle?: string;
  trackArtist?: string;
  onTogglePlay?: () => void;
  className?: string;
  progressPercent?: number;
}

// Geometric constants for tonearm pivot & angles
const REST_ANGLE = -2.0; // Rest cradle angle (deg)
const PLAY_ANGLE = 26.0; // Outer groove playing angle (deg)

function TurntableHeroComponent({
  isPlaying,
  playbackStatus = 'READY',
  coverUrl,
  trackTitle = 'Golden Hour',
  trackArtist = 'Audiophile Session',
  onTogglePlay,
  className = '',
  progressPercent = 0,
}: TurntableHeroProps) {
  const [imageError, setImageError] = useState(false);
  const [activeCover, setActiveCover] = useState<string | undefined>(coverUrl);

  // Turntable DOM references
  const vinylDiscRef = useRef<HTMLDivElement | null>(null);

  // Update cover when track changes
  useEffect(() => {
    setImageError(false);
    setActiveCover(coverUrl);
  }, [coverUrl]);

  // -------------------------------------------------------------
  // REALISTIC 3-PHASE TONEARM STATE MACHINE
  // Lift -> Radial Swing -> Gentle Needle Drop
  // Pause Lift -> Swing Out -> Settle in Rest Cradle
  // -------------------------------------------------------------
  const [tonearmAngle, setTonearmAngle] = useState<number>(REST_ANGLE);
  const [isArmLifted, setIsArmLifted] = useState<boolean>(false);
  const [stylusContact, setStylusContact] = useState<boolean>(false);
  const tonearmTimersRef = useRef<NodeJS.Timeout[]>([]);

  // Realistic needle progression across record grooves
  const targetPlayAngle = PLAY_ANGLE + Math.min(8.0, Math.max(0, (progressPercent / 100) * 8.0));

  const clearTonearmTimers = () => {
    tonearmTimersRef.current.forEach((t) => clearTimeout(t));
    tonearmTimersRef.current = [];
  };

  useEffect(() => {
    clearTonearmTimers();

    if (isPlaying) {
      // PHASE 1: Cue Lift immediately off cradle
      setIsArmLifted(true);
      setStylusContact(false);

      // PHASE 2: After slight cue lift delay (120ms), swing smoothly inward onto record
      const swingTimer = setTimeout(() => {
        setTonearmAngle(targetPlayAngle);
      }, 120);

      // PHASE 3: After arm completes radial swing (800ms), gently lower stylus onto groove
      const dropTimer = setTimeout(() => {
        setIsArmLifted(false);
      }, 800);

      // PHASE 4: Stylus touches surface with micro contact indicator (1050ms)
      const contactTimer = setTimeout(() => {
        setStylusContact(true);
      }, 1050);

      tonearmTimersRef.current = [swingTimer, dropTimer, contactTimer];
    } else {
      // PAUSE PHASE 1: Cue Lift immediately off record
      setIsArmLifted(true);
      setStylusContact(false);

      // PAUSE PHASE 2: After cue lift (120ms), swing smoothly outward to rest cradle
      const returnTimer = setTimeout(() => {
        setTonearmAngle(REST_ANGLE);
      }, 120);

      // PAUSE PHASE 3: After reaching cradle (780ms), lower arm into rest post
      const settleTimer = setTimeout(() => {
        setIsArmLifted(false);
      }, 780);

      tonearmTimersRef.current = [returnTimer, settleTimer];
    }

    return () => clearTonearmTimers();
  }, [isPlaying]);

  // While playing on the record, smoothly track groove position
  useEffect(() => {
    if (isPlaying && stylusContact && !isArmLifted) {
      setTonearmAngle(targetPlayAngle);
    }
  }, [isPlaying, stylusContact, isArmLifted, targetPlayAngle]);

  return (
    <div
      onClick={onTogglePlay}
      className={`relative flex items-center justify-center select-none cursor-pointer group transition-transform duration-500 ${className}`}
      title={isPlaying ? 'Click turntable to Pause' : 'Click turntable to Play'}
    >
      {/* Gentle Ambient Acoustic Glow behind Turntable Plinth */}
      <div className="absolute -inset-4 sm:-inset-6 rounded-[48px] bg-gradient-to-b from-[#C5A46D]/[0.07] via-[#8D9A86]/[0.03] to-transparent blur-2xl pointer-events-none transition-opacity duration-700 opacity-90" />

      {/* ============================================================
          PRECISION AUDIOPHILE TURNTABLE PLINTH (CHASSIS)
          High-end matte dark slate & brushed graphite with champagne accents
          ============================================================ */}
      <div
        className="relative w-[310px] h-[310px] sm:w-[370px] sm:h-[370px] lg:w-[410px] lg:h-[410px] rounded-[34px] sm:rounded-[38px] p-4 sm:p-5 flex items-center justify-center transition-all duration-300"
        style={{
          background: 'linear-gradient(145deg, #24282C 0%, #1D2023 45%, #151719 100%)',
          boxShadow: `
            0 35px 70px -15px rgba(0, 0, 0, 0.95),
            0 15px 30px -8px rgba(0, 0, 0, 0.8),
            inset 0 1px 1px rgba(242, 238, 229, 0.15),
            inset 0 0 0 1px rgba(242, 238, 229, 0.06),
            inset 0 0 35px rgba(0, 0, 0, 0.6)
          `,
        }}
      >
        {/* Subtle Plinth Edge Micro-Chamfer Highlight */}
        <div className="absolute inset-0 rounded-[34px] sm:rounded-[38px] border border-[#F2EEE5]/[0.08] pointer-events-none" />

        {/* 4 Heavy Brushed Champagne Brass & Damping Rubber Isolation Feet */}
        <div className="absolute top-3.5 left-3.5 w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full border border-black/50 flex items-center justify-center pointer-events-none shadow-sm"
          style={{ background: 'radial-gradient(circle at 35% 30%, #E3CCA3 0%, #C5A46D 55%, #8C7043 100%)' }}
        >
          <div className="w-1.5 h-1.5 rounded-full bg-[#151719]" />
        </div>
        <div className="absolute top-3.5 right-3.5 w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full border border-black/50 flex items-center justify-center pointer-events-none shadow-sm"
          style={{ background: 'radial-gradient(circle at 35% 30%, #E3CCA3 0%, #C5A46D 55%, #8C7043 100%)' }}
        >
          <div className="w-1.5 h-1.5 rounded-full bg-[#151719]" />
        </div>
        <div className="absolute bottom-3.5 left-3.5 w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full border border-black/50 flex items-center justify-center pointer-events-none shadow-sm"
          style={{ background: 'radial-gradient(circle at 35% 30%, #E3CCA3 0%, #C5A46D 55%, #8C7043 100%)' }}
        >
          <div className="w-1.5 h-1.5 rounded-full bg-[#151719]" />
        </div>
        <div className="absolute bottom-3.5 right-3.5 w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full border border-black/50 flex items-center justify-center pointer-events-none shadow-sm"
          style={{ background: 'radial-gradient(circle at 35% 30%, #E3CCA3 0%, #C5A46D 55%, #8C7043 100%)' }}
        >
          <div className="w-1.5 h-1.5 rounded-full bg-[#151719]" />
        </div>

        {/* Minimalist Audiophile Engraved Badge: Direct Drive 33⅓ RPM */}
        <div className="absolute bottom-4 left-5 sm:left-6 flex items-center gap-2 pointer-events-none">
          <span
            className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full border border-black/60 transition-all duration-500 ${
              isPlaying
                ? 'bg-[#C5A46D] shadow-[0_0_8px_#C5A46D]'
                : 'bg-[#40454A]'
            }`}
          />
          <span className="text-[8px] sm:text-[9px] font-mono tracking-widest text-[#A5A5A0] font-semibold uppercase">
            33⅓ RPM • DIRECT DRIVE
          </span>
        </div>

        {/* Power / Speed Rotary Dial Accent at Bottom Right */}
        <div className="absolute bottom-4 right-5 sm:right-6 flex items-center gap-1.5 pointer-events-none">
          <span className="text-[7.5px] sm:text-[8px] font-mono tracking-wider font-semibold uppercase text-[#A5A5A0]">
            {playbackStatus}
          </span>
          <div className="w-3.5 h-3.5 rounded-full bg-gradient-to-b from-[#2A2E33] to-[#17191C] border border-[#F2EEE5]/10 flex items-center justify-center shadow-inner">
            <div className={`w-1.5 h-1.5 rounded-full transition-colors ${
              playbackStatus === 'PLAYING'
                ? 'bg-[#8D9A86] shadow-[0_0_6px_#8D9A86]'
                : playbackStatus === 'BUFFERING'
                ? 'bg-[#C5A46D] animate-ping'
                : playbackStatus === 'ERROR'
                ? 'bg-red-400'
                : 'bg-[#50555C]'
            }`} />
          </div>
        </div>

        {/* ============================================================
            RECESSED PLATTER WELL WITH CNC BEVELED RIM
            ============================================================ */}
        <div
          className="relative w-[250px] h-[250px] sm:w-[295px] sm:h-[295px] lg:w-[325px] lg:h-[325px] rounded-full flex items-center justify-center p-2"
          style={{
            background: 'radial-gradient(circle at center, #0F1012 40%, #17191B 80%, #25292D 100%)',
            boxShadow: `
              inset 0 10px 24px rgba(0, 0, 0, 0.95),
              inset 0 0 14px rgba(0, 0, 0, 0.9),
              0 1px 1px rgba(242, 238, 229, 0.08),
              0 0 0 1.5px rgba(242, 238, 229, 0.05)
            `,
          }}
        >
          {/* Heavy Machined Aluminum Platter with Strobe Dot Calibration Rim */}
          <div
            className="relative w-full h-full rounded-full flex items-center justify-center p-2"
            style={{
              background: `
                repeating-conic-gradient(from 0deg at 50% 50%, #30353A 0deg, #1C1F22 3.5deg, #30353A 7deg),
                radial-gradient(circle at center, #141618 60%, #24282D 88%, #4A5159 99%, #68717B 100%)
              `,
              boxShadow: `
                0 6px 20px rgba(0, 0, 0, 0.85),
                0 0 0 2px #101214,
                0 0 0 3.5px rgba(197, 164, 109, 0.3)
              `,
            }}
          >
            {/* Damped Anti-static Matte Silicone Slipmat */}
            <div
              className="relative w-full h-full rounded-full flex items-center justify-center p-1"
              style={{
                background: 'radial-gradient(circle at center, #111315 0%, #16181B 50%, #0E0F11 100%)',
                boxShadow: 'inset 0 0 14px rgba(0, 0, 0, 0.92)',
              }}
            >
              {/* ============================================================
                  DEEP OBSIDIAN 180g AUDIOPHILE VINYL RECORD
                  Rotates via continuous physical velocity controller
                  ============================================================ */}
              <div
                ref={vinylDiscRef}
                id="vinylDisc"
                className={`relative w-full h-full rounded-full flex items-center justify-center vinyl-record ${
                  isPlaying ? 'is-playing' : 'is-paused'
                }`}
                style={{
                  transformOrigin: '50% 50%',
                  background: `
                    radial-gradient(circle at center,
                      #151719 0%,
                      #0B0C0E 15%,
                      #181A1D 16%,
                      #090A0B 19%,
                      #151719 22%,
                      #0B0C0E 25%,
                      #191C1F 29%,
                      #0A0B0C 32%,
                      #1C1F23 37%,
                      #090A0C 40%,
                      #181A1D 44%,
                      #0A0B0C 48%,
                      #1C1F23 53%,
                      #090A0C 56%,
                      #181A1D 61%,
                      #0A0B0C 64%,
                      #1C1F23 70%,
                      #08090A 73%,
                      #191C1F 79%,
                      #090A0C 82%,
                      #1C1F23 88%,
                      #0A0B0C 91%,
                      #181A1D 96%,
                      #08090B 100%
                    )
                  `,
                  boxShadow: `
                    inset 0 0 20px rgba(0, 0, 0, 0.95),
                    0 14px 35px rgba(0, 0, 0, 0.9),
                    0 0 25px rgba(197, 164, 109, 0.1)
                  `,
                }}
              >
                {/* Dual Anisotropic Sunburst Sheen - Catches ambient studio light */}
                <div
                  className="absolute inset-0 rounded-full pointer-events-none opacity-85"
                  style={{
                    background: `
                      conic-gradient(
                        from 32deg at 50% 50%,
                        rgba(242, 238, 229, 0.20) 0deg,
                        rgba(197, 164, 109, 0.04) 24deg,
                        transparent 50deg,
                        rgba(242, 238, 229, 0.06) 115deg,
                        rgba(242, 238, 229, 0.22) 180deg,
                        rgba(197, 164, 109, 0.04) 204deg,
                        transparent 230deg,
                        rgba(242, 238, 229, 0.06) 295deg,
                        rgba(242, 238, 229, 0.20) 360deg
                      )
                    `,
                    mixBlendMode: 'screen',
                  }}
                />

                {/* Concentric Run-Out Spiral Grooves */}
                <div className="absolute inset-0 rounded-full border-[14px] sm:border-[16px] border-black/40 pointer-events-none" />
                <div className="absolute w-[120px] h-[120px] sm:w-[136px] sm:h-[136px] rounded-full border border-white/[0.04] pointer-events-none" />

                {/* Center Label Framed by Muted Champagne Gold Ring */}
                <div
                  className="relative w-[100px] h-[100px] sm:w-[116px] sm:h-[116px] rounded-full overflow-hidden flex items-center justify-center bg-[#181A1D]"
                  style={{
                    border: '2.5px solid #C5A46D',
                    boxShadow: 'inset 0 2px 10px rgba(0, 0, 0, 0.95), 0 0 10px rgba(197, 164, 109, 0.2)',
                  }}
                >
                  {/* Dynamic Album Artwork */}
                  {activeCover && !imageError ? (
                    <img
                      src={activeCover}
                      alt={trackTitle}
                      onError={() => setImageError(true)}
                      className="absolute inset-0 w-full h-full object-cover filter brightness-[1.02] contrast-105"
                    />
                  ) : (
                    <div
                      className="absolute inset-0"
                      style={{
                        background: 'linear-gradient(135deg, #202326 0%, #292D30 50%, #151719 100%)',
                      }}
                    />
                  )}

                  {/* Dark Vignette Overlay for Label Readability */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-black/50" />

                  {/* Micro Vinyl Track Label Details */}
                  <div className="relative z-10 flex flex-col items-center justify-center pointer-events-none text-center px-1">
                    <div className="w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-black/60 backdrop-blur-sm border border-[#C5A46D]/40 flex items-center justify-center text-[#C5A46D] shadow-md mb-0.5">
                      <Music className="w-2 sm:w-2.5 h-2 sm:h-2.5" />
                    </div>
                    <span className="text-[7.5px] sm:text-[8px] font-serif text-[#F2EEE5] font-bold tracking-wider leading-none drop-shadow max-w-[80px] sm:max-w-[90px] truncate">
                      {trackTitle.toUpperCase()}
                    </span>
                    <span className="text-[6px] sm:text-[6.5px] text-[#C5A46D]/90 font-mono tracking-widest leading-none mt-0.5 uppercase">
                      AUDIOPHILE STEREO
                    </span>
                  </div>
                </div>

                {/* Polished Champagne-Gold Spindle & Heavy Record Clamp */}
                <div
                  className="absolute w-4 h-4 rounded-full shadow-[0_0_8px_rgba(0,0,0,0.95)] pointer-events-none z-20 flex items-center justify-center"
                  style={{
                    background: 'radial-gradient(circle at 35% 30%, #E3CCA3 0%, #C5A46D 55%, #7A5F35 100%)',
                    border: '1px solid #5A4322',
                  }}
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-[#151719] border border-[#C5A46D]/70" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ============================================================
            AUDIOPHILE MECHANICAL TONEARM ASSEMBLY
            Realistic Pivot, Gimbal Housing, Wand, Headshell & Rest Cradle
            ============================================================ */}
        <div
          className="absolute right-3 sm:right-4 top-3 sm:top-4 w-[105px] sm:w-[115px] h-[240px] sm:h-[265px] pointer-events-none z-30"
          id="tonearmContainer"
        >
          {/* Precision Dual-Pivot Gimbal Base Tower */}
          <div
            className="absolute right-2 top-2 w-13 h-13 sm:w-15 sm:h-15 rounded-full flex items-center justify-center shadow-2xl"
            style={{
              background: 'linear-gradient(135deg, #2B3035 0%, #1B1E21 60%, #121416 100%)',
              border: '1.5px solid rgba(197, 164, 109, 0.35)',
              boxShadow: '0 10px 20px rgba(0, 0, 0, 0.85), inset 0 1px 1px rgba(242, 238, 229, 0.2)',
            }}
          >
            {/* Brushed Metallic Gimbal Ring */}
            <div
              className="w-7 h-7 sm:w-8 sm:h-8 rounded-full border border-[#C5A46D]/50 flex items-center justify-center shadow-inner"
              style={{
                background: 'linear-gradient(135deg, #3A3F45 0%, #202326 60%, #151719 100%)',
              }}
            >
              {/* Precision Bearing Pin */}
              <div className="w-3 h-3 sm:w-3.5 sm:h-3.5 rounded-full bg-gradient-to-br from-[#151719] to-[#25282B] border border-[#C5A46D]/60 flex items-center justify-center">
                <div className="w-1 h-1 rounded-full bg-[#C5A46D]" />
              </div>
            </div>

            {/* Cueing Lever Arm */}
            <div
              className="absolute -left-2 top-3 w-3.5 h-1.5 rounded-full shadow-sm"
              style={{
                background: isArmLifted
                  ? 'linear-gradient(90deg, #E3CCA3 0%, #C5A46D 100%)'
                  : 'linear-gradient(90deg, #8A7045 0%, #5E4C2E 100%)',
                transform: isArmLifted ? 'rotate(-25deg)' : 'rotate(0deg)',
                transition: 'transform 0.25s ease, background 0.25s ease',
              }}
            />

            {/* Anti-skate Calibrated Dial */}
            <div className="absolute bottom-1 right-2 w-2.5 h-2.5 rounded-full bg-[#181A1C] border border-[#C5A46D]/30" />
          </div>

          {/* Animated Dynamic Tonearm Wand, Counterweight & Cartridge
              Rotates precisely around the Gimbal Pivot Point */}
          <div
            id="tonearmAssemblyInner"
            className={`absolute right-[19px] sm:right-[21px] top-[19px] sm:top-[21px] w-[64px] sm:w-[68px] h-[205px] sm:h-[225px] tonearm-assembly-inner ${
              isPlaying ? 'tonearm-playing' : 'tonearm-paused'
            }`}
            style={{
              transformOrigin: '24px 24px',
              transform: `
                rotate(${tonearmAngle}deg)
                ${isArmLifted ? 'translateY(-5px) scale(1.025)' : 'translateY(0px) scale(1)'}
              `,
              filter: isArmLifted
                ? 'drop-shadow(-14px 22px 18px rgba(0,0,0,0.85))'
                : stylusContact
                ? 'drop-shadow(-4px 8px 10px rgba(0,0,0,0.72))'
                : 'drop-shadow(-8px 14px 14px rgba(0,0,0,0.8))',
              transition: isArmLifted
                ? 'transform 0.4s cubic-bezier(0.25, 1, 0.45, 1), filter 0.3s ease'
                : 'transform 0.85s cubic-bezier(0.33, 1, 0.68, 1), filter 0.4s ease',
            }}
          >
            {/* Stainless Steel / Champagne Calibrated Counterweight at Rear */}
            <div
              className="absolute -top-3 left-[9px] w-6 sm:w-6.5 h-4.5 sm:h-5 rounded-md border border-[#F2EEE5]/20 shadow-lg flex flex-col justify-center items-center"
              style={{
                background: 'linear-gradient(90deg, #202326 0%, #454B52 45%, #606770 55%, #292D30 100%)',
              }}
            >
              <div className="w-full h-[1px] bg-black/80 my-0.5" />
              <div className="w-full h-[1px] bg-[#C5A46D]/60" />
            </div>

            {/* Precision Carbon Fiber & Brushed Titanium Tonearm Tube */}
            <div
              className="absolute top-2 left-5 sm:left-5.5 w-2 sm:w-2.5 h-43 sm:h-47 rounded-full shadow-md"
              style={{
                background: 'linear-gradient(90deg, #292D30 0%, #5E6770 30%, #D8DFE5 50%, #5E6770 70%, #1D2023 100%)',
              }}
            />

            {/* Angled Audiophile Headshell & High-End Phono Cartridge */}
            <div
              className="absolute bottom-0 left-1 sm:left-1.5 w-4.5 sm:w-5.5 h-8.5 sm:h-9.5 rounded-sm transform rotate-14 shadow-2xl flex flex-col justify-between items-center py-1"
              style={{
                background: 'linear-gradient(180deg, #3A3F45 0%, #1E2124 50%, #0F1012 100%)',
                border: '1px solid rgba(197, 164, 109, 0.5)',
              }}
            >
              {/* Gold Cartridge Mount Connector */}
              <div className="w-2 sm:w-2.5 h-1 bg-[#C5A46D] rounded-sm shadow-sm" />

              {/* Diamond Stylus Cantilever & Micro Indicator */}
              <div
                id="stylusLightGlow"
                className="w-1.5 h-1.5 rounded-full transition-all duration-300"
                style={{
                  backgroundColor: stylusContact ? '#C5A46D' : '#454B52',
                  boxShadow: stylusContact ? '0 0 10px 2px rgba(197, 164, 109, 0.85)' : 'none',
                  opacity: stylusContact ? 1 : 0.25,
                }}
              />
            </div>
          </div>

          {/* Mechanical Arm Rest Cradle / Clip Post
              Tonearm sits here when paused or stopped */}
          <div
            className="absolute right-5 top-27 sm:top-31 w-3.5 h-6 rounded-r-lg border-r-2 border-y border-[#F2EEE5]/15 flex items-center justify-end pr-0.5 shadow-md"
            style={{
              background: 'linear-gradient(90deg, #181A1C 0%, #25282B 100%)',
            }}
          >
            <div
              className="w-1.5 h-2.5 rounded-full"
              style={{
                backgroundColor: !isPlaying ? 'rgba(197, 164, 109, 0.7)' : 'rgba(197, 164, 109, 0.2)',
                boxShadow: !isPlaying ? '0 0 6px rgba(197, 164, 109, 0.5)' : 'none',
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default memo(TurntableHeroComponent);
