'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  Library,
  Music,
  Upload,
  Play,
  ArrowLeft,
  Radio,
  Clock,
  RefreshCw,
  AlertCircle,
  FileAudio,
  User,
  LogIn,
} from 'lucide-react';
import { safeFetchJson } from '@/lib/api';
import { getBackendUrl } from '@/lib/config';
import { useToast } from '@/components/ToastContext';

export interface UploadItem {
  id: string;
  title: string;
  artist: string;
  duration: number;
  url: string;
  source: string;
  thumbnailUrl?: string;
  lyricsUrl?: string;
  uploadedBy: string;
  createdAt: number;
}

export interface RecentItem {
  id: string;
  trackTitle: string;
  artist: string;
  durationMinutes: number;
  roomName: string;
  timestamp: number;
  createdAt: number;
}

export interface LibraryData {
  uploads: UploadItem[];
  recent: RecentItem[];
}

export default function LibraryPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<'all' | 'uploads' | 'recent'>('all');
  const [libraryData, setLibraryData] = useState<LibraryData>({ uploads: [], recent: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Upload modal state
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedLyricsFile, setSelectedLyricsFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const lyricsInputRef = useRef<HTMLInputElement | null>(null);

  const accessToken = (session as any)?.accessToken;
  const username = (session?.user as any)?.username || session?.user?.name || '';

  const fetchLibrary = useCallback(async (isSilent = false) => {
    if (!accessToken && !username) {
      setLoading(false);
      return;
    }

    if (!isSilent) setLoading(true);
    setError(null);
    try {
      const headers: HeadersInit = accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
      const data = await safeFetchJson<LibraryData>('/api/library', { headers });
      setLibraryData({
        uploads: data?.uploads || [],
        recent: data?.recent || [],
      });
    } catch (err: any) {
      console.error('Failed to load library:', err);
      if (!isSilent) {
        setError(err.message || 'Unable to load your library data');
      }
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, [accessToken, username]);

  useEffect(() => {
    if (status === 'authenticated') {
      fetchLibrary();
    } else if (status === 'unauthenticated') {
      setLoading(false);
    }
  }, [status, fetchLibrary]);

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      setUploadError('Please choose an audio file to upload');
      return;
    }

    setUploading(true);
    setUploadError('');

    try {
      const formData = new FormData();
      formData.append('audio', selectedFile);
      if (selectedLyricsFile) {
        formData.append('lyrics', selectedLyricsFile);
      }

      const backendUrl = getBackendUrl();
      const headers: HeadersInit = accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
      const res = await fetch(`${backendUrl}/api/tracks/upload`, {
        method: 'POST',
        body: formData,
        headers,
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Upload failed with status ${res.status}`);
      }

      const newTrack: UploadItem = await res.json();
      showToast(`Uploaded "${newTrack.title}" successfully!`);
      setSelectedFile(null);
      setSelectedLyricsFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (lyricsInputRef.current) lyricsInputRef.current.value = '';
      setShowUploadModal(false);

      // Refresh library list
      fetchLibrary(true);
    } catch (err: any) {
      setUploadError(err.message || 'Failed to upload audio track');
    } finally {
      setUploading(false);
    }
  };

  const formatTime = (seconds: number) => {
    if (isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const formatRelativeDate = (timestamp: number) => {
    if (!timestamp) return 'Recently';
    const diffSecs = Math.floor((Date.now() - timestamp) / 1000);
    if (diffSecs < 60) return 'Just now';
    if (diffSecs < 3600) return `${Math.floor(diffSecs / 60)}m ago`;
    if (diffSecs < 86400) return `${Math.floor(diffSecs / 3600)}h ago`;
    return `${Math.floor(diffSecs / 86400)}d ago`;
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
              onClick={() => fetchLibrary()}
              className="p-2.5 bg-[#0E1428] hover:bg-white/10 border border-white/10 rounded-full text-zinc-400 hover:text-white transition-colors cursor-pointer"
              title="Refresh library"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-[#22D3EE]' : ''}`} />
            </button>
            {status === 'authenticated' && (
              <button
                onClick={() => setShowUploadModal(true)}
                className="px-4 py-2 text-xs font-semibold text-white bg-[#8B5CF6] hover:bg-[#7c3aed] border border-[#8B5CF6]/50 rounded-full transition-colors cursor-pointer flex items-center gap-1.5 shadow-md"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Upload Audio</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-[1440px] mx-auto w-full px-6 md:px-12 py-10 flex-grow space-y-8">
        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-4 border-b border-white/5">
          <div className="space-y-2 text-left">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#A78BFA]">
              <Library className="w-4 h-4 text-[#8B5CF6]" />
              <span>Your Personal Sound Space</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight">
              Music Library
            </h1>
            <p className="text-sm text-zinc-400 max-w-xl">
              Manage your personal uploaded tracks and listening history from live room sessions.
            </p>
          </div>

          {/* Tab Filter buttons */}
          {status === 'authenticated' && (
            <div className="flex items-center gap-2 bg-[#0E1428] p-1.5 rounded-full border border-white/10">
              {(['all', 'uploads', 'recent'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-1.5 rounded-full text-xs font-semibold capitalize transition-all cursor-pointer ${
                    activeTab === tab
                      ? 'bg-[#8B5CF6] text-white shadow-md'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  {tab === 'all'
                    ? `All Tracks (${libraryData.uploads.length + libraryData.recent.length})`
                    : tab === 'uploads'
                    ? `Uploads (${libraryData.uploads.length})`
                    : `Recently Played (${libraryData.recent.length})`}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Unauthenticated Prompt */}
        {status === 'unauthenticated' ? (
          <div className="py-20 text-center space-y-4 bg-[#0A0E1C]/60 rounded-3xl border border-white/10 p-8 max-w-lg mx-auto">
            <User className="w-12 h-12 text-[#22D3EE] mx-auto opacity-80" />
            <h3 className="text-lg font-bold text-white">Sign In to Access Your Library</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Your uploaded audio tracks and listening history from live sync rooms are tied to your user account.
            </p>
            <button
              onClick={() => router.push('/')}
              className="mt-2 px-6 py-2.5 bg-gradient-to-r from-[#22D3EE] to-[#8B5CF6] text-black font-extrabold text-xs rounded-full hover:opacity-95 transition-all cursor-pointer inline-flex items-center gap-2"
            >
              <LogIn className="w-4 h-4" /> Go to Login / Home
            </button>
          </div>
        ) : loading && libraryData.uploads.length === 0 && libraryData.recent.length === 0 ? (
          /* Loading Skeleton */
          <div className="py-24 text-center space-y-4">
            <div className="w-10 h-10 border-2 border-[#8B5CF6] border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs text-zinc-400 font-mono">Retrieving your personal tracks and history...</p>
          </div>
        ) : error ? (
          /* Error State */
          <div className="py-16 text-center space-y-3 bg-[#0A0E1C]/60 rounded-3xl border border-red-500/20 p-6">
            <AlertCircle className="w-10 h-10 text-[#FF5A5F] mx-auto" />
            <h3 className="text-base font-bold text-white">Failed to load library</h3>
            <p className="text-xs text-zinc-400 max-w-md mx-auto">{error}</p>
            <button
              onClick={() => fetchLibrary()}
              className="mt-2 px-5 py-2 text-xs font-bold text-black bg-[#22D3EE] rounded-full hover:bg-white transition-colors cursor-pointer"
            >
              Retry Connection
            </button>
          </div>
        ) : (
          /* Real Data Content */
          <div className="space-y-8">
            {/* UPLOADS SECTION */}
            {(activeTab === 'all' || activeTab === 'uploads') && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-zinc-300 uppercase tracking-wider font-mono flex items-center gap-2">
                    <FileAudio className="w-4 h-4 text-[#22D3EE]" /> Personal Uploads ({libraryData.uploads.length})
                  </h3>
                  {libraryData.uploads.length > 0 && activeTab === 'all' && (
                    <button
                      onClick={() => setActiveTab('uploads')}
                      className="text-xs text-[#22D3EE] hover:underline cursor-pointer"
                    >
                      View All Uploads →
                    </button>
                  )}
                </div>

                {libraryData.uploads.length === 0 ? (
                  <div className="py-12 text-center space-y-2 bg-[#0A0E1C]/80 rounded-3xl border border-white/5">
                    <Upload className="w-7 h-7 text-zinc-600 mx-auto" />
                    <h4 className="text-xs font-bold text-zinc-300">No uploaded tracks yet</h4>
                    <p className="text-[11px] text-zinc-500">Upload your own MP3 or WAV files to queue and stream in any room.</p>
                    <button
                      onClick={() => setShowUploadModal(true)}
                      className="mt-1 px-4 py-1.5 text-xs font-semibold text-black bg-[#22D3EE] rounded-full hover:bg-white transition-colors cursor-pointer inline-flex items-center gap-1"
                    >
                      <Upload className="w-3 h-3" /> Upload Your First Track
                    </button>
                  </div>
                ) : (
                  <div className="bg-[#0A0E1C]/80 rounded-3xl border border-white/10 overflow-hidden divide-y divide-white/5">
                    {libraryData.uploads.map((track, idx) => (
                      <div
                        key={track.id}
                        className="flex items-center justify-between px-6 py-3.5 hover:bg-white/5 transition-colors group"
                      >
                        <div className="flex items-center gap-3.5 min-w-0">
                          <span className="w-5 text-center text-xs font-mono text-zinc-500">
                            {idx + 1}
                          </span>
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#00F0FF]/20 to-[#8B5CF6]/20 border border-white/10 flex items-center justify-center shrink-0">
                            <Music className="w-4 h-4 text-[#22D3EE]" />
                          </div>
                          <div className="min-w-0 text-left">
                            <h4 className="text-xs font-bold text-white truncate group-hover:text-[#22D3EE] transition-colors">
                              {track.title}
                            </h4>
                            <p className="text-[10px] text-zinc-400 truncate">Uploaded by @{track.uploadedBy}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-4 shrink-0">
                          <span className="text-xs font-mono text-zinc-400">
                            {formatTime(track.duration)}
                          </span>
                          <button
                            onClick={() => {
                              showToast(`Browse active rooms to queue "${track.title}"`);
                              router.push('/rooms');
                            }}
                            className="px-3 py-1 bg-white/5 hover:bg-[#8B5CF6] hover:text-white text-zinc-300 rounded-lg text-xs font-semibold transition-colors items-center gap-1 cursor-pointer inline-flex"
                          >
                            <Radio className="w-3 h-3" />
                            <span>Play in Room</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* RECENT LISTENING HISTORY SECTION */}
            {(activeTab === 'all' || activeTab === 'recent') && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-zinc-300 uppercase tracking-wider font-mono flex items-center gap-2">
                    <Clock className="w-4 h-4 text-[#8B5CF6]" /> Listening History ({libraryData.recent.length})
                  </h3>
                  {libraryData.recent.length > 0 && activeTab === 'all' && (
                    <button
                      onClick={() => setActiveTab('recent')}
                      className="text-xs text-[#8B5CF6] hover:underline cursor-pointer"
                    >
                      View All History →
                    </button>
                  )}
                </div>

                {libraryData.recent.length === 0 ? (
                  <div className="py-12 text-center space-y-2 bg-[#0A0E1C]/80 rounded-3xl border border-white/5">
                    <Clock className="w-7 h-7 text-zinc-600 mx-auto" />
                    <h4 className="text-xs font-bold text-zinc-300">No listening history recorded</h4>
                    <p className="text-[11px] text-zinc-500">Join a room and listen to music with others to build your history log.</p>
                    <button
                      onClick={() => router.push('/rooms')}
                      className="mt-1 px-4 py-1.5 text-xs font-semibold text-white bg-[#8B5CF6] rounded-full hover:bg-[#7c3aed] transition-colors cursor-pointer inline-flex items-center gap-1"
                    >
                      <Radio className="w-3 h-3" /> Explore Rooms
                    </button>
                  </div>
                ) : (
                  <div className="bg-[#0A0E1C]/80 rounded-3xl border border-white/10 overflow-hidden divide-y divide-white/5">
                    {libraryData.recent.map((item, idx) => (
                      <div
                        key={item.id || idx}
                        className="flex items-center justify-between px-6 py-3.5 hover:bg-white/5 transition-colors group"
                      >
                        <div className="flex items-center gap-3.5 min-w-0">
                          <span className="w-5 text-center text-xs font-mono text-zinc-500">
                            {idx + 1}
                          </span>
                          <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center shrink-0">
                            <Music className="w-4 h-4 text-[#A78BFA]" />
                          </div>
                          <div className="min-w-0 text-left">
                            <h4 className="text-xs font-bold text-white truncate group-hover:text-[#A78BFA] transition-colors">
                              {item.trackTitle}
                            </h4>
                            <p className="text-[10px] text-zinc-400 truncate">
                              {item.artist} &bull; Space: <span className="text-zinc-300 font-medium">{item.roomName}</span>
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-[11px] font-mono text-zinc-500">
                            {formatRelativeDate(item.timestamp || item.createdAt)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Upload Track Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="w-full max-w-md bg-[#0D1224] border border-white/15 rounded-3xl p-7 relative shadow-2xl space-y-4">
            <button
              onClick={() => setShowUploadModal(false)}
              className="absolute top-5 right-5 text-zinc-400 hover:text-white text-lg font-bold cursor-pointer"
            >
              &times;
            </button>

            <div>
              <h2 className="text-xl font-bold text-white">Upload Audio Track</h2>
              <p className="text-xs text-zinc-400 mt-0.5">MP3, WAV, OGG, or M4A audio files (Max 20MB)</p>
            </div>

            {uploadError && (
              <div className="p-3 bg-[#FF5A5F]/10 border border-[#FF5A5F]/30 rounded-xl text-xs text-[#FF5A5F]">
                {uploadError}
              </div>
            )}

            <form onSubmit={handleUploadSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-wider mb-1.5">
                  Audio File *
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  required
                  accept="audio/*,.mp3,.wav,.ogg,.m4a"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  className="w-full text-xs text-zinc-400 file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-[#8B5CF6] file:text-white hover:file:bg-[#7c3aed] cursor-pointer"
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-wider mb-1.5">
                  Synced Lyrics File (.lrc or .txt) (Optional)
                </label>
                <input
                  ref={lyricsInputRef}
                  type="file"
                  accept=".lrc,.txt"
                  onChange={(e) => setSelectedLyricsFile(e.target.files?.[0] || null)}
                  className="w-full text-xs text-zinc-400 file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-white/10 file:text-zinc-200 hover:file:bg-white/20 cursor-pointer"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 text-zinc-300 rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploading}
                  className="px-5 py-2 bg-[#22D3EE] hover:bg-white text-black font-extrabold rounded-xl text-xs transition-all disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                >
                  {uploading ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                      <span>Uploading...</span>
                    </>
                  ) : (
                    <span>Upload Track</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
