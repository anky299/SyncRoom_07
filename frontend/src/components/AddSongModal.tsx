'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Upload,
  Search,
  Music,
  Radio,
  FileText,
  AlertCircle,
  Loader2,
  Clock,
  X,
} from 'lucide-react';
import { Track, TrackSource } from '@/hooks/useSyncPlayer';
import { safeFetchJson } from '@/lib/api';

interface AddSongModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddTrack: (track: Track) => void;
  onUploadFile: (audioFile: File, lyricsFile?: File) => Promise<Track>;
  initialSource?: TrackSource;
}

export default function AddSongModal({
  isOpen,
  onClose,
  onAddTrack,
  onUploadFile,
  initialSource,
}: AddSongModalProps) {
  const [activeSourceTab, setActiveSourceTab] = useState<TrackSource>(initialSource || 'youtube');

  useEffect(() => {
    if (isOpen && initialSource) {
      setActiveSourceTab(initialSource);
    }
  }, [isOpen, initialSource]);

  // Upload states
  const [selectedAudioFile, setSelectedAudioFile] = useState<File | null>(null);
  const lyricsInputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  // Spotify Search states
  const [spotifyQuery, setSpotifyQuery] = useState('');
  const [spotifyResults, setSpotifyResults] = useState<any[]>([]);
  const [searchingSpotify, setSearchingSpotify] = useState(false);
  const [spotifyError, setSpotifyError] = useState('');
  const [hasSearchedSpotify, setHasSearchedSpotify] = useState(false);
  const [spotifyHighlightedIndex, setSpotifyHighlightedIndex] = useState(-1);
  const spotifyAbortRef = useRef<AbortController | null>(null);
  const lastSpotifyQueryRef = useRef<string>('');

  // YouTube Search states
  const [youtubeQuery, setYoutubeQuery] = useState('');
  const [youtubeResults, setYoutubeResults] = useState<any[]>([]);
  const [searchingYoutube, setSearchingYoutube] = useState(false);
  const [youtubeError, setYoutubeError] = useState('');
  const [hasSearchedYoutube, setHasSearchedYoutube] = useState(false);
  const [youtubeHighlightedIndex, setYoutubeHighlightedIndex] = useState(-1);
  const youtubeAbortRef = useRef<AbortController | null>(null);
  const lastYoutubeQueryRef = useRef<string>('');

  // Reset all search states when modal closes or unmounts
  useEffect(() => {
    if (!isOpen) {
      youtubeAbortRef.current?.abort();
      spotifyAbortRef.current?.abort();
      setYoutubeQuery('');
      setSpotifyQuery('');
      setYoutubeResults([]);
      setSpotifyResults([]);
      setSearchingYoutube(false);
      setSearchingSpotify(false);
      setYoutubeError('');
      setSpotifyError('');
      setHasSearchedYoutube(false);
      setHasSearchedSpotify(false);
      setYoutubeHighlightedIndex(-1);
      setSpotifyHighlightedIndex(-1);
      setSelectedAudioFile(null);
      setUploadError('');
      lastYoutubeQueryRef.current = '';
      lastSpotifyQueryRef.current = '';
    }
  }, [isOpen]);

  // Cancel in-flight requests when switching tabs
  const handleTabChange = (tab: TrackSource) => {
    youtubeAbortRef.current?.abort();
    spotifyAbortRef.current?.abort();
    setActiveSourceTab(tab);
  };

  // Format seconds to mm:ss
  const formatTime = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // Perform YouTube Search
  const performYoutubeSearch = useCallback(async (queryToSearch: string) => {
    const trimmed = queryToSearch.trim();
    if (trimmed.length < 2) {
      setYoutubeResults([]);
      setSearchingYoutube(false);
      setHasSearchedYoutube(false);
      setYoutubeError('');
      setYoutubeHighlightedIndex(-1);
      return;
    }

    // Abort previous in-flight request
    youtubeAbortRef.current?.abort();
    const controller = new AbortController();
    youtubeAbortRef.current = controller;
    lastYoutubeQueryRef.current = trimmed;

    setSearchingYoutube(true);
    setYoutubeError('');

    try {
      const data = await safeFetchJson<any[]>(
        `/api/youtube/search?q=${encodeURIComponent(trimmed)}`,
        { signal: controller.signal }
      );

      if (controller.signal.aborted) return;

      // Deduplicate results by youtubeId or id
      const seen = new Set<string>();
      const deduped = (Array.isArray(data) ? data : []).filter((item) => {
        const id = item.youtubeId || item.id;
        if (!id || seen.has(id)) return false;
        seen.add(id);
        return true;
      });

      setYoutubeResults(deduped);
      setHasSearchedYoutube(true);
      setYoutubeHighlightedIndex(deduped.length > 0 ? 0 : -1);
    } catch (err: any) {
      if (err.name === 'AbortError' || controller.signal.aborted) return;
      console.error('YouTube search failed:', err);
      setYoutubeError('Search temporarily unavailable');
      setYoutubeResults([]);
      setHasSearchedYoutube(true);
    } finally {
      if (!controller.signal.aborted) {
        setSearchingYoutube(false);
      }
    }
  }, []);

  // Debounced effect for live YouTube search
  useEffect(() => {
    const trimmed = youtubeQuery.trim();
    if (trimmed.length < 2) {
      youtubeAbortRef.current?.abort();
      setYoutubeResults([]);
      setSearchingYoutube(false);
      setYoutubeError('');
      setHasSearchedYoutube(false);
      setYoutubeHighlightedIndex(-1);
      lastYoutubeQueryRef.current = '';
      return;
    }

    if (trimmed === lastYoutubeQueryRef.current) return;

    const timer = setTimeout(() => {
      performYoutubeSearch(trimmed);
    }, 300);

    return () => clearTimeout(timer);
  }, [youtubeQuery, performYoutubeSearch]);

  // Perform Spotify Search
  const performSpotifySearch = useCallback(async (queryToSearch: string) => {
    const trimmed = queryToSearch.trim();
    if (trimmed.length < 2) {
      setSpotifyResults([]);
      setSearchingSpotify(false);
      setHasSearchedSpotify(false);
      setSpotifyError('');
      setSpotifyHighlightedIndex(-1);
      return;
    }

    spotifyAbortRef.current?.abort();
    const controller = new AbortController();
    spotifyAbortRef.current = controller;
    lastSpotifyQueryRef.current = trimmed;

    setSearchingSpotify(true);
    setSpotifyError('');

    try {
      const data = await safeFetchJson<any[]>(
        `/api/spotify/search?q=${encodeURIComponent(trimmed)}`,
        { signal: controller.signal }
      );

      if (controller.signal.aborted) return;

      const seen = new Set<string>();
      const deduped = (Array.isArray(data) ? data : []).filter((item) => {
        const id = item.id || item.spotifyUri;
        if (!id || seen.has(id)) return false;
        seen.add(id);
        return true;
      });

      setSpotifyResults(deduped);
      setHasSearchedSpotify(true);
      setSpotifyHighlightedIndex(deduped.length > 0 ? 0 : -1);
    } catch (err: any) {
      if (err.name === 'AbortError' || controller.signal.aborted) return;
      console.error('Spotify search failed:', err);
      setSpotifyError('Search temporarily unavailable');
      setSpotifyResults([]);
      setHasSearchedSpotify(true);
    } finally {
      if (!controller.signal.aborted) {
        setSearchingSpotify(false);
      }
    }
  }, []);

  // Debounced effect for live Spotify search
  useEffect(() => {
    const trimmed = spotifyQuery.trim();
    if (trimmed.length < 2) {
      spotifyAbortRef.current?.abort();
      setSpotifyResults([]);
      setSearchingSpotify(false);
      setSpotifyError('');
      setHasSearchedSpotify(false);
      setSpotifyHighlightedIndex(-1);
      lastSpotifyQueryRef.current = '';
      return;
    }

    if (trimmed === lastSpotifyQueryRef.current) return;

    const timer = setTimeout(() => {
      performSpotifySearch(trimmed);
    }, 300);

    return () => clearTimeout(timer);
  }, [spotifyQuery, performSpotifySearch]);

  // Add YouTube track to queue
  const handleSelectYoutubeTrack = (item: any) => {
    onAddTrack({
      id: item.id || item.youtubeId,
      title: item.title,
      artist: item.artist,
      duration: item.duration || 210,
      url: item.youtubeId || item.id,
      source: 'youtube',
      youtubeId: item.youtubeId || item.id,
      thumbnailUrl: item.thumbnailUrl,
      uploadedBy: 'User',
      votes: {},
      voteCount: 0,
      approved: true,
    });
    onClose();
  };

  // Add Spotify track to queue
  const handleSelectSpotifyTrack = (item: any) => {
    onAddTrack({
      id: item.id,
      title: item.title,
      artist: item.artist,
      duration: item.duration || 210,
      url: item.spotifyUri || item.url,
      source: 'spotify',
      spotifyUri: item.spotifyUri || item.url,
      thumbnailUrl: item.thumbnailUrl,
      uploadedBy: 'User',
      votes: {},
      voteCount: 0,
      approved: true,
    });
    onClose();
  };

  // Keyboard navigation for YouTube
  const handleYoutubeKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (youtubeResults.length === 0) {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (youtubeQuery.trim().length >= 2) {
          performYoutubeSearch(youtubeQuery.trim());
        }
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setYoutubeHighlightedIndex((prev) => (prev + 1) % youtubeResults.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setYoutubeHighlightedIndex((prev) => (prev <= 0 ? youtubeResults.length - 1 : prev - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (youtubeHighlightedIndex >= 0 && youtubeResults[youtubeHighlightedIndex]) {
        handleSelectYoutubeTrack(youtubeResults[youtubeHighlightedIndex]);
      } else if (youtubeQuery.trim().length >= 2) {
        performYoutubeSearch(youtubeQuery.trim());
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setYoutubeResults([]);
      setYoutubeHighlightedIndex(-1);
    }
  };

  // Keyboard navigation for Spotify
  const handleSpotifyKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (spotifyResults.length === 0) {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (spotifyQuery.trim().length >= 2) {
          performSpotifySearch(spotifyQuery.trim());
        }
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSpotifyHighlightedIndex((prev) => (prev + 1) % spotifyResults.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSpotifyHighlightedIndex((prev) => (prev <= 0 ? spotifyResults.length - 1 : prev - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (spotifyHighlightedIndex >= 0 && spotifyResults[spotifyHighlightedIndex]) {
        handleSelectSpotifyTrack(spotifyResults[spotifyHighlightedIndex]);
      } else if (spotifyQuery.trim().length >= 2) {
        performSpotifySearch(spotifyQuery.trim());
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setSpotifyResults([]);
      setSpotifyHighlightedIndex(-1);
    }
  };

  // Handle Local File Upload
  const handleUploadSubmit = async () => {
    if (!selectedAudioFile) return;
    setUploading(true);
    setUploadError('');
    try {
      const lyricsFile = lyricsInputRef.current?.files?.[0];
      const track = await onUploadFile(selectedAudioFile, lyricsFile);
      onAddTrack(track);
      setSelectedAudioFile(null);
      onClose();
    } catch (err: any) {
      setUploadError(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="w-full max-w-lg bg-[#0A142D] border border-white/10 rounded-3xl p-6 shadow-2xl relative flex flex-col max-h-[90vh]">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-zinc-400 hover:text-white text-xl font-bold cursor-pointer transition-colors p-1"
          aria-label="Close modal"
        >
          &times;
        </button>

        <h2 className="text-lg font-display font-black text-white mb-4 flex items-center gap-2">
          <Music className="w-5 h-5 text-[#00F0FF]" /> Add Track to Queue
        </h2>

        {/* 3 Source Selection Tabs */}
        <div className="flex bg-black/40 border border-white/10 p-1 rounded-2xl mb-5 text-xs font-bold shrink-0">
          <button
            onClick={() => handleTabChange('youtube')}
            className={`flex-1 py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeSourceTab === 'youtube'
                ? 'bg-red-500 text-white font-extrabold shadow-md'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Search className="w-3.5 h-3.5" />
            <span>YouTube</span>
          </button>

          <button
            onClick={() => handleTabChange('spotify')}
            className={`flex-1 py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeSourceTab === 'spotify'
                ? 'bg-emerald-500 text-black font-extrabold shadow-md'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Radio className="w-3.5 h-3.5" />
            <span>Spotify</span>
          </button>

          <button
            onClick={() => handleTabChange('upload')}
            className={`flex-1 py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeSourceTab === 'upload'
                ? 'bg-[#00F0FF] text-black font-extrabold shadow-md'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>File Upload</span>
          </button>
        </div>

        {/* TAB 1: YOUTUBE SEARCH */}
        {activeSourceTab === 'youtube' && (
          <div className="flex flex-col flex-1 min-h-0 space-y-3">
            {/* Search Input Bar */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (youtubeQuery.trim().length >= 2) {
                  performYoutubeSearch(youtubeQuery.trim());
                }
              }}
              className="relative flex gap-2 shrink-0"
            >
              <div className="relative flex-grow">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
                <input
                  type="text"
                  value={youtubeQuery}
                  onChange={(e) => setYoutubeQuery(e.target.value)}
                  onKeyDown={handleYoutubeKeyDown}
                  placeholder="Search YouTube songs, artists, or keywords..."
                  autoFocus
                  className="w-full pl-10 pr-9 py-2.5 bg-black/50 border border-red-500/30 rounded-xl text-white text-xs outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500/30 transition-all placeholder:text-zinc-500"
                />
                {youtubeQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setYoutubeQuery('');
                      setYoutubeResults([]);
                      setHasSearchedYoutube(false);
                      setYoutubeHighlightedIndex(-1);
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <button
                type="submit"
                disabled={searchingYoutube || youtubeQuery.trim().length < 2}
                className="px-4 py-2.5 bg-red-500 text-white font-extrabold rounded-xl text-xs hover:bg-red-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer shrink-0 flex items-center gap-1.5"
              >
                {searchingYoutube ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                <span>Search</span>
              </button>
            </form>

            {/* Results / Dropdown Container */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-[220px] max-h-[340px]">
              {/* State: Searching */}
              {searchingYoutube ? (
                <div className="flex flex-col items-center justify-center py-12 gap-2 text-zinc-400">
                  <Loader2 className="w-6 h-6 animate-spin text-red-500" />
                  <p className="text-xs font-mono-tech">Searching YouTube...</p>
                </div>
              ) : youtubeError ? (
                /* State: Error */
                <div className="flex flex-col items-center justify-center py-10 gap-2 text-center">
                  <AlertCircle className="w-8 h-8 text-red-400" />
                  <p className="text-xs font-bold text-red-400">{youtubeError}</p>
                  <button
                    onClick={() => performYoutubeSearch(youtubeQuery.trim())}
                    className="mt-1 px-3 py-1 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-mono-tech transition-colors cursor-pointer"
                  >
                    Retry Search
                  </button>
                </div>
              ) : youtubeQuery.trim().length === 0 ? (
                /* State: Empty input */
                <div className="flex flex-col items-center justify-center py-12 text-center text-zinc-500">
                  <Search className="w-8 h-8 text-zinc-600 mb-2 stroke-[1.5]" />
                  <p className="text-xs font-bold text-zinc-400">Start typing to search</p>
                  <p className="text-[11px] text-zinc-500 font-mono-tech mt-0.5">
                    Live suggestions appear as you type (min 2 characters)
                  </p>
                </div>
              ) : youtubeQuery.trim().length < 2 ? (
                /* State: Too short */
                <div className="flex flex-col items-center justify-center py-12 text-center text-zinc-500">
                  <p className="text-xs text-zinc-400 font-mono-tech">
                    Type at least 2 characters to search...
                  </p>
                </div>
              ) : hasSearchedYoutube && youtubeResults.length === 0 ? (
                /* State: No results */
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Music className="w-8 h-8 text-zinc-600 mb-2" />
                  <p className="text-xs font-bold text-white">No results found for &ldquo;{youtubeQuery.trim()}&rdquo;</p>
                  <p className="text-[11px] text-zinc-500 font-mono-tech mt-1">
                    Try searching with song title, artist, or music video name
                  </p>
                </div>
              ) : (
                /* State: Live Suggestions Dropdown */
                youtubeResults.map((item, index) => {
                  const isHighlighted = youtubeHighlightedIndex === index;
                  return (
                    <div
                      key={item.id}
                      onClick={() => handleSelectYoutubeTrack(item)}
                      onMouseEnter={() => setYoutubeHighlightedIndex(index)}
                      className={`flex items-center justify-between p-2.5 rounded-xl border transition-all cursor-pointer text-xs ${
                        isHighlighted
                          ? 'bg-white/10 border-red-500/70 shadow-lg ring-1 ring-red-500/30'
                          : 'bg-black/40 border-white/5 hover:border-red-500/30 hover:bg-white/5'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <img
                          src={item.thumbnailUrl}
                          alt={item.title}
                          className="w-12 h-9 rounded-lg object-cover border border-white/10 shrink-0 bg-black/60"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = `https://i.ytimg.com/vi/${item.youtubeId}/hqdefault.jpg`;
                          }}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="font-extrabold text-white truncate text-xs leading-snug">
                            {item.title}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5 text-[10px] text-zinc-400 font-mono-tech">
                            <span className="truncate max-w-[150px]">{item.artist}</span>
                            <span className="text-zinc-600">•</span>
                            <span className="flex items-center gap-0.5 shrink-0 text-zinc-400">
                              <Clock className="w-2.5 h-2.5 text-zinc-500" />
                              {formatTime(item.duration)}
                            </span>
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-black uppercase tracking-wider bg-red-500/20 text-red-400 border border-red-500/30 shrink-0">
                              YouTube
                            </span>
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectYoutubeTrack(item);
                        }}
                        className="px-3 py-1.5 bg-red-500 hover:bg-red-400 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer shrink-0 ml-2 shadow-sm"
                      >
                        + Queue
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            {/* Keyboard shortcut hint */}
            {youtubeResults.length > 0 && (
              <div className="flex items-center justify-between text-[10px] font-mono-tech text-zinc-500 pt-1 border-t border-white/5 shrink-0">
                <span>Use &uarr; &darr; arrows to navigate</span>
                <span>Press Enter to add</span>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: SPOTIFY SEARCH */}
        {activeSourceTab === 'spotify' && (
          <div className="flex flex-col flex-1 min-h-0 space-y-3">
            {/* Search Input Bar */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (spotifyQuery.trim().length >= 2) {
                  performSpotifySearch(spotifyQuery.trim());
                }
              }}
              className="relative flex gap-2 shrink-0"
            >
              <div className="relative flex-grow">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
                <input
                  type="text"
                  value={spotifyQuery}
                  onChange={(e) => setSpotifyQuery(e.target.value)}
                  onKeyDown={handleSpotifyKeyDown}
                  placeholder="Search Spotify tracks or artists..."
                  autoFocus
                  className="w-full pl-10 pr-9 py-2.5 bg-black/50 border border-emerald-500/30 rounded-xl text-white text-xs outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 transition-all placeholder:text-zinc-500"
                />
                {spotifyQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setSpotifyQuery('');
                      setSpotifyResults([]);
                      setHasSearchedSpotify(false);
                      setSpotifyHighlightedIndex(-1);
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <button
                type="submit"
                disabled={searchingSpotify || spotifyQuery.trim().length < 2}
                className="px-4 py-2.5 bg-emerald-500 text-black font-extrabold rounded-xl text-xs hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer shrink-0 flex items-center gap-1.5"
              >
                {searchingSpotify ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                <span>Search</span>
              </button>
            </form>

            {/* Results / Dropdown Container */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-[220px] max-h-[340px]">
              {/* State: Searching */}
              {searchingSpotify ? (
                <div className="flex flex-col items-center justify-center py-12 gap-2 text-zinc-400">
                  <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
                  <p className="text-xs font-mono-tech">Searching Spotify...</p>
                </div>
              ) : spotifyError ? (
                /* State: Error */
                <div className="flex flex-col items-center justify-center py-10 gap-2 text-center">
                  <AlertCircle className="w-8 h-8 text-emerald-400" />
                  <p className="text-xs font-bold text-emerald-400">{spotifyError}</p>
                  <button
                    onClick={() => performSpotifySearch(spotifyQuery.trim())}
                    className="mt-1 px-3 py-1 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-mono-tech transition-colors cursor-pointer"
                  >
                    Retry Search
                  </button>
                </div>
              ) : spotifyQuery.trim().length === 0 ? (
                /* State: Empty input */
                <div className="flex flex-col items-center justify-center py-12 text-center text-zinc-500">
                  <Radio className="w-8 h-8 text-zinc-600 mb-2 stroke-[1.5]" />
                  <p className="text-xs font-bold text-zinc-400">Start typing to search Spotify</p>
                  <p className="text-[11px] text-zinc-500 font-mono-tech mt-0.5">
                    Live suggestions appear as you type (min 2 characters)
                  </p>
                </div>
              ) : spotifyQuery.trim().length < 2 ? (
                /* State: Too short */
                <div className="flex flex-col items-center justify-center py-12 text-center text-zinc-500">
                  <p className="text-xs text-zinc-400 font-mono-tech">
                    Type at least 2 characters to search...
                  </p>
                </div>
              ) : hasSearchedSpotify && spotifyResults.length === 0 ? (
                /* State: No results */
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Music className="w-8 h-8 text-zinc-600 mb-2" />
                  <p className="text-xs font-bold text-white">No results found for &ldquo;{spotifyQuery.trim()}&rdquo;</p>
                  <p className="text-[11px] text-zinc-500 font-mono-tech mt-1">
                    Try searching with song title or artist name
                  </p>
                </div>
              ) : (
                /* State: Live Suggestions Dropdown */
                spotifyResults.map((item, index) => {
                  const isHighlighted = spotifyHighlightedIndex === index;
                  return (
                    <div
                      key={item.id}
                      onClick={() => handleSelectSpotifyTrack(item)}
                      onMouseEnter={() => setSpotifyHighlightedIndex(index)}
                      className={`flex items-center justify-between p-2.5 rounded-xl border transition-all cursor-pointer text-xs ${
                        isHighlighted
                          ? 'bg-white/10 border-emerald-500/70 shadow-lg ring-1 ring-emerald-500/30'
                          : 'bg-black/40 border-white/5 hover:border-emerald-500/30 hover:bg-white/5'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <img
                          src={item.thumbnailUrl}
                          alt={item.title}
                          className="w-10 h-10 rounded-lg object-cover border border-white/10 shrink-0 bg-black/60"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="font-extrabold text-white truncate text-xs leading-snug">
                            {item.title}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5 text-[10px] text-zinc-400 font-mono-tech">
                            <span className="truncate max-w-[150px]">{item.artist}</span>
                            <span className="text-zinc-600">•</span>
                            <span className="flex items-center gap-0.5 shrink-0 text-zinc-400">
                              <Clock className="w-2.5 h-2.5 text-zinc-500" />
                              {formatTime(item.duration)}
                            </span>
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shrink-0">
                              Spotify
                            </span>
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectSpotifyTrack(item);
                        }}
                        className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-xs rounded-lg transition-colors cursor-pointer shrink-0 ml-2 shadow-sm"
                      >
                        + Queue
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            {/* Keyboard shortcut hint */}
            {spotifyResults.length > 0 && (
              <div className="flex items-center justify-between text-[10px] font-mono-tech text-zinc-500 pt-1 border-t border-white/5 shrink-0">
                <span>Use &uarr; &darr; arrows to navigate</span>
                <span>Press Enter to add</span>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: LOCAL FILE UPLOAD */}
        {activeSourceTab === 'upload' && (
          <div className="space-y-4">
            <input
              type="file"
              accept=".mp3,.wav,.ogg,.m4a"
              id="modal-audio-file"
              className="hidden"
              onChange={(e) => setSelectedAudioFile(e.target.files?.[0] || null)}
            />
            <input
              type="file"
              accept=".lrc,.txt"
              ref={lyricsInputRef}
              id="modal-lyrics-file"
              className="hidden"
            />

            {!selectedAudioFile ? (
              <div
                onClick={() => document.getElementById('modal-audio-file')?.click()}
                className="p-8 border-2 border-dashed border-[#00F0FF]/30 hover:border-[#00F0FF] rounded-2xl flex flex-col items-center justify-center gap-2 cursor-pointer transition-all bg-black/20"
              >
                <Upload className="w-8 h-8 text-[#00F0FF]" />
                <p className="font-extrabold text-xs text-white">Select Audio File</p>
                <p className="text-[10px] text-zinc-400 font-mono-tech">MP3, WAV, OGG, or M4A (Max 20MB)</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="p-3 bg-black/40 border border-[#00F0FF]/30 rounded-xl flex justify-between items-center text-xs">
                  <span className="font-bold text-white truncate max-w-[240px]">{selectedAudioFile.name}</span>
                  <button onClick={() => setSelectedAudioFile(null)} className="text-zinc-400 hover:text-white">&times;</button>
                </div>

                <div className="p-3 bg-black/40 border border-white/10 rounded-xl space-y-1">
                  <span className="block text-[10px] font-mono-tech font-bold text-zinc-400 uppercase tracking-wider">Optional Synced Lyrics (.LRC)</span>
                  <button
                    onClick={() => document.getElementById('modal-lyrics-file')?.click()}
                    className="w-full py-1.5 bg-white/5 hover:bg-white/10 text-white rounded-lg text-xs font-mono-tech flex items-center justify-center gap-1 border border-white/10 cursor-pointer"
                  >
                    <FileText className="w-3.5 h-3.5 text-[#00F0FF]" /> Add LRC Lyrics File
                  </button>
                </div>

                {uploadError && <p className="text-xs text-red-400 font-mono-tech">{uploadError}</p>}

                <button
                  onClick={handleUploadSubmit}
                  disabled={uploading}
                  className="btn-theme-primary w-full py-2.5 text-xs font-extrabold rounded-xl cursor-pointer"
                >
                  {uploading ? 'Uploading File...' : 'Add to Room Queue'}
                </button>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
