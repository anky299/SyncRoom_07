'use client';

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Search, X, Radio, Music, User, ArrowRight, Play } from 'lucide-react';
import { MOCK_ROOMS, MOCK_TRACKS, MOCK_USERS, MockRoom, MockTrack, MockUser } from '@/lib/mockData';
import { useToast } from './ToastContext';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPlayTrack?: (track: MockTrack) => void;
}

export function SearchModal({ isOpen, onClose, onPlayTrack }: SearchModalProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'rooms' | 'songs' | 'users'>('all');

  const filteredResults = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) {
      return {
        rooms: MOCK_ROOMS.slice(0, 3),
        tracks: MOCK_TRACKS.slice(0, 3),
        users: MOCK_USERS.slice(0, 3),
      };
    }

    const rooms = MOCK_ROOMS.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.code.toLowerCase().includes(q) ||
        r.genre.toLowerCase().includes(q) ||
        r.tags.some((t) => t.toLowerCase().includes(q))
    );

    const tracks = MOCK_TRACKS.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.artist.toLowerCase().includes(q) ||
        t.genre.toLowerCase().includes(q)
    );

    const users = MOCK_USERS.filter(
      (u) =>
        u.username.toLowerCase().includes(q) ||
        u.displayName.toLowerCase().includes(q) ||
        u.topGenre.toLowerCase().includes(q)
    );

    return { rooms, tracks, users };
  }, [query]);

  const totalResults =
    filteredResults.rooms.length +
    filteredResults.tracks.length +
    filteredResults.users.length;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-black/80 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, y: -20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -20, scale: 0.98 }}
        className="w-full max-w-2xl bg-[#0D1224] border border-white/15 rounded-3xl p-6 shadow-[0_25px_60px_rgba(0,0,0,0.8)] text-white relative overflow-hidden"
      >
        {/* Search Header Input */}
        <div className="relative flex items-center gap-3 pb-4 border-b border-white/10">
          <Search className="w-5 h-5 text-[#8B5CF6] shrink-0" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search rooms, tracks, artists, or friends..."
            className="w-full bg-transparent text-sm md:text-base text-white placeholder-zinc-500 outline-none"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="p-1 text-zinc-400 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={onClose}
            className="text-xs px-2.5 py-1 bg-white/10 hover:bg-white/20 rounded-lg text-zinc-300 transition-colors cursor-pointer"
          >
            ESC
          </button>
        </div>

        {/* Tab Filters */}
        <div className="flex items-center gap-2 pt-3 pb-2 text-xs font-semibold text-zinc-400">
          {(['all', 'rooms', 'songs', 'users'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1.5 rounded-full capitalize transition-all cursor-pointer ${
                activeTab === tab
                  ? 'bg-[#8B5CF6] text-white shadow-[0_0_12px_rgba(139,92,246,0.4)]'
                  : 'hover:text-white hover:bg-white/5'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Results Container */}
        <div className="max-h-[380px] overflow-y-auto space-y-4 pt-2 pr-1 scrollbar-none">
          {totalResults === 0 ? (
            <div className="py-12 text-center text-zinc-500 space-y-2">
              <Search className="w-8 h-8 mx-auto stroke-[1.5] text-zinc-600" />
              <p className="text-sm font-semibold text-zinc-300">No results found</p>
              <p className="text-xs text-zinc-500">
                We couldn't find anything matching "{query}". Try a different keyword.
              </p>
            </div>
          ) : (
            <>
              {/* Rooms Section */}
              {(activeTab === 'all' || activeTab === 'rooms') &&
                filteredResults.rooms.length > 0 && (
                  <div className="space-y-2">
                    <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Radio className="w-3.5 h-3.5 text-[#22D3EE]" /> Rooms
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {filteredResults.rooms.map((room) => (
                        <div
                          key={room.id}
                          onClick={() => {
                            onClose();
                            router.push(`/room/${room.code}?username=Guest`);
                          }}
                          className="flex items-center justify-between p-3 bg-white/5 hover:bg-white/10 rounded-2xl border border-white/5 hover:border-[#22D3EE]/40 transition-all cursor-pointer group"
                        >
                          <div className="min-w-0 pr-2">
                            <h4 className="text-xs font-bold text-white truncate group-hover:text-[#22D3EE]">
                              {room.name}
                            </h4>
                            <p className="text-[10px] text-zinc-400 truncate">
                              @{room.hostUsername} • {room.listenersCount} listeners
                            </p>
                          </div>
                          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-[#22D3EE]/15 text-[#22D3EE] border border-[#22D3EE]/30">
                            {room.code}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              {/* Songs Section */}
              {(activeTab === 'all' || activeTab === 'songs') &&
                filteredResults.tracks.length > 0 && (
                  <div className="space-y-2">
                    <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Music className="w-3.5 h-3.5 text-[#8B5CF6]" /> Songs
                    </span>
                    <div className="space-y-1.5">
                      {filteredResults.tracks.map((track) => (
                        <div
                          key={track.id}
                          onClick={() => {
                            if (onPlayTrack) {
                              onPlayTrack(track);
                              showToast(`Now playing: ${track.title}`);
                              onClose();
                            }
                          }}
                          className="flex items-center justify-between p-2.5 bg-white/5 hover:bg-white/10 rounded-xl border border-white/5 hover:border-[#8B5CF6]/40 transition-all cursor-pointer group"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-9 h-9 rounded-lg overflow-hidden shrink-0 bg-zinc-800">
                              <img
                                src={track.coverUrl}
                                alt={track.title}
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <div className="min-w-0">
                              <h4 className="text-xs font-bold text-white truncate group-hover:text-[#A78BFA]">
                                {track.title}
                              </h4>
                              <p className="text-[10px] text-zinc-400 truncate">{track.artist}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-mono text-zinc-500">
                              {track.durationFormatted}
                            </span>
                            <span className="w-6 h-6 rounded-full bg-white/10 group-hover:bg-[#8B5CF6] group-hover:text-white flex items-center justify-center transition-colors">
                              <Play className="w-3 h-3 fill-current ml-0.5" />
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              {/* Users Section */}
              {(activeTab === 'all' || activeTab === 'users') &&
                filteredResults.users.length > 0 && (
                  <div className="space-y-2">
                    <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-[#FBBF24]" /> Users
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {filteredResults.users.map((user) => (
                        <div
                          key={user.id}
                          onClick={() => {
                            showToast(`Connected with @${user.username}`);
                          }}
                          className="flex items-center gap-3 p-2.5 bg-white/5 hover:bg-white/10 rounded-xl border border-white/5 transition-all cursor-pointer"
                        >
                          <div
                            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-black shrink-0"
                            style={{ backgroundColor: user.avatarColor }}
                          >
                            {user.username.charAt(0)}
                          </div>
                          <div className="min-w-0">
                            <h4 className="text-xs font-bold text-white truncate">
                              @{user.username}
                            </h4>
                            <p className="text-[10px] text-zinc-400 truncate">{user.status}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
