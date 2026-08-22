'use client';

import React, { useState, useRef } from 'react';
import { Upload, Search, Music, Radio, FileText, Check, AlertCircle } from 'lucide-react';
import { Track, TrackSource } from '@/hooks/useSyncPlayer';
import { safeFetchJson } from '@/lib/api';

interface AddSongModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddTrack: (track: Track) => void;
  onUploadFile: (audioFile: File, lyricsFile?: File) => Promise<Track>;
}


export default function AddSongModal({
  isOpen,
  onClose,
  onAddTrack,
  onUploadFile,
}: AddSongModalProps) {
  const [activeSourceTab, setActiveSourceTab] = useState<TrackSource>('upload');
  
  // Upload states
  const [selectedAudioFile, setSelectedAudioFile] = useState<File | null>(null);
  const lyricsInputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  // Spotify Search states
  const [spotifyQuery, setSpotifyQuery] = useState('');
  const [spotifyResults, setSpotifyResults] = useState<any[]>([]);
  const [searchingSpotify, setSearchingSpotify] = useState(false);

  // YouTube Search states
  const [youtubeQuery, setYoutubeQuery] = useState('');
  const [youtubeResults, setYoutubeResults] = useState<any[]>([]);
  const [searchingYoutube, setSearchingYoutube] = useState(false);

  if (!isOpen) return null;

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

  // Handle Spotify Search Query
  const handleSpotifySearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!spotifyQuery.trim()) return;
    setSearchingSpotify(true);
    try {
      const data = await safeFetchJson(`/api/spotify/search?q=${encodeURIComponent(spotifyQuery.trim())}`);
      setSpotifyResults(data);
    } catch (e) {
      console.log('Spotify search failed', e);
    } finally {
      setSearchingSpotify(false);
    }
  };

  // Handle YouTube Search Query
  const handleYoutubeSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!youtubeQuery.trim()) return;
    setSearchingYoutube(true);
    try {
      const data = await safeFetchJson(`/api/youtube/search?q=${encodeURIComponent(youtubeQuery.trim())}`);
      setYoutubeResults(data);
    } catch (e) {
      console.log('YouTube search failed', e);
    } finally {
      setSearchingYoutube(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="w-full max-w-lg bg-[#0A142D] border border-white/10 rounded-3xl p-6 shadow-2xl relative">
        <button onClick={onClose} className="absolute top-5 right-5 text-zinc-400 hover:text-white text-lg font-bold cursor-pointer">&times;</button>
        
        <h2 className="text-lg font-display font-black text-white mb-4 flex items-center gap-2">
          <Music className="w-5 h-5 text-[#00F0FF]" /> Add Track to Queue
        </h2>

        {/* 3 Source Selection Tabs */}
        <div className="flex bg-black/40 border border-white/10 p-1 rounded-2xl mb-5 text-xs font-bold">
          <button
            onClick={() => setActiveSourceTab('upload')}
            className={`flex-1 py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeSourceTab === 'upload' ? 'bg-[#00F0FF] text-black font-extrabold shadow-md' : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>File Upload</span>
          </button>

          <button
            onClick={() => setActiveSourceTab('spotify')}
            className={`flex-1 py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeSourceTab === 'spotify' ? 'bg-emerald-500 text-black font-extrabold shadow-md' : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Radio className="w-3.5 h-3.5" />
            <span>Spotify</span>
          </button>

          <button
            onClick={() => setActiveSourceTab('youtube')}
            className={`flex-1 py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeSourceTab === 'youtube' ? 'bg-red-500 text-white font-extrabold shadow-md' : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Search className="w-3.5 h-3.5" />
            <span>YouTube</span>
          </button>
        </div>

        {/* TAB 1: LOCAL FILE UPLOAD */}
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

        {/* TAB 2: SPOTIFY SEARCH */}
        {activeSourceTab === 'spotify' && (
          <div className="space-y-4">
            <form onSubmit={handleSpotifySearch} className="flex gap-2">
              <input
                type="text"
                value={spotifyQuery}
                onChange={(e) => setSpotifyQuery(e.target.value)}
                placeholder="Search Spotify tracks or artists..."
                className="flex-grow px-3 py-2 bg-black/40 border border-emerald-500/30 rounded-xl text-white text-xs outline-none focus:border-emerald-500"
              />
              <button type="submit" className="px-4 py-2 bg-emerald-500 text-black font-extrabold rounded-xl text-xs hover:bg-emerald-400 cursor-pointer">
                Search
              </button>
            </form>

            <div className="space-y-2 max-h-[240px] overflow-y-auto pr-1">
              {searchingSpotify ? (
                <p className="text-center py-6 text-xs text-zinc-400 font-mono-tech">Searching Spotify...</p>
              ) : spotifyResults.length === 0 ? (
                <p className="text-center py-6 text-xs text-zinc-500 font-mono-tech">Type a search query to browse Spotify tracks.</p>
              ) : (
                spotifyResults.map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-2 bg-black/40 border border-emerald-500/20 rounded-xl hover:border-emerald-500 transition-all text-xs">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <img src={item.thumbnailUrl} alt={item.title} className="w-10 h-10 rounded-lg object-cover border border-white/10 shrink-0" />
                      <div className="min-w-0">
                        <p className="font-extrabold text-white truncate">{item.title}</p>
                        <p className="text-[10px] text-zinc-400 truncate">{item.artist}</p>
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        onAddTrack({
                          id: item.id,
                          title: item.title,
                          artist: item.artist,
                          duration: item.duration,
                          url: item.spotifyUri,
                          source: 'spotify',
                          spotifyUri: item.spotifyUri,
                          thumbnailUrl: item.thumbnailUrl,
                          uploadedBy: 'User',
                          votes: {},
                          voteCount: 0,
                          approved: true,
                        });
                        onClose();
                      }}
                      className="px-3 py-1 bg-emerald-500 text-black font-bold text-xs rounded-lg hover:bg-emerald-400 cursor-pointer shrink-0 ml-2"
                    >
                      + Queue
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* TAB 3: YOUTUBE SEARCH */}
        {activeSourceTab === 'youtube' && (
          <div className="space-y-4">
            <form onSubmit={handleYoutubeSearch} className="flex gap-2">
              <input
                type="text"
                value={youtubeQuery}
                onChange={(e) => setYoutubeQuery(e.target.value)}
                placeholder="Search YouTube videos or channels..."
                className="flex-grow px-3 py-2 bg-black/40 border border-red-500/30 rounded-xl text-white text-xs outline-none focus:border-red-500"
              />
              <button type="submit" className="px-4 py-2 bg-red-500 text-white font-extrabold rounded-xl text-xs hover:bg-red-400 cursor-pointer">
                Search
              </button>
            </form>

            <div className="space-y-2 max-h-[240px] overflow-y-auto pr-1">
              {searchingYoutube ? (
                <p className="text-center py-6 text-xs text-zinc-400 font-mono-tech">Searching YouTube...</p>
              ) : youtubeResults.length === 0 ? (
                <p className="text-center py-6 text-xs text-zinc-500 font-mono-tech">Type a search query to browse YouTube audio.</p>
              ) : (
                youtubeResults.map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-2 bg-black/40 border border-red-500/20 rounded-xl hover:border-red-500 transition-all text-xs">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <img src={item.thumbnailUrl} alt={item.title} className="w-12 h-9 rounded-lg object-cover border border-white/10 shrink-0" />
                      <div className="min-w-0">
                        <p className="font-extrabold text-white truncate">{item.title}</p>
                        <p className="text-[10px] text-zinc-400 truncate">{item.artist}</p>
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        onAddTrack({
                          id: item.id,
                          title: item.title,
                          artist: item.artist,
                          duration: item.duration,
                          url: item.youtubeId,
                          source: 'youtube',
                          youtubeId: item.youtubeId,
                          thumbnailUrl: item.thumbnailUrl,
                          uploadedBy: 'User',
                          votes: {},
                          voteCount: 0,
                          approved: true,
                        });
                        onClose();
                      }}
                      className="px-3 py-1 bg-red-500 text-white font-bold text-xs rounded-lg hover:bg-red-400 cursor-pointer shrink-0 ml-2"
                    >
                      + Queue
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
