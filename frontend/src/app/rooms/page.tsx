'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  Radio,
  Search,
  Plus,
  Users,
  Lock,
  Unlock,
  Play,
  ArrowLeft,
  Filter,
  RefreshCw,
  AlertCircle,
  Music,
  Trash2,
  Loader2,
} from 'lucide-react';
import { safeFetchJson } from '@/lib/api';
import { useToast } from '@/components/ToastContext';
import { SearchModal } from '@/components/SearchModal';

const GENRES = ['All', 'Indie / Chill', 'Synthwave', 'Lo-Fi', 'Pop / Disco', 'R&B'];

export interface ActiveRoomItem {
  code: string;
  name: string;
  hostUsername: string;
  creatorUsername?: string;
  hostId?: string;
  isPrivate: boolean;
  listenersCount: number;
  currentTrack: {
    id?: string;
    title: string;
    artist: string;
    duration?: number;
    thumbnailUrl?: string;
    source?: string;
  } | null;
  isPlaying: boolean;
  theme: string;
  createdAt: number;
}

export default function RoomsExplorePage() {
  const router = useRouter();
  const { data: session } = useSession();
  const { showToast } = useToast();

  const currentUsername = (
    (session?.user as any)?.username ||
    session?.user?.name ||
    ''
  ).trim();
  const accessToken =
    (session as any)?.accessToken ||
    (session?.user as any)?.accessToken ||
    (session?.user as any)?.token ||
    '';

  const [rooms, setRooms] = useState<ActiveRoomItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedGenre, setSelectedGenre] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);

  // Quick Join Modal
  const [activeJoinRoom, setActiveJoinRoom] = useState<ActiveRoomItem | null>(null);
  const [joinUsername, setJoinUsername] = useState('');
  const [joinPassword, setJoinPassword] = useState('');

  // Delete Room Confirmation Modal (Host-Only)
  const [roomToDelete, setRoomToDelete] = useState<ActiveRoomItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Check if room belongs to the authenticated user (authoritative host)
  const isRoomOwner = (room: ActiveRoomItem): boolean => {
    if (!currentUsername) return false;
    const authoritativeHost = (room.hostUsername || '').trim().toLowerCase();
    const currentUser = currentUsername.trim().toLowerCase();
    return authoritativeHost === currentUser;
  };

  // Step 1: Trace real data during development (without exposing secrets)
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' && currentUsername) {
      console.log('[Explore Rooms Auth Trace]', {
        authenticatedUsername: currentUsername,
        authenticatedUserId: (session?.user as any)?.id || null,
        rooms: rooms.map((r) => ({
          code: r.code,
          hostUsername: r.hostUsername,
          creatorUsername: r.creatorUsername,
          hostId: r.hostId,
          isOwner: isRoomOwner(r),
        })),
      });
    }
  }, [currentUsername, session, rooms]);

  const fetchRooms = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    setError(null);
    try {
      const data = await safeFetchJson<ActiveRoomItem[]>('/api/rooms');
      setRooms(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error('Failed to load active rooms:', err);
      if (!isSilent) {
        setError(err.message || 'Unable to connect to SyncRoom server');
      }
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRooms();
    // Refresh room list every 12 seconds
    const interval = setInterval(() => {
      fetchRooms(true);
    }, 12000);
    return () => clearInterval(interval);
  }, [fetchRooms]);

  const filteredRooms = rooms.filter((room) => {
    const matchesGenre = selectedGenre === 'All' || (room.theme && room.theme.toLowerCase().includes(selectedGenre.toLowerCase()));
    const matchesQuery =
      !searchQuery ||
      room.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      room.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      room.hostUsername.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (room.creatorUsername && room.creatorUsername.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (room.currentTrack && (
        room.currentTrack.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        room.currentTrack.artist.toLowerCase().includes(searchQuery.toLowerCase())
      ));
    return matchesGenre && matchesQuery;
  });

  const handleJoinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeJoinRoom) return;
    const finalUser = joinUsername.trim() || currentUsername || 'Guest';
    let url = `/room/${activeJoinRoom.code}?username=${encodeURIComponent(finalUser)}`;
    if (activeJoinRoom.isPrivate && joinPassword) {
      url += `&password=${encodeURIComponent(joinPassword)}`;
    }
    showToast(`Entering ${activeJoinRoom.name}...`);
    router.push(url);
  };

  // Handle Confirmed Room Deletion (Host Only)
  const handleConfirmDelete = async () => {
    if (!roomToDelete) return;
    setIsDeleting(true);

    try {
      const headers: HeadersInit = accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
      await safeFetchJson(`/api/rooms/${encodeURIComponent(roomToDelete.code)}`, {
        method: 'DELETE',
        headers,
      });

      // 1. Remove the room from the Explore list immediately
      setRooms((prev) => prev.filter((r) => r.code !== roomToDelete.code));
      // 2. Close confirmation dialog
      setRoomToDelete(null);
      // 3. Show small success toast
      showToast('Room deleted successfully.');
    } catch (err: any) {
      console.error('Failed to delete room:', err);
      const status = err.status;
      const msg = (err.message || '').toLowerCase();

      if (status === 401 || msg.includes('401') || msg.includes('authentication')) {
        showToast('Please sign in to delete this room.');
      } else if (status === 403 || msg.includes('403') || msg.includes('host')) {
        showToast('Only the room host can delete this room.');
      } else if (status === 404 || msg.includes('404') || msg.includes('not found')) {
        showToast('This room no longer exists.');
        setRooms((prev) => prev.filter((r) => r.code !== roomToDelete.code));
        setRoomToDelete(null);
      } else {
        showToast('Could not delete the room. Please try again.');
      }
    } finally {
      setIsDeleting(false);
    }
  };

  const getRandomAvatarColor = (name: string) => {
    const colors = ['#00F0FF', '#FF5A5F', '#FFB703', '#8B5CF6', '#10B981', '#F43F5E'];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash += name.charCodeAt(i);
    return colors[Math.abs(hash) % colors.length];
  };

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
              onClick={() => setIsSearchModalOpen(true)}
              className="p-2 text-zinc-300 hover:text-white hover:bg-white/5 rounded-full transition-colors cursor-pointer"
            >
              <Search className="w-4 h-4" />
            </button>
            <button
              onClick={() => router.push('/?action=create')}
              className="px-4 py-2 text-xs font-bold text-[#060814] bg-gradient-to-r from-[#22D3EE] to-[#8B5CF6] rounded-full hover:opacity-90 transition-all cursor-pointer flex items-center gap-1.5 shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Room</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-[1440px] mx-auto w-full px-6 md:px-12 py-10 flex-grow space-y-8">
        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-4 border-b border-white/5">
          <div className="space-y-2 text-left">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#A78BFA]">
              <Radio className="w-4 h-4 text-[#22D3EE] animate-pulse" />
              <span>Live Listening Spaces</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight">
              Explore Active Rooms
            </h1>
            <p className="text-sm text-zinc-400 max-w-xl">
              Hop into any public room space to listen in real time with the host and fellow music lovers.
            </p>
          </div>

          {/* Search bar inside page + Refresh */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 bg-[#0E1428] border border-white/10 rounded-full px-4 py-2 w-full md:w-72">
              <Search className="w-4 h-4 text-zinc-400 shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter rooms by name, code, host..."
                className="bg-transparent text-xs text-white placeholder-zinc-500 outline-none w-full"
              />
            </div>
            <button
              onClick={() => fetchRooms()}
              className="p-2.5 bg-[#0E1428] hover:bg-white/10 border border-white/10 rounded-full text-zinc-400 hover:text-white transition-colors cursor-pointer"
              title="Refresh active rooms"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-[#22D3EE]' : ''}`} />
            </button>
          </div>
        </div>

        {/* Genre Pills Filter */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          <span className="text-xs font-semibold text-zinc-400 flex items-center gap-1 mr-1">
            <Filter className="w-3 h-3" /> Filter:
          </span>
          {GENRES.map((genre) => (
            <button
              key={genre}
              onClick={() => setSelectedGenre(genre)}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                selectedGenre === genre
                  ? 'bg-[#8B5CF6] text-white shadow-[0_0_15px_rgba(139,92,246,0.4)]'
                  : 'bg-[#0E1428] text-zinc-400 hover:text-white border border-white/5'
              }`}
            >
              {genre}
            </button>
          ))}
        </div>

        {/* Loading State */}
        {loading && rooms.length === 0 ? (
          <div className="py-24 text-center space-y-4">
            <div className="w-10 h-10 border-2 border-[#22D3EE] border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs text-zinc-400 font-mono">Scanning live public spaces...</p>
          </div>
        ) : error ? (
          /* Error State */
          <div className="py-16 text-center space-y-3 bg-[#0A0E1C]/60 rounded-3xl border border-red-500/20 p-6">
            <AlertCircle className="w-10 h-10 text-[#FF5A5F] mx-auto" />
            <h3 className="text-base font-bold text-white">Failed to load active rooms</h3>
            <p className="text-xs text-zinc-400 max-w-md mx-auto">{error}</p>
            <button
              onClick={() => fetchRooms()}
              className="mt-2 px-5 py-2 text-xs font-bold text-black bg-[#22D3EE] rounded-full hover:bg-white transition-colors cursor-pointer"
            >
              Retry Connection
            </button>
          </div>
        ) : filteredRooms.length === 0 ? (
          /* Empty State */
          <div className="py-20 text-center space-y-3 bg-[#0A0E1C]/60 rounded-3xl border border-white/5">
            <Radio className="w-10 h-10 text-zinc-600 mx-auto" />
            <h3 className="text-base font-bold text-zinc-300">
              {rooms.length === 0 ? 'No active public rooms' : 'No rooms match your filter'}
            </h3>
            <p className="text-xs text-zinc-500 max-w-sm mx-auto">
              {rooms.length === 0
                ? 'Be the first to create a live listening space and invite your friends!'
                : 'Try picking a different genre or searching for another room name.'}
            </p>
            <button
              onClick={() => router.push('/?action=create')}
              className="mt-2 px-5 py-2 text-xs font-bold text-[#060814] bg-[#FBBF24] rounded-full hover:bg-[#F59E0B] transition-colors cursor-pointer inline-flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" /> Create New Room
            </button>
          </div>
        ) : (
          /* Rooms Grid */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredRooms.map((room) => {
              const avatarColor = getRandomAvatarColor(room.hostUsername);
              const isOwner = isRoomOwner(room);

              return (
                <div
                  key={room.code}
                  className="bg-[#0A0E1C]/80 hover:bg-[#0D1326] border border-purple-500/20 hover:border-purple-500/50 rounded-3xl p-6 flex flex-col justify-between transition-all duration-300 shadow-[0_10px_30px_rgba(0,0,0,0.5)] group hover:-translate-y-1"
                >
                  <div className="space-y-4">
                    {/* Card Header: Host + Privacy Badge */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div
                          className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-black text-black select-none"
                          style={{ backgroundColor: avatarColor }}
                        >
                          {room.hostUsername.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-xs font-semibold text-zinc-300">
                          @{room.hostUsername}
                        </span>
                        {isOwner && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-mono-tech font-bold uppercase tracking-wider bg-[#22D3EE]/20 text-[#22D3EE] border border-[#22D3EE]/30">
                            Your Space
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {room.isPrivate ? (
                          <span className="flex items-center gap-1 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-pink-500/10 text-pink-400 border border-pink-500/20">
                            <Lock className="w-2.5 h-2.5" /> Private
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            <Unlock className="w-2.5 h-2.5" /> Public
                          </span>
                        )}
                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-[#22D3EE]/15 text-[#22D3EE] border border-[#22D3EE]/30">
                          {room.code}
                        </span>
                      </div>
                    </div>

                    {/* Room Title & Theme */}
                    <div className="space-y-1 text-left">
                      <h3 className="text-lg font-bold text-white tracking-tight group-hover:text-[#22D3EE] transition-colors">
                        {room.name}
                      </h3>
                      <p className="text-xs text-zinc-400 line-clamp-2 leading-relaxed">
                        Theme: <span className="text-zinc-300 font-medium">{room.theme || 'Ocean'}</span>
                      </p>
                    </div>

                    {/* Currently Playing Bar */}
                    <div className="p-3 bg-white/5 rounded-2xl flex items-center gap-3 border border-white/5">
                      <div className="w-9 h-9 rounded-lg overflow-hidden shrink-0 bg-zinc-800 relative flex items-center justify-center">
                        {room.currentTrack?.thumbnailUrl ? (
                          <img
                            src={room.currentTrack.thumbnailUrl}
                            alt={room.currentTrack.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Music className="w-4 h-4 text-[#22D3EE]" />
                        )}
                      </div>
                      <div className="min-w-0 flex-grow text-left">
                        <div className="flex items-center gap-1.5">
                          <p className="text-[10px] text-[#A78BFA] font-bold uppercase tracking-wider">
                            {room.isPlaying ? 'Now Playing' : 'Paused'}
                          </p>
                          {room.isPlaying && (
                            <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-ping" />
                          )}
                        </div>
                        <h4 className="text-xs font-bold text-white truncate">
                          {room.currentTrack ? room.currentTrack.title : 'No track queued'}
                        </h4>
                        <p className="text-[10px] text-zinc-400 truncate">
                          {room.currentTrack ? room.currentTrack.artist : 'Waiting for track'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Card Footer: Listeners + Action Buttons */}
                  <div className="flex items-center justify-between pt-5 mt-4 border-t border-white/10">
                    <div className="flex items-center gap-2 text-xs font-mono text-zinc-400">
                      <Users className="w-4 h-4 text-[#FBBF24]" />
                      <span>
                        {room.listenersCount} {room.listenersCount === 1 ? 'listener' : 'listeners'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setActiveJoinRoom(room)}
                        className="px-4 py-2 rounded-full bg-[#8B5CF6] hover:bg-[#7c3aed] text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-md cursor-pointer hover:scale-105"
                      >
                        <Play className="w-3 h-3 fill-current" />
                        <span>Join Space</span>
                      </button>

                      {/* Host-Only Delete Action Button */}
                      {isOwner && (
                        <button
                          type="button"
                          onClick={() => setRoomToDelete(room)}
                          title="Delete room"
                          className="px-3.5 py-2 rounded-full bg-red-500/15 hover:bg-red-500/25 text-red-400 hover:text-red-300 border border-red-500/30 hover:border-red-500/50 text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer hover:scale-105"
                          aria-label={`Delete ${room.name}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Delete</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Delete Room Confirmation Modal (Host-Only) */}
      {roomToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="w-full max-w-md bg-[#0D1224] border border-red-500/20 rounded-3xl p-7 relative shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <button
              onClick={() => !isDeleting && setRoomToDelete(null)}
              disabled={isDeleting}
              className="absolute top-5 right-5 text-zinc-400 hover:text-white text-xl font-bold cursor-pointer transition-colors disabled:opacity-50"
              aria-label="Close confirmation modal"
            >
              &times;
            </button>

            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-red-400">
                  Host Action
                </span>
                <h2 className="text-xl font-bold text-white">Delete this room?</h2>
              </div>
            </div>

            <div className="p-3.5 bg-black/40 border border-white/5 rounded-2xl space-y-1">
              <p className="text-sm font-bold text-white truncate">{roomToDelete.name}</p>
              <p className="text-[11px] font-mono text-zinc-400">
                Room Code: <span className="text-[#22D3EE] font-bold">{roomToDelete.code}</span>
              </p>
            </div>

            <p className="text-xs text-zinc-400 leading-relaxed">
              This will permanently remove the room from Explore and disconnect any users currently inside it.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setRoomToDelete(null)}
                disabled={isDeleting}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-zinc-400 hover:text-white hover:bg-white/5 border border-white/10 transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="px-4 py-2.5 rounded-xl text-xs font-extrabold text-white bg-red-600 hover:bg-red-500 transition-all shadow-lg shadow-red-600/30 cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                <span>{isDeleting ? 'Deleting Room...' : 'Delete Room'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Join Dialog Modal */}
      {activeJoinRoom && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="w-full max-w-md bg-[#0D1224] border border-white/15 rounded-3xl p-7 relative shadow-2xl space-y-4">
            <button
              onClick={() => setActiveJoinRoom(null)}
              className="absolute top-5 right-5 text-zinc-400 hover:text-white text-lg font-bold cursor-pointer"
            >
              &times;
            </button>

            <div>
              <div className="flex items-center gap-2 text-xs font-bold text-[#22D3EE] uppercase tracking-wider mb-1">
                <Radio className="w-3.5 h-3.5" /> Join Room Space
              </div>
              <h2 className="text-xl font-bold text-white">{activeJoinRoom.name}</h2>
              <p className="text-xs text-zinc-400 font-mono mt-0.5">Code: {activeJoinRoom.code}</p>
            </div>

            <form onSubmit={handleJoinSubmit} className="space-y-3">
              <div>
                <label className="block text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-wider mb-1">
                  Your Display Name
                </label>
                <input
                  type="text"
                  required
                  value={joinUsername}
                  onChange={(e) => setJoinUsername(e.target.value)}
                  placeholder="e.g. musicLover"
                  className="w-full px-3.5 py-2.5 bg-[#060814] border border-white/10 rounded-xl outline-none text-white text-xs"
                />
              </div>

              {activeJoinRoom.isPrivate && (
                <div>
                  <label className="block text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-wider mb-1">
                    Room Password
                  </label>
                  <input
                    type="password"
                    required
                    value={joinPassword}
                    onChange={(e) => setJoinPassword(e.target.value)}
                    placeholder="Enter room password"
                    className="w-full px-3.5 py-2.5 bg-[#060814] border border-white/10 rounded-xl outline-none text-white text-xs font-mono"
                  />
                </div>
              )}

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveJoinRoom(null)}
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 text-zinc-300 rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-gradient-to-r from-[#22D3EE] to-[#8B5CF6] text-black font-bold rounded-xl text-xs hover:opacity-90 transition-all cursor-pointer"
                >
                  Enter Space →
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Global Search Modal */}
      <SearchModal isOpen={isSearchModalOpen} onClose={() => setIsSearchModalOpen(false)} />
    </div>
  );
}
