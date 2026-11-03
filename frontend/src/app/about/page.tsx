'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Zap,
  Monitor,
  Lock,
  Radio,
  Music,
  Users,
  ShieldCheck,
  ChevronDown,
  Sparkles,
  Play,
  Layers,
} from 'lucide-react';
import { useToast } from '@/components/ToastContext';

export default function AboutPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const faqs = [
    {
      q: 'How does SyncRoom achieve sub-millisecond audio synchronization?',
      a: 'SyncRoom uses a distributed NTP-style clock synchronization protocol over WebSockets. Every connected client calculates network latency offset, allowing playback triggers to occur in precise frame-rate synchronization across all listeners.',
    },
    {
      q: 'Do all listeners need a Spotify Premium or YouTube account?',
      a: 'No! SyncRoom supports uploaded audio files, direct streaming links, and multiple backends. If a room is playing uploaded tracks, anyone can join and listen freely with zero extra logins required.',
    },
    {
      q: 'Can I create private password-protected rooms?',
      a: 'Yes. When creating a room, toggle the "Private Room Password" option to generate an encrypted passcode that only your invited friends can use.',
    },
    {
      q: 'What audio formats are supported?',
      a: 'SyncRoom natively supports MP3, WAV, OGG, and M4A audio files up to 25MB per upload, alongside synchronized LRC lyric line visualizers.',
    },
  ];

  return (
    <div className="min-h-screen bg-[#060814] text-white flex flex-col selection:bg-[#F5A623] selection:text-black">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 bg-[#080C1B]/90 backdrop-blur-xl border-b border-white/10 px-6 md:px-12 py-4">
        <div className="max-w-[1440px] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/')}
              className="p-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full transition-colors cursor-pointer text-zinc-300 hover:text-white"
              title="Back to Home"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div
              onClick={() => router.push('/')}
              className="flex items-center gap-2.5 cursor-pointer"
            >
              <div className="flex items-center gap-[3px] h-5">
                <span className="w-[3px] h-3 bg-gradient-to-t from-[#8B5CF6] to-[#22D3EE] rounded-full" />
                <span className="w-[3px] h-5 bg-gradient-to-t from-[#8B5CF6] to-[#22D3EE] rounded-full" />
                <span className="w-[3px] h-2 bg-gradient-to-t from-[#8B5CF6] to-[#22D3EE] rounded-full" />
              </div>
              <span className="text-xl font-bold tracking-tight text-white">Syncroom</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/rooms')}
              className="px-4 py-2 text-xs font-semibold text-zinc-300 hover:text-white transition-colors cursor-pointer"
            >
              Explore Rooms
            </button>
            <button
              onClick={() => router.push('/?action=create')}
              className="px-4 py-2 text-xs font-bold text-[#060814] bg-gradient-to-r from-[#22D3EE] to-[#8B5CF6] rounded-full hover:opacity-90 transition-all cursor-pointer shadow-sm"
            >
              Create Room
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-[1200px] mx-auto w-full px-6 md:px-12 py-16 flex-grow space-y-16 text-left">
        {/* Header Hero */}
        <div className="space-y-4 max-w-3xl">
          <div className="flex items-center gap-2.5 text-xs font-bold text-[#A78BFA] uppercase tracking-widest">
            <Sparkles className="w-4 h-4 text-[#FBBF24]" />
            <span>About The Platform</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold text-white tracking-tight leading-tight">
            Music is better when shared without latency.
          </h1>
          <p className="text-base text-zinc-300 leading-relaxed">
            SyncRoom is built for friends, audiophiles, and creators who want to listen to music together across distances as if they were sitting in the exact same room.
          </p>
        </div>

        {/* Feature Columns Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-7 bg-[#0A0E1C]/80 border border-purple-500/20 rounded-3xl space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-[#8B5CF6]/15 border border-[#8B5CF6]/30 flex items-center justify-center text-[#A78BFA]">
              <Zap className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white">Ultra-Low Latency</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Proprietary clock drift compensation ensures that audio packets start and resume concurrently on every browser tab.
            </p>
          </div>

          <div className="p-7 bg-[#0A0E1C]/80 border border-purple-500/20 rounded-3xl space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-[#22D3EE]/15 border border-[#22D3EE]/30 flex items-center justify-center text-[#22D3EE]">
              <Layers className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white">Universal Sources</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Mix and match local uploads, collaborative queue upvoting, and streaming endpoints without leaving the room space.
            </p>
          </div>

          <div className="p-7 bg-[#0A0E1C]/80 border border-purple-500/20 rounded-3xl space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-[#FBBF24]/15 border border-[#FBBF24]/30 flex items-center justify-center text-[#FBBF24]">
              <Lock className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white">Private & Secure</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Rooms can be locked behind custom passcodes, with end-to-end socket messaging and zero invasive tracking.
            </p>
          </div>
        </div>

        {/* Interactive FAQ Section */}
        <div className="space-y-6 pt-6 border-t border-white/5">
          <div className="space-y-2">
            <h2 className="text-2xl md:text-3xl font-extrabold text-white">
              Frequently Asked Questions
            </h2>
            <p className="text-xs text-zinc-400">Everything you need to know about SyncRoom spaces.</p>
          </div>

          <div className="space-y-3">
            {faqs.map((faq, idx) => (
              <div
                key={idx}
                onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                className="bg-[#0A0E1C]/80 border border-white/10 rounded-2xl p-5 cursor-pointer transition-all hover:border-purple-500/40"
              >
                <div className="flex items-center justify-between gap-4">
                  <h4 className="text-sm font-bold text-white">{faq.q}</h4>
                  <ChevronDown
                    className={`w-4 h-4 text-zinc-400 transition-transform ${
                      openFaq === idx ? 'rotate-180 text-[#22D3EE]' : ''
                    }`}
                  />
                </div>
                {openFaq === idx && (
                  <p className="text-xs text-zinc-300 pt-3 leading-relaxed border-t border-white/5 mt-3">
                    {faq.a}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
