'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import dynamic from 'next/dynamic';
import { getBackendUrl } from '@/lib/config';
import { safeFetchJson } from '@/lib/api';
import { useSyncPlayer, Track, ChatMessage, ReactionItem, LyricLine } from '@/hooks/useSyncPlayer';
import { GlassCard } from '@/components/GlassCard';
import {
  Play,
  Pause,
  SkipForward,
  Volume2,
  Users,
  Radio,
  Share2,
  Lock,
  Unlock,
  Plus,
  Trash2,
  MessageSquare,
  Send,
  LogOut,
  Settings,
  Shield,
  Upload,
  UserPlus,
  Copy,
  Check,
  Disc,
  Info,
  ListMusic,
  ChevronUp,
  ChevronDown,
  Activity,
  Calendar,
  Smile,
  CornerDownRight,
  Sparkles,
  Sliders,
  Tv,
  FileText,
  UserCheck,
  Zap,
  Circle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// Lazy load 3D Headphones centerpiece & player backends
const Headphones3D = dynamic(() => import('@/components/Headphones3D'), {
  ssr: false,
  loading: () => (
    <div className="w-56 h-56 md:w-64 md:h-64 flex items-center justify-center bg-[#1C2541]/40 border border-[#00B4D8]/30 rounded-full shadow-[0_0_30px_rgba(0,180,216,0.2)]">
      <div className="w-10 h-10 rounded-full border-2 border-[#00B4D8] border-t-transparent animate-spin" />
    </div>
  ),
});

const SpotifyPlayerBackend = dynamic(() => import('@/components/SpotifyPlayerBackend'), { ssr: false });
const YouTubePlayerBackend = dynamic(() => import('@/components/YouTubePlayerBackend'), { ssr: false });
const AddSongModal = dynamic(() => import('@/components/AddSongModal'), { ssr: false });

const BACKEND_URL = getBackendUrl();

export default function RoomPage() {
  const router = useRouter();
  const rawParams = useParams();
  const roomCode = (rawParams?.code as string)?.toUpperCase();
  const searchParams = useSearchParams();
  const { data: session } = useSession();

  // Credentials
  const [username, setUsername] = useState(searchParams.get('username') || '');
  const [password, setPassword] = useState(searchParams.get('password') || '');
  const [showJoinPrompt, setShowJoinPrompt] = useState(!searchParams.get('username'));

  const [inputUsername, setInputUsername] = useState('');
  const [inputPassword, setInputPassword] = useState('');
  const [promptError, setPromptError] = useState('');

  // Copy indicators
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  
  // Mobile tabs
  const [activeTab, setActiveTab] = useState<'player' | 'queue' | 'chat' | 'people'>('player');

  // Player mode: 3D Headphones or Synced Lyrics
  const [activePlayerMode, setActivePlayerMode] = useState<'cd' | 'lyrics'>('cd');

  // Chat state
  const [chatInput, setChatInput] = useState('');
  const [replyTo, setReplyTo] = useState<{ id: string; username: string } | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  // Volume
  const [volume, setVolume] = useState(0.8);

  // Modals & Panels
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showMobileSettings, setShowMobileSettings] = useState(false);
  const [showAdvancedTuning, setShowAdvancedTuning] = useState(false);
  const [showAddSongModal, setShowAddSongModal] = useState(false);
  const [spotifyAccessToken, setSpotifyAccessToken] = useState<string | undefined>(undefined);

  // Check URL query for Spotify access token
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('spotify_access_token');
    if (token) {
      setSpotifyAccessToken(token);
    }
  }, []);

  // Autoplay safeguard
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);

  // Scheduled countdown
  const [timeLeft, setTimeLeft] = useState(0);

  // Friends invite list
  const [onlineFriends, setOnlineFriends] = useState<any[]>([]);

  // Join form submit
  const handleJoinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputUsername.trim()) {
      setPromptError('Username is required');
      return;
    }
    setUsername(inputUsername.trim());
    setPassword(inputPassword.trim());
    setShowJoinPrompt(false);

    const params = new URLSearchParams(window.location.search);
    params.set('username', inputUsername.trim());
    if (inputPassword.trim()) {
      params.set('password', inputPassword.trim());
    }
    router.replace(`/room/${roomCode}?${params.toString()}`);
  };

  // Sync player hook
  const {
    room,
    participant,
    isHost,
    isConnected,
    isReconnecting,
    error: syncError,
    latency,
    clockOffset,
    drift,
    syncStatus,
    chatMessages,
    activityLog,
    reactions,
    audioDelay,
    lyrics,
    audioElement,
    hasControl,
    isDjBoothMode,
    isCurrentDj,
    activeDjUsername,
    togglePlayPause,
    seek,
    nextTrack,
    addToQueue,
    updateQueue,
    removeFromQueue,
    voteTrack,
    approveTrack,
    sendChatMessage,
    sendReaction,
    updateTheme,
    startScheduledRoom,
    joinDjBooth,
    leaveDjBooth,
    sendFriendInvite,
    kickParticipant,
    transferHost,
    updateSettings,
    uploadTrack,
    saveAudioDelay,
    skipDjTurn,
    leaveRoom,
    socket,
  } = useSyncPlayer(roomCode, username);

  const [showLeaveConfirmModal, setShowLeaveConfirmModal] = useState(false);
  const confirmLeave = () => {
    leaveRoom();
    router.push('/');
  };

  const lyricsContainerRef = useRef<HTMLDivElement | null>(null);

  // Countdown timer for scheduled events
  useEffect(() => {
    if (!room?.scheduledStartTime || room.isStarted) return;
    const tick = () => {
      const diff = room.scheduledStartTime! - Date.now();
      setTimeLeft(Math.max(0, diff));
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [room?.scheduledStartTime, room?.isStarted]);

  // Synced lyrics auto-centering scroll
  useEffect(() => {
    if (activePlayerMode !== 'lyrics' || !audioElement || lyrics.length === 0 || !lyricsContainerRef.current) return;
    
    const curTime = audioElement.currentTime;
    let activeIndex = -1;
    for (let i = 0; i < lyrics.length; i++) {
      if (curTime >= lyrics[i].time && (i === lyrics.length - 1 || curTime < lyrics[i + 1].time)) {
        activeIndex = i;
        break;
      }
    }

    if (activeIndex !== -1) {
      const lines = lyricsContainerRef.current.children;
      const activeElement = lines[activeIndex] as HTMLElement;
      if (activeElement) {
        lyricsContainerRef.current.scrollTo({
          top: activeElement.offsetTop - lyricsContainerRef.current.offsetHeight / 2 + activeElement.offsetHeight / 2,
          behavior: 'smooth',
        });
      }
    }
  }, [audioElement?.currentTime, activePlayerMode, lyrics]);

  // Fetch friends list for invite modal
  useEffect(() => {
    if (showInviteModal && session?.user) {
      const fetchFriends = async () => {
        try {
          const list = await safeFetchJson(`/api/friends/list?username=${encodeURIComponent((session.user as any).username)}`);
          setOnlineFriends(list.filter((f: any) => f.status === 'accepted'));
        } catch (e) {
          console.log('Failed to load friends', e);
        }
      };
      fetchFriends();
    }
  }, [showInviteModal, session]);

  // Chat scroll
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // Volume binding
  useEffect(() => {
    if (audioElement) {
      audioElement.volume = volume;
    }
  }, [volume, audioElement]);

  // Autoplay unblock check
  useEffect(() => {
    if (audioElement && room?.playback?.isPlaying && audioElement.paused) {
      const playPromise = audioElement.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {
          setAutoplayBlocked(true);
        });
      }
    }
  }, [room?.playback?.isPlaying, audioElement]);

  const handleUnblockAutoplay = () => {
    if (audioElement) {
      audioElement.play()
        .then(() => setAutoplayBlocked(false))
        .catch((e) => console.log('Autoplay unblock failed:', e));
    }
  };

  // Copy helpers
  const handleCopyLink = () => {
    const inviteLink = `${window.location.origin}/room/${roomCode}`;
    navigator.clipboard.writeText(inviteLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(roomCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    sendChatMessage(chatInput.trim(), replyTo?.id, replyTo?.username);
    setChatInput('');
    setReplyTo(null);
  };

  const formatChatMessage = (text: string) => {
    const parts = text.split(/(@[a-zA-Z0-9_]+)/g);
    return parts.map((part, i) => {
      if (part.startsWith('@')) {
        return (
          <span key={i} className="text-[#00B4D8] font-extrabold bg-[#00B4D8]/10 px-1 rounded select-all font-mono-tech">
            {part}
          </span>
        );
      }
      return part;
    });
  };

  // Upload handlers
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const lyricsInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedAudioFile, setSelectedAudioFile] = useState<File | null>(null);

  const handleSelectAudio = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedAudioFile(file);
    }
  };

  const handleUploadFiles = async () => {
    if (!selectedAudioFile) return;

    setUploading(true);
    setUploadError('');
    try {
      const lyricsFile = lyricsInputRef.current?.files?.[0];
      const track = await uploadTrack(selectedAudioFile, lyricsFile);
      addToQueue(track);
      setSelectedAudioFile(null);
      if (lyricsInputRef.current) lyricsInputRef.current.value = '';
    } catch (err: any) {
      setUploadError(err.message || 'File upload failed');
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

  const formatCountdown = (ms: number) => {
    const totalSecs = Math.floor(ms / 1000);
    const hrs = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleLeave = () => {
    if (confirm('Leave room?')) {
      if (socket && room) {
        socket.emit('room-leave', { roomId: room.roomId }, () => {
          router.push('/');
        });
      } else {
        router.push('/');
      }
    }
  };

  const getSyncColor = () => {
    if (syncStatus === 'synced' && Math.abs(drift) < 50) return 'text-[#00B4D8] bg-[#00B4D8]/10 border-[#00B4D8]/30 shadow-[0_0_10px_rgba(0,180,216,0.3)]';
    if (syncStatus === 'unstable') return 'text-[#FF5A5F] bg-[#FF5A5F]/10 border-[#FF5A5F]/30';
    return 'text-[#FF9F1C] bg-[#FF9F1C]/10 border-[#FF9F1C]/30';
  };

  const getSyncLabel = () => {
    if (syncStatus === 'unstable') return '⚠ UNSTABLE';
    if (Math.abs(drift) > 1500) return '⚡ HARD SEEK';
    if (Math.abs(drift) > 50) return `● SYNCING (±${Math.abs(drift)}ms)`;
    return `● SYNCED (Latency: ${Math.round(latency)}ms)`;
  };

  // Join prompt
  if (showJoinPrompt) {
    return (
      <div className="relative min-h-screen animate-ambient-blue-shift text-[#F4F4F5] flex items-center justify-center p-6">
        <GlassCard className="p-7 w-full max-w-md" glow={true}>
          <h2 className="text-xl font-display font-black text-white mb-1">Connect to SyncRoom</h2>
          <p className="text-[#8D99AE] text-xs mb-5">Enter username to join space <span className="font-mono-tech text-[#00B4D8]">{roomCode}</span></p>

          {promptError && (
            <div className="p-3 text-xs bg-[#FF5A5F]/10 border border-[#FF5A5F]/30 text-[#FF5A5F] rounded-xl mb-4 font-mono-tech">
              {promptError}
            </div>
          )}

          <form onSubmit={handleJoinSubmit} className="space-y-4">
            <div>
              <label className="block text-[10px] font-mono-tech font-bold text-[#8D99AE] uppercase tracking-wider mb-1.5">Your Username</label>
              <input
                type="text"
                required
                value={inputUsername}
                onChange={(e) => setInputUsername(e.target.value)}
                placeholder="e.g. ankit"
                className="w-full px-3.5 py-2.5 bg-[#0A1128] border border-[#00B4D8]/30 rounded-xl outline-none text-white text-xs font-mono-tech"
              />
            </div>
            
            <div className="bg-[#0A1128] p-3 rounded-xl border border-[#00B4D8]/20 space-y-2">
              <span className="text-xs font-bold text-zinc-300">Room Password?</span>
              <input
                type="password"
                value={inputPassword}
                onChange={(e) => setInputPassword(e.target.value)}
                placeholder="Enter password (if private)"
                className="w-full px-3.5 py-2 bg-black border border-[#00B4D8]/30 rounded-xl outline-none text-white text-xs font-mono-tech"
              />
            </div>

            <button
              type="submit"
              className="btn-solar-coral w-full py-3 text-xs font-extrabold rounded-xl cursor-pointer"
            >
              Connect Stream
            </button>
          </form>
        </GlassCard>
      </div>
    );
  }

  // Connecting screen
  if (syncError || !room) {
    return (
      <div className="relative min-h-screen animate-ambient-blue-shift text-[#F4F4F5] flex items-center justify-center p-6 text-center">
        <GlassCard className="p-8 w-full max-w-md space-y-5" glow={!!syncError}>
          <div className="p-3 bg-[#0A1128] border border-[#00B4D8]/40 rounded-full w-fit mx-auto animate-pulse">
            <Radio className="w-6 h-6 text-[#00B4D8]" />
          </div>
          {syncError ? (
            <div className="space-y-4">
              <h3 className="text-base font-display font-bold text-[#FF5A5F]">Connection Failed</h3>
              <p className="text-[#8D99AE] text-xs font-mono-tech">{syncError}</p>
              <div className="flex justify-center gap-2">
                <button
                  onClick={() => window.location.reload()}
                  className="px-4 py-2 bg-[#00F0FF] text-black font-extrabold rounded-xl text-xs hover:bg-[#0072FF] hover:text-white transition-all cursor-pointer"
                >
                  Retry Connection
                </button>
                <button
                  onClick={() => router.push('/')}
                  className="px-4 py-2 bg-[#0A1128] border border-[#00B4D8]/30 rounded-xl text-xs font-semibold hover:border-white transition-all cursor-pointer"
                >
                  Back to Lobby
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-1">
              <h3 className="text-base font-display font-bold text-white">Connecting to SyncRoom...</h3>
              <p className="text-[#8D99AE] text-xs font-mono-tech">Synchronizing NTP frame authority</p>
            </div>
          )}
        </GlassCard>
      </div>
    );
  }

  const currentTrack = room.currentTrack;
  const isPlaying = room.playback.isPlaying;
  const isDjBoothActive = room.djs && room.djs.length > 0;
  const currentDjName = isDjBoothActive ? room.djs![room.currentDjIndex || 0] : 'None';
  const isUserDj = isDjBoothActive && room.djs!.includes(username);

  return (
    <div className="relative min-h-screen animate-ambient-blue-shift text-[#F4F4F5] flex flex-col justify-between overflow-hidden">
      
      {/* Studio Header Bar */}
      <header className="relative z-20 w-full bg-[#0A1128]/80 backdrop-blur-md border-b border-[#00B4D8]/20 py-3.5 px-6 md:px-12 flex justify-between items-center">
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => router.push('/')}>
          <div className="p-2 bg-[#1C2541] border border-[#00B4D8]/40 rounded-xl">
            <Radio className="w-4 h-4 text-[#00B4D8]" />
          </div>
          <div>
            <h2 className="font-display font-extrabold text-base text-white luminous-wordmark-glow">{room.roomName}</h2>
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] border mt-0.5 font-mono-tech font-bold uppercase tracking-wider ${getSyncColor()}`}>
              {getSyncLabel()}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Host LIVE Tally Light */}
          {isHost && (
            <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[9px] font-mono-tech font-extrabold bg-[#FF5A5F]/10 text-[#FF5A5F] border border-[#FF5A5F]/30 uppercase tracking-wider">
              <Circle className="w-2 h-2 fill-[#FF5A5F] animate-pulse" />
              LIVE HOST TALLY
            </span>
          )}

          <button
            onClick={() => setShowInviteModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#1C2541]/80 border border-[#00B4D8]/30 rounded-xl text-xs font-semibold hover:border-[#00B4D8] transition-all cursor-pointer"
          >
            <UserPlus className="w-3.5 h-3.5 text-[#00B4D8]" />
            <span className="hidden md:inline">Invite Friends</span>
          </button>
          
          {isHost && (
            <button
              onClick={() => setShowMobileSettings(true)}
              className="md:hidden p-2 bg-[#1C2541] border border-[#00B4D8]/30 rounded-xl hover:bg-black cursor-pointer"
            >
              <Settings className="w-4 h-4" />
            </button>
          )}

          {isDjBoothMode && activeDjUsername && (
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 bg-[#00B4D8]/10 border border-[#00B4D8]/40 rounded-full text-xs font-bold text-[#00B4D8] shadow-[0_0_15px_rgba(0,180,216,0.2)] animate-pulse">
              <Disc className="w-3.5 h-3.5 animate-spin" />
              <span>Now DJing: @{activeDjUsername}</span>
              {isCurrentDj && <span className="ml-1 text-[9px] bg-[#00B4D8] text-black px-1.5 py-0.2 rounded font-black">YOU</span>}
            </div>
          )}

          <button
            onClick={() => setShowLeaveConfirmModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#FF5A5F]/10 border border-[#FF5A5F]/30 text-[#FF5A5F] hover:bg-[#FF5A5F]/20 rounded-xl text-xs font-semibold transition-all cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            Leave
          </button>
        </div>
      </header>

      {/* Autoplay Safeguard Banner */}
      {autoplayBlocked && (
        <div className="relative z-30 bg-[#1C2541] border-b border-[#00B4D8]/30 text-white py-2.5 px-6 flex justify-between items-center text-xs font-bold shadow-lg">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-[#00B4D8] shrink-0" />
            <span>Browser autoplay blocked. Click Unmute to sync playback.</span>
          </div>
          <button
            onClick={handleUnblockAutoplay}
            className="btn-solar-coral px-3 py-1 rounded-lg transition-all text-xs font-extrabold cursor-pointer"
          >
            Unmute & Sync
          </button>
        </div>
      )}

      {/* Main Grid Interface */}
      <main className="relative z-10 flex-grow grid grid-cols-1 md:grid-cols-12 gap-6 p-6 max-w-7xl mx-auto w-full overflow-hidden">
        
        {/* LEFT COLUMN: Queue, DJ Booth, and Uploads (Col span 3) */}
        <div className={`md:col-span-3 flex flex-col gap-6 h-[76vh] overflow-y-auto ${activeTab === 'queue' ? 'flex' : 'hidden md:flex'}`}>
          
          {/* Upload Card */}
          {(!room.settings.collaborativeMode && !isHost) ? (
            <GlassCard className="p-4 text-center text-[#8D99AE] text-xs font-mono-tech">
              Uploads locked to Host.
            </GlassCard>
          ) : (
            <GlassCard className="p-4 border-dashed border-[#00B4D8]/30 hover:border-[#00B4D8] transition-all">
              <input
                type="file"
                accept=".mp3,.wav,.ogg,.m4a"
                className="hidden"
                id="audio-upload-input"
                onChange={handleSelectAudio}
                disabled={uploading}
              />
              <input
                type="file"
                accept=".lrc,.txt"
                className="hidden"
                id="lyrics-upload-input"
                ref={lyricsInputRef}
                disabled={uploading}
              />
              
              {!selectedAudioFile ? (
                <div
                  onClick={() => setShowAddSongModal(true)}
                  className="flex flex-col items-center justify-center py-3 cursor-pointer gap-2"
                >
                  <div className="p-2.5 bg-[#0A1128] border border-[#00B4D8]/40 rounded-xl">
                    <Plus className="w-4 h-4 text-[#00B4D8]" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-center">Add Song (Upload / Spotify / YouTube)</p>
                    <p className="text-[#8D99AE] text-[9px] font-mono-tech text-center mt-0.5">Choose source tab to queue tracks</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="p-2.5 bg-[#0A1128] border border-[#00B4D8]/20 rounded-xl flex items-center justify-between text-xs font-mono-tech">
                    <span className="font-extrabold text-white truncate max-w-[140px]">{selectedAudioFile.name}</span>
                    <button onClick={() => setSelectedAudioFile(null)} className="text-[#8D99AE] hover:text-white">&times;</button>
                  </div>

                  <div className="bg-[#0A1128] p-2.5 rounded-xl border border-[#00B4D8]/20 space-y-1.5">
                    <span className="block text-[9px] font-mono-tech font-bold text-[#8D99AE] uppercase tracking-wider">Synced Lyrics (.LRC optional)</span>
                    <button
                      onClick={() => document.getElementById('lyrics-upload-input')?.click()}
                      className="w-full py-1.5 bg-[#1C2541] hover:bg-black text-white rounded-lg text-[9px] font-mono-tech font-bold border border-[#00B4D8]/30 transition-all cursor-pointer flex items-center justify-center gap-1"
                    >
                      <FileText className="w-3 h-3 text-[#00B4D8]" /> Select LRC file
                    </button>
                  </div>

                  {uploadError && <p className="text-[10px] text-[#FF5A5F] font-mono-tech font-semibold">{uploadError}</p>}

                  <button
                    onClick={handleUploadFiles}
                    disabled={uploading}
                    className="btn-solar-coral w-full py-2 text-xs font-extrabold rounded-xl cursor-pointer"
                  >
                    {uploading ? 'Uploading...' : 'Confirm Upload'}
                  </button>
                </div>
              )}
            </GlassCard>
          )}

          {/* DJ Booth Card */}
          <GlassCard className="p-4 shrink-0">
            <div className="flex justify-between items-center mb-2.5">
              <h3 className="text-xs font-mono-tech font-bold uppercase tracking-wider text-[#8D99AE] flex items-center gap-1.5">
                <Disc className="w-3.5 h-3.5 text-[#00B4D8] animate-spin" />
                DJ Booth
              </h3>

              <div className="flex items-center gap-2">
                {isHost && (
                  <button
                    onClick={() => updateSettings({ djBoothMode: !isDjBoothMode })}
                    className={`text-[9px] font-mono-tech font-bold px-2 py-0.5 rounded-lg border transition-all cursor-pointer ${
                      isDjBoothMode ? 'bg-[#00B4D8] text-black border-[#00B4D8]' : 'bg-[#1C2541] text-[#8D99AE] border-[#00B4D8]/30 hover:text-white'
                    }`}
                  >
                    {isDjBoothMode ? 'DJ Mode Active' : 'Enable DJ Mode'}
                  </button>
                )}

                {isUserDj ? (
                  <button
                    onClick={leaveDjBooth}
                    className="text-[10px] font-mono-tech font-bold text-[#FF5A5F] hover:underline cursor-pointer"
                  >
                    Step Down
                  </button>
                ) : (
                  <button
                    onClick={joinDjBooth}
                    className="text-[10px] font-mono-tech font-bold text-[#00B4D8] hover:underline cursor-pointer"
                  >
                    Join Booth
                  </button>
                )}
              </div>
            </div>

            {isDjBoothMode ? (
              <div className="space-y-2">
                <div className="bg-[#0A1128] border border-[#00B4D8]/40 p-2.5 rounded-xl text-xs flex justify-between items-center">
                  <div>
                    <span className="text-[9px] font-mono-tech font-bold text-[#00B4D8] block uppercase tracking-wider">Active DJ Spinning</span>
                    <p className="font-extrabold text-white mt-0.5 flex items-center gap-1">
                      🎧 @{activeDjUsername || 'No DJ Active'}
                      {isCurrentDj && <span className="text-[8px] bg-[#00B4D8] text-black px-1.5 py-0.2 rounded font-black">YOU</span>}
                    </p>
                  </div>

                  {isHost && (
                    <button
                      onClick={skipDjTurn}
                      className="text-[9px] font-mono-tech font-bold px-2.5 py-1 bg-[#FF5A5F]/10 text-[#FF5A5F] border border-[#FF5A5F]/30 hover:bg-[#FF5A5F]/20 rounded-lg cursor-pointer transition-all"
                    >
                      Skip DJ
                    </button>
                  )}
                </div>

                <div className="text-[9px] text-[#8D99AE] font-mono-tech truncate">
                  Rotation Line: {room?.djs && room.djs.length > 0 ? room.djs.map((name, idx) => (idx === (room.currentDjIndex || 0) ? `🎧 @${name} (Active)` : `@${name}`)).join(' → ') : 'No DJs in rotation queue'}
                </div>
              </div>
            ) : isDjBoothActive ? (
              <div className="space-y-1.5">
                <div className="bg-[#0A1128] border border-[#00B4D8]/40 p-2 rounded-xl text-xs">
                  <span className="text-[9px] font-mono-tech font-bold text-[#00B4D8] block uppercase tracking-wider">Active DJ Spinning</span>
                  <p className="font-extrabold text-white mt-0.5">🎧 @{currentDjName}</p>
                </div>
                <div className="text-[9px] text-[#8D99AE] font-mono-tech truncate">
                  DJs in booth: {room.djs!.map(name => `@${name}`).join(', ')}
                </div>
              </div>
            ) : (
              <p className="text-[9px] text-[#8D99AE] font-mono-tech italic">No DJs active. Host manages stream.</p>
            )}
          </GlassCard>

          {/* Queue List */}
          <GlassCard className="p-4 flex-grow flex flex-col justify-between overflow-hidden">
            <div className="space-y-3 flex flex-col overflow-hidden">
              <h3 className="text-xs font-mono-tech font-bold uppercase tracking-wider text-[#8D99AE] flex items-center gap-1.5 shrink-0">
                <ListMusic className="w-3.5 h-3.5" />
                Up Next ({room.queue.length})
              </h3>
              
              <div className="space-y-2 overflow-y-auto max-h-[36vh] pr-1 flex-grow">
                {room.queue.length === 0 ? (
                  <div className="text-center py-8 text-[#8D99AE] text-xs font-mono-tech">
                    Queue is empty.
                  </div>
                ) : (
                  room.queue.map((track, i) => {
                    const userVote = track.votes[username] || 'none';
                    return (
                      <div
                        key={track.id}
                        className={`flex items-center justify-between p-2 rounded-xl border transition-all text-xs
                          ${track.approved ? 'bg-[#0A1128] border-[#00B4D8]/15 hover:border-[#00B4D8]/40' : 'bg-[#FF5A5F]/5 border-[#FF5A5F]/20'}
                        `}
                      >
                        <div className="flex gap-2 min-w-0 items-center">
                          <span className="text-[#8D99AE] font-mono-tech font-bold text-[10px] w-3 text-center">{i + 1}</span>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1">
                              <p className="font-bold text-white truncate text-xs">
                                {track.title}
                              </p>
                              {track.source === 'spotify' && (
                                <span title="Spotify Premium required" className="text-[8px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-1 py-0.2 rounded font-mono-tech font-bold shrink-0">
                                  🎵 Spotify
                                </span>
                              )}
                              {track.source === 'youtube' && (
                                <span className="text-[8px] bg-red-500/20 text-red-400 border border-red-500/30 px-1 py-0.2 rounded font-mono-tech font-bold shrink-0">
                                  ▶️ YouTube
                                </span>
                              )}
                              {(track.source === 'upload' || !track.source) && (
                                <span className="text-[8px] bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 px-1 py-0.2 rounded font-mono-tech font-bold shrink-0">
                                  📁 Upload
                                </span>
                              )}
                            </div>
                            <p className="text-[9px] text-[#8D99AE] truncate">@{track.uploadedBy}</p>
                            {!track.approved && (
                              <span className="inline-block mt-0.5 text-[8px] bg-[#FF5A5F]/10 text-[#FF5A5F] px-1 py-0.5 rounded border border-[#FF5A5F]/25 uppercase font-mono-tech font-bold tracking-wider">
                                Pending Approval
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0 ml-2">
                          {room.settings.enableVoting && (
                            <div className="flex items-center bg-[#1C2541] rounded-lg p-0.5 border border-[#00B4D8]/20">
                              <button
                                onClick={() => voteTrack(track.id, userVote === 'up' ? 'none' : 'up')}
                                className={`p-0.5 rounded transition-all cursor-pointer ${userVote === 'up' ? 'text-[#FF5A5F] font-black' : 'text-[#8D99AE] hover:text-white'}`}
                              >
                                <ChevronUp className="w-3.5 h-3.5" />
                              </button>
                              <span className="text-[10px] font-bold px-1 text-[#00B4D8] min-w-[12px] text-center font-mono-tech">
                                {track.voteCount || 0}
                              </span>
                              <button
                                onClick={() => voteTrack(track.id, userVote === 'down' ? 'none' : 'down')}
                                className={`p-0.5 rounded transition-all cursor-pointer ${userVote === 'down' ? 'text-[#00B4D8] font-black' : 'text-[#8D99AE] hover:text-white'}`}
                              >
                                <ChevronDown className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}

                          <span className="text-[9px] text-[#8D99AE] font-mono-tech">{formatTime(track.duration)}</span>
                          
                          <div className="flex items-center gap-1">
                            {!track.approved && isHost && (
                              <button
                                onClick={() => approveTrack(track.id)}
                                className="p-1 text-green-400 hover:text-green-300 rounded transition-all cursor-pointer"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {((isHost) || (track.uploadedBy === username)) && (
                              <button
                                onClick={() => removeFromQueue(track.id)}
                                className="p-1 text-[#8D99AE] hover:text-[#FF5A5F] rounded transition-all cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {room.queue.length > 0 && isHost && (
              <button
                onClick={() => {
                  if (confirm('Clear queue?')) {
                    socket?.emit('queue-update', { roomId: room.roomId, queue: [] });
                  }
                }}
                className="w-full mt-3 py-1.5 border border-[#00B4D8]/20 hover:border-[#FF5A5F]/40 text-[#8D99AE] hover:text-[#FF5A5F] rounded-xl text-[10px] font-mono-tech font-semibold transition-all cursor-pointer"
              >
                Clear Queue
              </button>
            )}
          </GlassCard>
        </div>

        {/* CENTER COLUMN: 3D Headphones Centerpiece & Synced Lyrics (Col span 6) */}
        <div className={`md:col-span-6 flex flex-col gap-6 h-[76vh] justify-between ${activeTab === 'player' ? 'flex' : 'hidden md:flex'}`}>
          <GlassCard className="p-8 flex-grow flex flex-col justify-center items-center relative overflow-hidden" glow={isPlaying}>
            
            {/* Reactions Overlay */}
            <div className="absolute inset-0 pointer-events-none select-none overflow-hidden z-20">
              <AnimatePresence>
                {reactions.map((react: ReactionItem) => (
                  <motion.div
                    key={react.id}
                    initial={{ bottom: '15%', left: `${react.x}%`, opacity: 1, scale: 0.8 }}
                    animate={{ bottom: '80%', opacity: 0, scale: 1.3, y: -120 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 2, ease: 'easeOut' }}
                    className="absolute text-3xl font-bold filter drop-shadow"
                  >
                    {react.emoji}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            {/* Scheduled Countdown Overlay */}
            {room.scheduledStartTime && !room.isStarted ? (
              <div className="space-y-5 text-center z-10 flex flex-col items-center justify-center p-8 bg-[#0A1128] border border-[#00B4D8]/30 rounded-3xl max-w-sm blue-glass-card">
                <Calendar className="w-10 h-10 text-[#00B4D8] animate-pulse" />
                <div>
                  <h3 className="text-base font-display font-extrabold text-white">Scheduled Session</h3>
                  <p className="text-[#8D99AE] text-[10px] uppercase font-mono-tech tracking-wider mt-0.5">Host: @{room.participants.find(p => p.isHost)?.username}</p>
                </div>
                
                <div className="space-y-1">
                  <span className="block text-[10px] font-mono-tech font-bold text-[#8D99AE] uppercase tracking-widest">Starts in</span>
                  <span className="text-2xl font-black text-[#00B4D8] font-mono-tech tracking-widest">{formatCountdown(timeLeft)}</span>
                </div>

                {isHost && (
                  <button
                    onClick={startScheduledRoom}
                    className="btn-solar-coral px-5 py-2 font-extrabold text-xs rounded-xl cursor-pointer"
                  >
                    Start Session Now
                  </button>
                )}
              </div>
            ) : (
              <>
                {/* Visualizer Equalizer */}
                {isPlaying && (
                  <div className="absolute top-8 flex gap-1.5 justify-center items-end h-7">
                    {[...Array(12)].map((_, i) => (
                      <div
                        key={i}
                        className="w-1 bg-[#00B4D8] rounded-full equalizer-bar"
                        style={{ animationDelay: `${i * 0.1}s`, animationDuration: `${0.8 + Math.random() * 0.6}s` }}
                      />
                    ))}
                  </div>
                )}

                {/* Player Mode Switch: Multi-Source Player / 3D Headphones / Synced Lyrics */}
                {currentTrack?.source === 'spotify' ? (
                  <div className="my-4 w-full max-w-sm">
                    <SpotifyPlayerBackend
                      spotifyUri={currentTrack.spotifyUri || currentTrack.url}
                      accessToken={spotifyAccessToken}
                      isPlaying={isPlaying}
                      position={audioElement?.currentTime || 0}
                      volume={volume}
                    />
                  </div>
                ) : currentTrack?.source === 'youtube' ? (
                  <div className="my-4 w-full max-w-sm">
                    <YouTubePlayerBackend
                      youtubeId={currentTrack.youtubeId || currentTrack.url}
                      isPlaying={isPlaying}
                      position={audioElement?.currentTime || 0}
                      volume={volume}
                    />
                  </div>
                ) : (activePlayerMode === 'cd' || lyrics.length === 0) ? (
                  <div className="relative my-4 group flex flex-col items-center">
                    <Headphones3D className="w-60 h-60 md:w-64 md:h-64" />
                  </div>
                ) : (
                  /* Synced Lyrics Scroll Sheet */
                  <div
                    ref={lyricsContainerRef}
                    className="w-full max-h-[28vh] overflow-y-auto space-y-4 px-6 my-6 text-center select-none lyrics-scroll-box scrollbar-none"
                    style={{ scrollBehavior: 'smooth' }}
                  >
                    {lyrics.map((lyric, idx) => {
                      const curTime = audioElement?.currentTime || 0;
                      const isActive = curTime >= lyric.time && (idx === lyrics.length - 1 || curTime < lyrics[idx + 1].time);
                      return (
                        <p
                          key={idx}
                          className={`text-sm md:text-base font-extrabold transition-all duration-300 leading-normal
                            ${isActive ? 'text-[#00B4D8] scale-105 opacity-100 luminous-wordmark-glow' : 'text-[#8D99AE] opacity-30'}
                          `}
                        >
                          {lyric.text}
                        </p>
                      );
                    })}
                  </div>
                )}

                {/* Track Info */}
                <div className="text-center max-w-sm mb-4 flex flex-col items-center">
                  <h3 className="text-xl font-display font-extrabold text-white truncate w-60">
                    {currentTrack ? currentTrack.title : 'No Track Selected'}
                  </h3>
                  <p className="text-xs text-[#8D99AE] truncate mt-0.5">
                    {currentTrack ? `Uploaded by @${currentTrack.artist}` : 'Queue a song to begin synchronization'}
                  </p>

                  {lyrics.length > 0 && (
                    <button
                      onClick={() => setActivePlayerMode(activePlayerMode === 'cd' ? 'lyrics' : 'cd')}
                      className="mt-3 px-3.5 py-1.5 bg-[#0A1128] border border-[#00B4D8]/30 rounded-xl text-[10px] font-mono-tech font-bold text-white hover:border-[#00B4D8] transition-all flex items-center gap-1 cursor-pointer"
                    >
                      <FileText className="w-3.5 h-3.5 text-[#00B4D8]" />
                      {activePlayerMode === 'cd' ? 'Show Synced Lyrics' : 'Show 3D Headphones'}
                    </button>
                  )}
                </div>

                {/* Timeline Slider */}
                <div className="w-full space-y-1.5 mt-2 px-2">
                  <div className="flex justify-between items-center text-[11px] text-[#8D99AE] font-mono-tech">
                    <span>{audioElement ? formatTime(audioElement.currentTime) : '0:00'}</span>
                    <span>{currentTrack ? formatTime(currentTrack.duration) : '0:00'}</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max={currentTrack?.duration || 100}
                    value={audioElement ? audioElement.currentTime : 0}
                    disabled={!currentTrack || !hasControl}
                    onChange={(e) => seek(parseFloat(e.target.value))}
                    className="w-full accent-[#00B4D8] disabled:opacity-40 cursor-pointer"
                  />
                </div>

                {/* Player Controls */}
                <div className="flex items-center justify-between w-full max-w-sm mt-5 px-4">
                  <div className="flex items-center gap-1.5 w-1/4">
                    <Volume2 className="w-3.5 h-3.5 text-[#8D99AE] shrink-0" />
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.01"
                      value={volume}
                      onChange={(e) => setVolume(parseFloat(e.target.value))}
                      className="w-full accent-white h-1 cursor-pointer"
                    />
                  </div>

                  <div className="flex items-center gap-4">
                    <button
                      onClick={togglePlayPause}
                      disabled={!currentTrack || !hasControl}
                      className="btn-solar-coral p-3.5 rounded-full hover:scale-105 active:scale-95 transition-all shadow-lg disabled:opacity-40 cursor-pointer"
                    >
                      {isPlaying ? <Pause className="w-5 h-5 fill-white text-white" /> : <Play className="w-5 h-5 fill-white text-white ml-0.5" />}
                    </button>

                    <button
                      onClick={nextTrack}
                      disabled={!currentTrack}
                      className="p-2.5 bg-[#0A1128] border border-[#00B4D8]/30 rounded-full hover:border-white disabled:opacity-40 cursor-pointer"
                    >
                      <SkipForward className="w-4 h-4 text-white" />
                    </button>
                  </div>

                  <div className="w-1/4 flex justify-end text-[10px] text-[#8D99AE] font-bold tracking-widest font-mono-tech">
                    {isHost ? 'HOST' : 'SYNCED'}
                  </div>
                </div>

                {/* Reactions bar */}
                {room.settings.enableReactions && (
                  <div className="mt-6 flex gap-2 bg-[#0A1128] border border-[#00B4D8]/20 p-2 rounded-xl">
                    {['❤️', '🔥', '😂', '😭', '👀', '💯', '🎵'].map((emoji) => (
                      <button
                        key={emoji}
                        onClick={() => sendReaction(emoji)}
                        className="text-lg hover:scale-125 transition-transform duration-150 cursor-pointer active:scale-95"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}

          </GlassCard>
        </div>

        {/* RIGHT COLUMN: Chat, Listeners, Activity & Delay Slider (Col span 3) */}
        <div className={`md:col-span-3 flex flex-col gap-6 h-[76vh] ${activeTab === 'chat' || activeTab === 'people' ? 'flex' : 'hidden md:flex'}`}>
          
          {/* Settings Card */}
          <GlassCard className={`p-4 space-y-3 shrink-0 ${activeTab === 'people' ? 'flex flex-col' : 'hidden md:flex md:flex-col'}`}>
            <h3 className="text-xs font-mono-tech font-bold uppercase tracking-wider text-[#8D99AE] flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-[#00B4D8]" />
              Room Settings
            </h3>
            
            <div className="space-y-2 text-xs max-h-[18vh] overflow-y-auto pr-1">
              <div className="flex justify-between items-center">
                <span className="text-zinc-300 font-semibold">Collaborative Mode</span>
                <input
                  type="checkbox"
                  disabled={!isHost}
                  checked={room.settings.collaborativeMode}
                  onChange={(e) => updateSettings({ collaborativeMode: e.target.checked })}
                  className="w-3.5 h-3.5 text-[#FF5A5F] bg-[#0A1128] border-[#00B4D8]/30 rounded cursor-pointer"
                />
              </div>

              {/* Calibration Slider */}
              <div className="border-t border-[#00B4D8]/20 pt-2">
                <button
                  onClick={() => setShowAdvancedTuning(!showAdvancedTuning)}
                  className="w-full flex justify-between items-center text-[9px] font-mono-tech font-bold uppercase tracking-wider text-[#8D99AE] hover:text-white"
                >
                  <span>Advanced Audio Delay</span>
                  <Sliders className="w-3 h-3 text-[#00B4D8]" />
                </button>

                {showAdvancedTuning && (
                  <div className="mt-2 space-y-1.5 text-[10px] bg-[#0A1128] p-2.5 rounded-xl border border-[#00B4D8]/20 font-mono-tech">
                    <div className="flex justify-between font-bold text-zinc-300">
                      <span>Local Delay:</span>
                      <span className="text-[#00B4D8]">{audioDelay > 0 ? `+${audioDelay}` : audioDelay} ms</span>
                    </div>
                    <input
                      type="range"
                      min="-200"
                      max="200"
                      step="10"
                      value={audioDelay}
                      onChange={(e) => saveAudioDelay(parseInt(e.target.value))}
                      className="w-full accent-[#00B4D8] cursor-pointer"
                    />
                  </div>
                )}
              </div>
            </div>
          </GlassCard>

          {/* Active Listeners List */}
          <GlassCard className={`p-4 max-h-[16vh] flex flex-col overflow-hidden shrink-0 ${activeTab === 'people' ? 'flex' : 'hidden md:flex'}`}>
            <h3 className="text-xs font-mono-tech font-bold uppercase tracking-wider text-[#8D99AE] flex items-center gap-1.5 mb-2">
              <Users className="w-3.5 h-3.5 text-[#00B4D8]" />
              Listeners ({room.participants.length})
            </h3>
            
            <div className="space-y-1.5 overflow-y-auto flex-grow pr-1">
              {room.participants.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between p-1.5 bg-[#0A1128] rounded-xl border border-[#00B4D8]/10 text-xs"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className={`w-2 h-2 rounded-full ${user.isOnline ? 'bg-[#00B4D8]' : 'bg-zinc-600'}`} />
                    <span className="font-bold text-zinc-200 truncate">@{user.username}</span>
                    {user.isHost && (
                      <span title="Room Host">
                        <Shield className="w-3 h-3 text-[#FF5A5F] shrink-0" />
                      </span>
                    )}
                  </div>
                  {isHost && user.id !== socket?.id && (
                    <div className="flex gap-1">
                      <button
                        onClick={() => kickParticipant(user.id)}
                        className="px-1.5 py-0.5 bg-[#FF5A5F]/10 text-[#FF5A5F] border border-[#FF5A5F]/20 text-[9px] font-bold rounded hover:bg-[#FF5A5F]/20 cursor-pointer"
                      >
                        Kick
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </GlassCard>

          {/* Activity Log */}
          <GlassCard className={`p-4 max-h-[16vh] flex flex-col overflow-hidden shrink-0 ${activeTab === 'people' ? 'flex' : 'hidden md:flex'}`}>
            <h3 className="text-[10px] font-mono-tech font-bold uppercase tracking-wider text-[#8D99AE] flex items-center gap-1.5 mb-2 shrink-0">
              <Activity className="w-3.5 h-3.5 text-[#00B4D8]" />
              Activity Log
            </h3>
            <div className="flex-grow overflow-y-auto space-y-1 pr-1 text-[10px] text-[#8D99AE] font-mono-tech">
              {activityLog.length === 0 ? (
                <div className="text-zinc-600 text-center py-2">No activity recorded</div>
              ) : (
                activityLog.map((log) => (
                  <div key={log.id} className="flex justify-between gap-1 border-b border-[#00B4D8]/10 pb-0.5">
                    <span className="truncate">{log.text}</span>
                  </div>
                ))
              )}
            </div>
          </GlassCard>

          {/* Live Chat Panel */}
          <GlassCard className={`p-4 flex-grow flex flex-col justify-between overflow-hidden ${activeTab === 'chat' ? 'flex' : 'hidden md:flex'}`}>
            <div className="flex flex-col flex-grow overflow-hidden">
              <h3 className="text-xs font-mono-tech font-bold uppercase tracking-wider text-[#8D99AE] flex items-center gap-1.5 mb-2 shrink-0">
                <MessageSquare className="w-3.5 h-3.5 text-[#00B4D8]" />
                Live Chat
              </h3>

              {!room.settings.enableChat ? (
                <div className="text-center py-8 text-[#8D99AE] text-xs flex-grow font-mono-tech">
                  Chat disabled by host.
                </div>
              ) : (
                <div className="flex-grow overflow-y-auto space-y-2 mb-2 pr-1 max-h-[30vh]">
                  {chatMessages.length === 0 ? (
                    <div className="text-center py-8 text-[#8D99AE] text-xs font-mono-tech">
                      No messages yet.
                    </div>
                  ) : (
                    chatMessages.map((msg: ChatMessage) => (
                      <div key={msg.id} className="text-xs bg-[#0A1128] p-2 rounded-xl border border-[#00B4D8]/10 relative group">
                        <button
                          onClick={() => setReplyTo({ id: msg.id, username: msg.username })}
                          className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 p-0.5 text-[#8D99AE] hover:text-white cursor-pointer"
                        >
                          <CornerDownRight className="w-3 h-3" />
                        </button>

                        {msg.replyToUser && (
                          <div className="text-[9px] text-[#8D99AE] font-mono-tech flex items-center gap-1 mb-1 border-b border-[#00B4D8]/10 pb-0.5">
                            <CornerDownRight className="w-2.5 h-2.5" />
                            <span>replying to @{msg.replyToUser}</span>
                          </div>
                        )}
                        <span className="font-extrabold text-[#00B4D8] text-[11px]">@{msg.username}</span>
                        <p className="text-zinc-200 mt-0.5 break-all leading-snug select-text">
                          {formatChatMessage(msg.message)}
                        </p>
                      </div>
                    ))
                  )}
                  <div ref={chatEndRef} />
                </div>
              )}
            </div>

            {room.settings.enableChat && (
              <div className="space-y-1.5">
                {replyTo && (
                  <div className="flex items-center justify-between bg-[#0A1128] px-2.5 py-1 text-[9px] text-[#8D99AE] font-mono-tech rounded-lg border border-[#00B4D8]/20">
                    <span>Replying to @{replyTo.username}</span>
                    <button onClick={() => setReplyTo(null)} className="text-[#8D99AE] hover:text-white font-bold">&times;</button>
                  </div>
                )}

                <form onSubmit={handleSendChat} className="flex gap-1.5">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Message room..."
                    className="flex-grow px-3 py-1.5 bg-[#0A1128] border border-[#00B4D8]/30 rounded-xl outline-none text-white text-xs"
                  />
                  <button
                    type="submit"
                    className="btn-solar-coral p-1.5 font-extrabold rounded-xl cursor-pointer shrink-0"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </form>
              </div>
            )}
          </GlassCard>
        </div>

      </main>

      {/* Mobile Nav Tabs */}
      <div className="md:hidden sticky bottom-0 z-50 w-full bg-[#0A1128]/90 backdrop-blur-md border-t border-[#00B4D8]/20 py-2.5 px-6 flex justify-around items-center text-xs">
        <button onClick={() => setActiveTab('player')} className={`flex flex-col items-center gap-0.5 ${activeTab === 'player' ? 'text-[#00B4D8] font-bold' : 'text-[#8D99AE]'}`}>
          <Radio className="w-4 h-4" />
          <span>Player</span>
        </button>
        <button onClick={() => setActiveTab('queue')} className={`flex flex-col items-center gap-0.5 ${activeTab === 'queue' ? 'text-[#00B4D8] font-bold' : 'text-[#8D99AE]'}`}>
          <ListMusic className="w-4 h-4" />
          <span>Queue</span>
        </button>
        <button onClick={() => setActiveTab('chat')} className={`flex flex-col items-center gap-0.5 ${activeTab === 'chat' ? 'text-[#00B4D8] font-bold' : 'text-[#8D99AE]'}`}>
          <MessageSquare className="w-4 h-4" />
          <span>Chat</span>
        </button>
        <button onClick={() => setActiveTab('people')} className={`flex flex-col items-center gap-0.5 ${activeTab === 'people' ? 'text-[#00B4D8] font-bold' : 'text-[#8D99AE]'}`}>
          <Users className="w-4 h-4" />
          <span>People</span>
        </button>
      </div>

      {/* Invite Modal */}
      <AnimatePresence>
        {showInviteModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="w-full max-w-sm">
              <GlassCard className="p-7 text-center relative border-[#00B4D8]/30" glow={true}>
                <button onClick={() => setShowInviteModal(false)} className="absolute top-4 right-4 text-[#8D99AE] hover:text-white text-base">&times;</button>
                <h3 className="text-base font-display font-black text-white mb-5">Invite Friends to SyncRoom</h3>

                {session?.user && (
                  <div className="mb-4 bg-[#0A1128] border border-[#00B4D8]/20 p-3 rounded-xl text-left space-y-2">
                    <span className="text-[9px] font-mono-tech font-bold text-[#8D99AE] uppercase tracking-wider block">Invite Connected Friends</span>
                    <div className="space-y-1.5 max-h-[18vh] overflow-y-auto">
                      {onlineFriends.length === 0 ? (
                        <p className="text-[9px] text-[#8D99AE] font-mono-tech italic">No friends connected to invite.</p>
                      ) : (
                        onlineFriends.map((fr) => (
                          <div key={fr.id} className="flex justify-between items-center p-1.5 bg-[#1C2541] border border-[#00B4D8]/20 rounded-lg text-xs">
                            <span className="font-bold text-zinc-300 text-xs">@{fr.friendName}</span>
                            <button
                              onClick={() => {
                                sendFriendInvite(fr.friendName);
                                alert(`Invitation alert sent to @${fr.friendName}!`);
                              }}
                              className="btn-solar-coral px-2 py-0.5 rounded text-[9px] font-bold cursor-pointer"
                            >
                              Invite
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}

                <div className="bg-[#0A1128] border border-[#00B4D8]/20 p-4 rounded-xl mb-4">
                  <span className="block text-[9px] font-mono-tech font-bold text-[#8D99AE] uppercase tracking-wider mb-1">Room Code</span>
                  <span className="text-xl font-black text-[#00B4D8] font-mono-tech tracking-widest select-all">{roomCode}</span>
                </div>

                <div className="space-y-2">
                  <button onClick={handleCopyCode} className="w-full py-2 bg-[#0A1128] border border-[#00B4D8]/30 text-white rounded-xl text-xs font-semibold hover:border-white transition-all cursor-pointer">
                    {copiedCode ? 'Copied Code!' : 'Copy Code'}
                  </button>
                  <button onClick={handleCopyLink} className="btn-solar-coral w-full py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer shadow-md">
                    {copiedLink ? 'Copied Link!' : 'Copy Invite Link'}
                  </button>
                </div>
              </GlassCard>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Song Multi-Source Modal */}
      <AddSongModal
        isOpen={showAddSongModal}
        onClose={() => setShowAddSongModal(false)}
        onAddTrack={addToQueue}
        onUploadFile={uploadTrack}
      />
      {/* LEAVE ROOM CONFIRMATION MODAL */}
      {showLeaveConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md select-none">
          <div className="w-full max-w-sm bg-[#0A1128] border border-[#00B4D8]/30 rounded-3xl p-6 shadow-2xl space-y-4 relative">
            <button
              onClick={() => setShowLeaveConfirmModal(false)}
              className="absolute top-5 right-5 text-zinc-400 hover:text-white text-lg font-bold cursor-pointer"
            >
              &times;
            </button>
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-[#FF5A5F]/10 border border-[#FF5A5F]/30 rounded-2xl shrink-0">
                <LogOut className="w-5 h-5 text-[#FF5A5F]" />
              </div>
              <div>
                <h3 className="text-base font-display font-extrabold text-white">Leave Room Space?</h3>
                <p className="text-[#8D99AE] text-[10px] font-mono-tech uppercase">Room: {room?.roomName || roomCode}</p>
              </div>
            </div>
            <p className="text-xs text-[#8D99AE] leading-relaxed">
              You can rejoin anytime from the homepage. Your presence history will be updated cleanly.
            </p>
            <div className="flex justify-end gap-2.5 pt-2">
              <button
                onClick={() => setShowLeaveConfirmModal(false)}
                className="px-4 py-2 bg-[#1C2541] hover:bg-black text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={confirmLeave}
                className="px-5 py-2 bg-[#FF5A5F] hover:bg-red-600 text-white rounded-xl text-xs font-extrabold shadow-lg transition-all cursor-pointer"
              >
                Confirm Leave
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
