'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import dynamic from 'next/dynamic';
import { getBackendUrl } from '@/lib/config';
import { safeFetchJson } from '@/lib/api';
import { useSyncPlayer, Track, TrackSource, ChatMessage, ReactionItem, LyricLine } from '@/hooks/useSyncPlayer';
import {
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Repeat,
  Repeat1,
  UserX,
  Volume2,
  VolumeX,
  Radio,
  Plus,
  Trash2,
  MessageSquare,
  LogOut,
  Settings,
  Shield,
  Disc,
  Info,
  ListMusic,
  ChevronDown,
  Calendar,
  Smile,
  CornerDownRight,
  Sparkles,
  SlidersHorizontal,
  FileText,
  Music,
  Crown,
  Headphones,
  Heart,
  MoreVertical,
  Shuffle,
  Home,
  X,
  GripVertical,
  UserPlus
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

import TurntableHero from '@/components/TurntableHero';

// Lazy load player backends and modals
const SpotifyPlayerBackend = dynamic(() => import('@/components/SpotifyPlayerBackend'), { ssr: false });
const YouTubePlayerBackend = dynamic(() => import('@/components/YouTubePlayerBackend'), { ssr: false });
const AddSongModal = dynamic(() => import('@/components/AddSongModal'), { ssr: false });

export default function RoomPage() {
  const router = useRouter();
  const rawParams = useParams();
  const roomCode = (rawParams?.code as string)?.toUpperCase();
  const searchParams = useSearchParams();
  const { data: session } = useSession();

  // Credentials
  const [username, setUsername] = useState(searchParams.get('username') || '');
  const [password, setPassword] = useState(() => {
    if (typeof window !== 'undefined') {
      const stored = sessionStorage.getItem('syncroom_join_password');
      if (stored) {
        sessionStorage.removeItem('syncroom_join_password');
        return stored;
      }
    }
    return searchParams.get('password') || '';
  });
  const [showJoinPrompt, setShowJoinPrompt] = useState(!searchParams.get('username'));

  const [inputUsername, setInputUsername] = useState('');
  const [inputPassword, setInputPassword] = useState('');
  const [promptError, setPromptError] = useState('');

  // Copy indicators
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  // Stitch dynamic navigation layout views: 'home' | 'queue' | 'chat' | 'both'
  const [activeView, setActiveView] = useState<'home' | 'queue' | 'chat' | 'both'>('home');
  const [activeSideTab, setActiveSideTab] = useState<'chat' | 'listeners'>('chat');
  const [mobileTab, setMobileTab] = useState<'player' | 'queue' | 'chat' | 'listeners'>('player');

  // Player mode: turntable vinyl or synced lyrics
  const [activePlayerMode, setActivePlayerMode] = useState<'turntable' | 'lyrics'>('turntable');

  // Chat state
  const [chatInput, setChatInput] = useState('');
  const [replyTo, setReplyTo] = useState<{ id: string; username: string } | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const chatScrollContainerRef = useRef<HTMLDivElement | null>(null);

  // Volume & Liked state
  const [volume, setVolume] = useState(0.8);
  const [isLiked, setIsLiked] = useState(false);
  const [isShuffle, setIsShuffle] = useState(false);

  // Modals & Panels
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showDjModal, setShowDjModal] = useState(false);
  const [showAddSongModal, setShowAddSongModal] = useState(false);
  const [addSongInitialSource, setAddSongInitialSource] = useState<TrackSource>('youtube');
  const [showAddSongDropdown, setShowAddSongDropdown] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [activeMenuTrackId, setActiveMenuTrackId] = useState<string | null>(null);
  const [showLeaveConfirmModal, setShowLeaveConfirmModal] = useState(false);
  const [memberToKick, setMemberToKick] = useState<any | null>(null);

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
    if (inputPassword.trim()) {
      setPassword(inputPassword.trim());
    }
    setShowJoinPrompt(false);
    const params = new URLSearchParams(window.location.search);
    params.set('username', inputUsername.trim());
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
    isAudioPlaying,
    playbackStatus,
    setExternalPlaybackState,
    authoritativePosition,
    hasControl,
    isCollaborative,
    isDjBoothMode,
    isCurrentDj,
    activeDjUsername,
    togglePlayPause,
    seek,
    prevTrack,
    nextTrack,
    toggleLoop,
    toggleQueueItemLoop,
    handleAutoEnd,
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
  } = useSyncPlayer(roomCode, username, password);

  const confirmLeave = () => {
    leaveRoom();
    router.push('/');
  };

  const lyricsContainerRef = useRef<HTMLDivElement | null>(null);

  // Local seeking state
  const [isSeeking, setIsSeeking] = useState(false);
  const [localSeekPos, setLocalSeekPos] = useState<number | null>(null);

  // Audio playback tracking for external players (Spotify / YouTube)
  const [externalPlayerIsPlaying, setExternalPlayerIsPlaying] = useState(false);

  // Reset liked and external player when track changes
  useEffect(() => {
    setIsLiked(false);
    setExternalPlayerIsPlaying(false);
  }, [room?.currentTrack?.id]);

  const isUploadAudio = !room?.currentTrack?.source || room?.currentTrack?.source === 'upload';
  const effectiveCurrentTime = isUploadAudio ? (audioElement?.currentTime || 0) : authoritativePosition;
  const displayedPosition = isSeeking && localSeekPos !== null ? localSeekPos : effectiveCurrentTime;

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
    if (activePlayerMode !== 'lyrics' || lyrics.length === 0 || !lyricsContainerRef.current) return;

    const curTime = effectiveCurrentTime;
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
  }, [effectiveCurrentTime, activePlayerMode, lyrics]);

  // Fetch friends list for invite modal
  useEffect(() => {
    if (showInviteModal && session?.user) {
      const fetchFriends = async () => {
        try {
          const accessToken = (session as any)?.accessToken;
          const headers: HeadersInit = accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
          const list = await safeFetchJson('/api/friends/list', { headers });
          setOnlineFriends((Array.isArray(list) ? list : []).filter((f: any) => f.status === 'accepted'));
        } catch (e) {
          console.log('Failed to load friends', e);
        }
      };
      fetchFriends();
    }
  }, [showInviteModal, session]);

  // Chat scroll: Scroll ONLY inner chat messages container
  useEffect(() => {
    if (chatScrollContainerRef.current) {
      chatScrollContainerRef.current.scrollTop = chatScrollContainerRef.current.scrollHeight;
    }
  }, [chatMessages]);

  // Viewport Lock: Pin inside viewport
  useEffect(() => {
    const origBodyOverflow = document.body.style.overflow;
    const origHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    window.scrollTo(0, 0);

    return () => {
      document.body.style.overflow = origBodyOverflow;
      document.documentElement.style.overflow = origHtmlOverflow;
    };
  }, []);

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
          <span key={i} className="text-[#C5A46D] font-bold bg-[#C5A46D]/15 px-1 rounded select-all font-sans">
            {part}
          </span>
        );
      }
      return part;
    });
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

  // Avatar helper
  const getAvatarGradient = (name: string) => {
    const gradients = [
      'from-[#3D444B] to-[#25292D]',
      'from-[#4A4E46] to-[#202326]',
      'from-[#4E4436] to-[#24272A]',
      'from-[#3A423D] to-[#1C1F22]',
      'from-[#453F4B] to-[#212427]',
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return gradients[Math.abs(hash) % gradients.length];
  };

  // ─────────────────────────────────────────────
  // JOIN PROMPT (Redesigned with Charcoal / Slate / Champagne Palette)
  // ─────────────────────────────────────────────
  if (showJoinPrompt) {
    return (
      <div
        className="min-h-screen flex items-center justify-center p-6 font-sans bg-[#151719]"
        style={{
          backgroundImage: 'radial-gradient(circle at 50% 40%, rgba(197, 164, 109, 0.06) 0%, transparent 60%), radial-gradient(ellipse at center, transparent 40%, #0F1012 100%)',
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="bg-[#202326] border border-[#F2EEE5]/[0.08] p-8 w-full max-w-md relative z-10 shadow-2xl rounded-3xl"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 rounded-2xl bg-[#C5A46D]/15 border border-[#C5A46D]/30 text-[#C5A46D]">
              <Headphones className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-serif font-bold text-[#F2EEE5]">Enter Listening Room</h2>
              <p className="text-[#A5A5A0] text-xs mt-0.5">Session <span className="text-[#C5A46D] font-semibold">{roomCode}</span></p>
            </div>
          </div>

          {promptError && (
            <div className="p-3 text-xs bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl mb-4 font-sans">
              {promptError}
            </div>
          )}

          <form onSubmit={handleJoinSubmit} className="space-y-4">
            <div>
              <label className="block text-[11px] font-sans font-semibold text-[#A5A5A0] uppercase tracking-wider mb-1.5">Your Name</label>
              <input
                type="text"
                required
                value={inputUsername}
                onChange={(e) => setInputUsername(e.target.value)}
                placeholder="e.g. Alex"
                className="w-full px-4 py-3 bg-[#292D30] border border-[#F2EEE5]/[0.1] rounded-xl text-sm text-[#F2EEE5] placeholder-[#A5A5A0]/50 focus:outline-none focus:border-[#C5A46D]/70 focus:ring-1 focus:ring-[#C5A46D]/50 transition"
              />
            </div>

            <div className="bg-[#1D2023] p-3.5 rounded-xl border border-[#F2EEE5]/[0.05] space-y-2">
              <span className="text-xs font-semibold text-[#A5A5A0]">Room Password (optional)</span>
              <input
                type="password"
                value={inputPassword}
                onChange={(e) => setInputPassword(e.target.value)}
                placeholder="Enter password if private"
                className="w-full px-4 py-2.5 bg-[#292D30] border border-[#F2EEE5]/[0.1] rounded-xl text-sm text-[#F2EEE5] placeholder-[#A5A5A0]/50 focus:outline-none focus:border-[#C5A46D]/70 transition"
              />
            </div>

            <button
              type="submit"
              className="w-full py-3.5 text-xs font-bold rounded-2xl cursor-pointer shadow-lg text-[#151719] bg-gradient-to-r from-[#D4B886] via-[#C5A46D] to-[#B38F52] hover:brightness-105 active:scale-[0.98] transition"
            >
              Enter Session
            </button>
          </form>
        </motion.div>
      </div>
    );
  }

  // ─────────────────────────────────────────────
  // CONNECTING / ERROR SCREEN
  // ─────────────────────────────────────────────
  if (syncError || !room) {
    return (
      <div
        className="min-h-screen flex items-center justify-center p-6 text-center font-sans bg-[#151719]"
        style={{
          backgroundImage: 'radial-gradient(circle at 50% 40%, rgba(197, 164, 109, 0.06) 0%, transparent 60%), radial-gradient(ellipse at center, transparent 40%, #0F1012 100%)',
        }}
      >
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-[#202326] border border-[#F2EEE5]/[0.08] p-8 w-full max-w-md space-y-5 relative z-10 shadow-2xl rounded-3xl"
        >
          <div className="p-4 bg-[#292D30] border border-[#C5A46D]/30 rounded-full w-fit mx-auto animate-pulse">
            <Radio className="w-8 h-8 text-[#C5A46D]" />
          </div>
          {syncError ? (
            <div className="space-y-4">
              <h3 className="text-lg font-serif font-bold text-red-400">Connection Failed</h3>
              <p className="text-[#A5A5A0] text-xs font-sans">{syncError}</p>
              <div className="flex justify-center gap-3">
                <button
                  onClick={() => window.location.reload()}
                  className="px-5 py-2.5 rounded-full text-xs font-bold cursor-pointer text-[#151719] bg-gradient-to-r from-[#D4B886] via-[#C5A46D] to-[#B38F52] hover:brightness-105 shadow"
                >
                  Retry
                </button>
                <button
                  onClick={() => router.push('/')}
                  className="px-5 py-2.5 bg-[#292D30] border border-[#F2EEE5]/[0.1] rounded-full text-xs font-semibold text-[#F2EEE5] hover:text-[#C5A46D] transition-all cursor-pointer"
                >
                  Back to Lobby
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <h3 className="text-lg font-serif font-bold text-[#F2EEE5]">Tuning In...</h3>
              <p className="text-[#A5A5A0] text-xs font-sans">Synchronizing audiophile audio stream with room</p>
            </div>
          )}
        </motion.div>
      </div>
    );
  }

  const currentTrack = room.currentTrack;
  const hasTrack = !!currentTrack;

  // One synchronized playback state across Play/Pause, Vinyl, Tonearm, and Status indicator
  const isPlaying = Boolean(
    hasTrack &&
    (isUploadAudio
      ? isAudioPlaying
      : (externalPlayerIsPlaying || room.playback.isPlaying))
  );

  const currentPlaybackStatus: 'READY' | 'PLAYING' | 'PAUSED' | 'BUFFERING' | 'ERROR' = !hasTrack
    ? 'READY'
    : isUploadAudio
    ? playbackStatus
    : externalPlayerIsPlaying
    ? 'PLAYING'
    : room.playback.isPlaying
    ? 'PLAYING'
    : 'PAUSED';

  const isDjBoothActive = room.djs && room.djs.length > 0;
  const currentDjName = isDjBoothActive ? room.djs![room.currentDjIndex || 0] : 'None';
  const isUserDj = isDjBoothActive && room.djs!.includes(username);

  const approvedQueue = room.queue.filter((t) => t.approved);
  const pendingRequests = room.queue.filter((t) => !t.approved);

  const trackDuration = currentTrack?.duration || 208;
  const progressPercent = Math.max(0, Math.min(100, (displayedPosition / trackDuration) * 100));

  const handleToggleShuffle = () => {
    const nextShuffle = !isShuffle;
    setIsShuffle(nextShuffle);
    if (nextShuffle && approvedQueue.length > 1 && isHost) {
      const shuffled = [...room.queue];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      updateQueue(shuffled);
    }
  };

  const handleNextTrack = () => {
    nextTrack(isShuffle);
  };

  // Determine open state of side panels based on activeView
  const isChatOpen = activeView === 'chat' || activeView === 'both';
  const isQueueOpen = activeView === 'queue' || activeView === 'both';

  const handleNavClick = (view: 'home' | 'queue' | 'chat' | 'both') => {
    if (view === 'home') {
      setActiveView('home');
    } else if (view === 'queue') {
      setActiveView(activeView === 'queue' ? 'home' : (activeView === 'both' ? 'chat' : 'queue'));
    } else if (view === 'chat') {
      setActiveView(activeView === 'chat' ? 'home' : (activeView === 'both' ? 'queue' : 'chat'));
    } else if (view === 'both') {
      setActiveView(activeView === 'both' ? 'home' : 'both');
    }
  };

  // ── Helper: Render Chat Stream ──
  const renderChatMessages = () => (
    <div ref={chatScrollContainerRef} className="flex-1 my-3 overflow-y-auto custom-scroll text-[#A5A5A0] text-xs flex flex-col gap-2.5 pr-1">
      {chatMessages.length === 0 ? (
        <div className="h-full flex flex-col items-center justify-center text-[#A5A5A0]/60 text-xs py-8 italic font-serif">
          <MessageSquare className="w-8 h-8 opacity-30 text-[#C5A46D] mb-2" />
          <p className="text-[#F2EEE5] font-medium">Welcome to the Listening Room ✨</p>
          <p className="text-[10px] text-[#A5A5A0]">Say hello and share what you think.</p>
        </div>
      ) : (
        chatMessages.map((msg: ChatMessage) => {
          const isOwn = msg.username === username;
          return (
            <div key={msg.id} className={`flex gap-2.5 items-start group ${isOwn ? 'flex-row-reverse' : ''}`}>
              <div className={`w-7 h-7 rounded-full bg-gradient-to-tr ${getAvatarGradient(msg.username)} flex items-center justify-center text-[10px] font-bold text-[#F2EEE5] shrink-0 mt-0.5 shadow-md border border-white/5`}>
                {msg.username.slice(0, 2).toUpperCase()}
              </div>

              <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-xs relative ${
                isOwn
                  ? 'bg-[#292D30] border border-[#C5A46D]/35 text-[#F2EEE5] shadow-md'
                  : 'bg-[#1C1F22] border border-white/[0.05] text-[#F2EEE5]'
              }`}>
                <div className={`flex items-center gap-1.5 mb-0.5 text-[10px] ${isOwn ? 'justify-end text-[#C5A46D]' : 'text-[#A5A5A0]'}`}>
                  <span className="font-semibold">{msg.username}</span>
                  <span className="opacity-50">{new Date(msg.timestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>
                </div>

                {msg.replyToUser && (
                  <div className="text-[9px] text-[#A5A5A0] flex items-center gap-1 mb-1 border-b border-white/5 pb-0.5">
                    <CornerDownRight className="w-2.5 h-2.5 text-[#C5A46D]" />
                    <span>@{msg.replyToUser}</span>
                  </div>
                )}

                <p className="leading-snug break-words">{formatChatMessage(msg.message)}</p>

                <button
                  onClick={() => setReplyTo({ id: msg.id, username: msg.username })}
                  className="absolute -top-1.5 right-1 opacity-0 group-hover:opacity-100 p-0.5 text-[#A5A5A0] hover:text-[#F2EEE5] transition-opacity cursor-pointer"
                  title="Reply"
                >
                  <CornerDownRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          );
        })
      )}
      <div ref={chatEndRef} />
    </div>
  );

  // ── Helper: Render Listeners Content ──
  const renderListenersContent = () => (
    <div className="flex-1 my-3 overflow-y-auto custom-scroll space-y-2 pr-1">
      {room.participants.map((user) => (
        <div
          key={user.id}
          className="flex items-center justify-between p-2.5 rounded-2xl bg-[#292D30] border border-white/[0.05] hover:bg-white/[0.04] transition-colors text-xs"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="relative">
              <div className={`w-8 h-8 rounded-full bg-gradient-to-tr ${getAvatarGradient(user.username)} flex items-center justify-center font-bold text-[#F2EEE5] text-xs shadow-md ${
                user.isHost ? 'ring-2 ring-[#C5A46D]' : ''
              }`}>
                {user.username.slice(0, 2).toUpperCase()}
              </div>
              <div className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full ${user.isOnline ? 'bg-[#8D9A86] shadow-[0_0_6px_#8D9A86]' : 'bg-[#50555C]'} border border-[#151719]`} />
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-[#F2EEE5] truncate text-xs">@{user.username}</span>
                {user.isHost && <Crown className="w-3.5 h-3.5 text-[#C5A46D] fill-current" />}
              </div>
              <span className="text-[10px] text-[#A5A5A0]">
                {user.isHost ? 'Room Host' : (room.djs?.includes(user.username) ? 'DJ' : 'Listener')}
              </span>
            </div>
          </div>

          {isHost && user.id !== socket?.id && !user.isHost && (
            <button
              onClick={() => setMemberToKick(user)}
              className="px-2.5 py-1 bg-red-500/15 text-red-400 border border-red-500/30 text-[10px] font-semibold rounded-full hover:bg-red-500/25 transition cursor-pointer"
            >
              Kick
            </button>
          )}
        </div>
      ))}
    </div>
  );

  // ── Helper: Render Add Song Action Pill with Split Chevron ──
  const renderAddSongButton = () => (
    <div className="w-full shrink-0 relative pt-2">
      {showAddSongDropdown && (
        <div className="absolute bottom-full mb-2 left-0 right-0 rounded-2xl bg-[#202326] border border-[#F2EEE5]/[0.1] p-1.5 shadow-2xl space-y-1 z-30">
          <button
            onClick={() => {
              setAddSongInitialSource('youtube');
              setShowAddSongModal(true);
              setShowAddSongDropdown(false);
            }}
            className="w-full text-left px-3 py-2 text-xs font-semibold text-[#F2EEE5] hover:bg-[#292D30] rounded-xl flex items-center gap-2.5 transition-colors cursor-pointer"
          >
            <span className="text-[#C5A46D] font-bold">▶</span>
            <span>YouTube Stream</span>
          </button>
          <button
            onClick={() => {
              setAddSongInitialSource('spotify');
              setShowAddSongModal(true);
              setShowAddSongDropdown(false);
            }}
            className="w-full text-left px-3 py-2 text-xs font-semibold text-[#F2EEE5] hover:bg-[#292D30] rounded-xl flex items-center gap-2.5 transition-colors cursor-pointer"
          >
            <span className="text-[#8D9A86] font-bold">●</span>
            <span>Spotify Track</span>
          </button>
          <button
            onClick={() => {
              setAddSongInitialSource('upload');
              setShowAddSongModal(true);
              setShowAddSongDropdown(false);
            }}
            className="w-full text-left px-3 py-2 text-xs font-semibold text-[#F2EEE5] hover:bg-[#292D30] rounded-xl flex items-center gap-2.5 transition-colors cursor-pointer"
          >
            <span className="text-[#C5A46D] font-bold">📁</span>
            <span>Upload Audio File</span>
          </button>
        </div>
      )}

      <div className="w-full rounded-2xl bg-gradient-to-r from-[#D4B886] via-[#C5A46D] to-[#B38F52] hover:brightness-105 active:scale-[0.98] transition shadow-[0_4px_18px_rgba(197,164,109,0.3)] flex items-stretch overflow-hidden cursor-pointer">
        <button
          onClick={() => {
            setAddSongInitialSource('youtube');
            setShowAddSongModal(true);
          }}
          className="flex-1 py-3 px-4 flex items-center justify-center gap-2 text-[#151719] font-bold text-xs tracking-wide cursor-pointer"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>{(!isCollaborative && !isHost) ? 'Request Song' : 'Add Song'}</span>
        </button>
        <div className="w-[1px] bg-black/20 my-2" />
        <button
          onClick={() => setShowAddSongDropdown(!showAddSongDropdown)}
          aria-label="More sources"
          className="px-3 flex items-center justify-center text-[#151719] hover:bg-black/10 transition cursor-pointer"
          title="Select source"
        >
          <ChevronDown className={`w-3.5 h-3.5 stroke-[2.5] transition-transform duration-200 ${showAddSongDropdown ? 'rotate-180' : ''}`} />
        </button>
      </div>
    </div>
  );

  // ── Helper: Render Queue Track List ──
  const renderQueueTrackList = () => (
    <div className="flex-1 my-3 overflow-y-auto custom-scroll flex flex-col gap-2.5 pr-1">
      {/* 1. Highlighted Currently Playing Track */}
      {currentTrack && (
        <div className="group relative p-2.5 rounded-2xl bg-[#25292D] border border-[#C5A46D]/45 transition flex items-center justify-between gap-2.5 shadow-md shadow-black/40">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-11 h-11 rounded-xl overflow-hidden shrink-0 border border-[#C5A46D]/40 relative shadow-sm bg-[#151719]">
              {currentTrack.thumbnailUrl ? (
                <img alt={currentTrack.title} className="w-full h-full object-cover" src={currentTrack.thumbnailUrl} />
              ) : (
                <div className="w-full h-full bg-[#181A1D] flex items-center justify-center text-[#C5A46D]">
                  <Music className="w-5 h-5" />
                </div>
              )}
              <span className="absolute top-1 left-1 px-1 py-0.5 rounded bg-[#C5A46D] text-[#151719] font-bold text-[8px] leading-none uppercase tracking-tighter shadow">
                Now
              </span>
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-medium text-[#F2EEE5] truncate tracking-tight">{currentTrack.title}</span>
              <span className="text-[11px] text-[#A5A5A0] truncate">{currentTrack.artist}</span>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#202326] border border-[#C5A46D]/20 text-[9px] text-[#C5A46D] font-medium">
                  <Crown className="w-2.5 h-2.5 text-[#C5A46D] fill-current" />
                  {currentTrack.uploadedBy ? `@${currentTrack.uploadedBy}` : '@Host'}
                </span>
              </div>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1.5 shrink-0">
            <span className="text-[11px] text-[#A5A5A0] font-mono">{formatTime(currentTrack.duration)}</span>
            <button
              onClick={() => toggleLoop()}
              className={`p-1 rounded-lg transition ${
                room.playback.loopCurrentTrack ? 'text-[#C5A46D] bg-[#C5A46D]/20' : 'text-[#A5A5A0] hover:text-[#C5A46D]'
              }`}
              title="Toggle Loop"
            >
              <Repeat className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* 2. Numbered Queued Tracks */}
      {approvedQueue.length === 0 ? (
        <div className="py-12 flex flex-col items-center justify-center text-[#A5A5A0] text-xs space-y-2 text-center">
          <ListMusic className="w-8 h-8 text-[#C5A46D] opacity-40 mb-1" />
          <p className="font-serif font-semibold text-[#F2EEE5] text-sm">Your Queue is Silent</p>
          <p className="text-[11px] text-[#A5A5A0]">Add tracks to curate your listening session.</p>
        </div>
      ) : (
        approvedQueue.map((track, idx) => {
          const isItemMenuOpen = activeMenuTrackId === track.id;
          return (
            <div
              key={track.id}
              className="group relative p-2.5 rounded-2xl bg-[#292D30] border border-white/[0.05] hover:border-white/[0.15] hover:bg-[#303539] transition flex items-center justify-between gap-2.5 shadow-md shadow-black/30"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="text-[#A5A5A0]/60 group-hover:text-[#F2EEE5] transition cursor-grab">
                  <GripVertical className="w-3.5 h-3.5" />
                </div>
                <div className="w-11 h-11 rounded-xl overflow-hidden shrink-0 border border-white/10 relative shadow-sm bg-[#151719]">
                  {track.thumbnailUrl ? (
                    <img alt={track.title} className="w-full h-full object-cover" src={track.thumbnailUrl} />
                  ) : (
                    <div className="w-full h-full bg-[#181A1D] flex items-center justify-center text-[#A5A5A0]">
                      <Music className="w-4 h-4" />
                    </div>
                  )}
                  {idx === 0 && (
                    <span className="absolute top-1 left-1 px-1 py-0.5 rounded bg-[#8D9A86]/25 border border-[#8D9A86]/40 text-[#8D9A86] font-bold text-[8px] leading-none uppercase tracking-tighter">
                      Next
                    </span>
                  )}
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-medium text-[#F2EEE5] truncate tracking-tight">{track.title}</span>
                  <span className="text-[11px] text-[#A5A5A0] truncate">{track.artist}</span>
                  <div className="flex items-center gap-1 mt-0.5">
                    <span className="text-[9px] text-[#A5A5A0] bg-white/5 px-1.5 py-0.5 rounded border border-white/5">
                      @{track.uploadedBy || 'Guest'}
                    </span>
                    {track.loop && <span className="text-[8px] text-[#C5A46D]">🔁</span>}
                  </div>
                </div>
              </div>

              <div className="flex flex-col items-end gap-1.5 shrink-0">
                <span className="text-[11px] text-[#A5A5A0] font-mono">{formatTime(track.duration)}</span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => voteTrack(track.id, 'up')}
                    className="text-[#A5A5A0] hover:text-[#C5A46D] transition cursor-pointer p-0.5"
                    title="Vote Up"
                  >
                    <Heart className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setActiveMenuTrackId(isItemMenuOpen ? null : track.id)}
                    className="text-[#A5A5A0] hover:text-[#F2EEE5] transition cursor-pointer p-0.5"
                  >
                    <MoreVertical className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Item Dropdown */}
              {isItemMenuOpen && (
                <div className="absolute right-2 top-10 z-30 w-36 rounded-xl bg-[#202326] border border-[#F2EEE5]/[0.1] p-1.5 shadow-2xl space-y-1">
                  {((isHost) || (track.uploadedBy === username)) && (
                    <button
                      onClick={() => {
                        removeFromQueue(track.id);
                        setActiveMenuTrackId(null);
                      }}
                      className="w-full text-left px-2.5 py-1.5 text-xs text-red-400 hover:bg-red-500/10 rounded-lg flex items-center gap-2 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Remove</span>
                    </button>
                  )}
                  <button
                    onClick={() => {
                      toggleQueueItemLoop(track.id);
                      setActiveMenuTrackId(null);
                    }}
                    className="w-full text-left px-2.5 py-1.5 text-xs text-[#F2EEE5] hover:bg-[#292D30] rounded-lg flex items-center gap-2 cursor-pointer"
                  >
                    <Repeat className="w-3.5 h-3.5" />
                    <span>{track.loop ? 'Disable Loop' : 'Enable Loop'}</span>
                  </button>
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );

  return (
    <div
      className="fixed inset-0 h-dvh max-h-dvh w-screen overflow-hidden select-none bg-[#151719] font-sans antialiased text-[#F2EEE5]"
      id="roomApp"
    >
      {/* Atmospheric Background with Subtle Acoustic Studio Ambient Lighting */}
      <div
        className="relative w-full h-full max-h-screen overflow-hidden flex flex-col justify-between p-3 md:p-5 box-border transition-all duration-700"
        style={{
          background: `
            radial-gradient(circle at 50% 40%, rgba(197, 164, 109, 0.04) 0%, transparent 60%),
            radial-gradient(ellipse at center, transparent 40%, #0F1012 100%),
            #151719
          `,
        }}
      >
        {/* Ambient Track Cover Tint Glow (Restrained & Muted) */}
        {currentTrack?.thumbnailUrl && (
          <div
            className="absolute inset-0 bg-cover bg-center -z-10 pointer-events-none opacity-10 blur-3xl mix-blend-screen transition-opacity duration-1000"
            style={{ backgroundImage: `url(${currentTrack.thumbnailUrl})` }}
          />
        )}

        {/* Autoplay Safeguard Banner */}
        {autoplayBlocked && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 text-[#F2EEE5] py-2 px-5 rounded-2xl flex justify-between items-center text-xs font-semibold bg-[#202326] border border-[#C5A46D]/40 gap-4 shadow-2xl">
            <div className="flex items-center gap-2">
              <Info className="w-4 h-4 text-[#C5A46D] shrink-0" />
              <span>Browser autoplay blocked audio. Click Unmute to synchronize playback.</span>
            </div>
            <button
              onClick={handleUnblockAutoplay}
              className="px-4 py-1.5 rounded-full text-xs font-bold cursor-pointer text-[#151719] bg-gradient-to-r from-[#D4B886] via-[#C5A46D] to-[#B38F52] hover:brightness-105 shadow shrink-0"
            >
              Unmute & Sync
            </button>
          </div>
        )}

        {/* Floating Emojis Rise Animation */}
        <div className="absolute inset-0 pointer-events-none select-none overflow-hidden z-40">
          <AnimatePresence>
            {reactions.map((react: ReactionItem) => (
              <motion.div
                key={react.id}
                initial={{ bottom: '25%', left: `${Math.max(20, Math.min(80, react.x))}%`, opacity: 1, scale: 0.9 }}
                animate={{ bottom: '75%', opacity: 0, scale: 1.5, y: -140 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 2.2, ease: 'easeOut' }}
                className="absolute text-4xl font-bold filter drop-shadow-lg"
              >
                {react.emoji}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* BEGIN: DashboardLayout */}
        <div className="relative z-10 w-full h-full flex flex-row gap-3 md:gap-4 lg:gap-5 items-stretch overflow-hidden">
          
          {/* BEGIN: LeftNavigationSidebar (Redesigned with Muted Champagne Accent) */}
          <aside
            className="w-[72px] shrink-0 bg-[#202326]/90 backdrop-blur-xl border border-[#F2EEE5]/[0.07] rounded-3xl p-2.5 hidden md:flex flex-col justify-between items-center shadow-2xl z-20"
            data-purpose="sidebar-navigation"
          >
            {/* Top Nav Group */}
            <nav aria-label="Main Navigation" className="flex flex-col items-center gap-3.5 w-full pt-1" id="sidebarNav">
              {/* Room Tab (Centered Room Mode) */}
              <button
                onClick={() => handleNavClick('home')}
                className={`nav-tab w-12 h-12 rounded-2xl flex flex-col items-center justify-center gap-0.5 transition-all duration-300 cursor-pointer ${
                  activeView === 'home'
                    ? 'bg-[#292D30] border border-[#C5A46D]/40 text-[#C5A46D] shadow-[0_0_16px_rgba(197,164,109,0.15)]'
                    : 'text-[#A5A5A0] hover:text-[#F2EEE5] hover:bg-[#292D30]/60'
                }`}
                title="Centered Room Mode"
              >
                <Home className="w-5 h-5" />
                <span className="text-[10px] font-medium tracking-tight">Room</span>
              </button>

              {/* Queue Tab */}
              <button
                onClick={() => handleNavClick('queue')}
                className={`nav-tab group flex flex-col items-center justify-center gap-1 py-1.5 w-12 rounded-2xl transition-all duration-300 cursor-pointer ${
                  activeView === 'queue'
                    ? 'bg-[#292D30] border border-[#C5A46D]/40 text-[#C5A46D] shadow-[0_0_16px_rgba(197,164,109,0.15)]'
                    : 'text-[#A5A5A0] hover:text-[#F2EEE5] hover:bg-[#292D30]/60'
                }`}
                title="Toggle Queue Panel"
              >
                <ListMusic className="w-5 h-5 group-hover:scale-105 transition" />
                <span className="text-[10px] font-normal tracking-tight">Queue</span>
              </button>

              {/* Chat Tab */}
              <button
                onClick={() => handleNavClick('chat')}
                className={`nav-tab group flex flex-col items-center justify-center gap-1 py-1.5 w-12 rounded-2xl transition-all duration-300 cursor-pointer ${
                  activeView === 'chat'
                    ? 'bg-[#292D30] border border-[#C5A46D]/40 text-[#C5A46D] shadow-[0_0_16px_rgba(197,164,109,0.15)]'
                    : 'text-[#A5A5A0] hover:text-[#F2EEE5] hover:bg-[#292D30]/60'
                }`}
                title="Toggle Chat Panel"
              >
                <MessageSquare className="w-5 h-5 group-hover:scale-105 transition" />
                <span className="text-[10px] font-normal tracking-tight">Chat</span>
              </button>

              {/* DJ Booth Tab (Show Full Studio) */}
              <button
                onClick={() => handleNavClick('both')}
                className={`nav-tab group flex flex-col items-center justify-center gap-1 py-1.5 w-12 rounded-2xl transition-all duration-300 cursor-pointer relative ${
                  activeView === 'both'
                    ? 'bg-[#292D30] border border-[#C5A46D]/40 text-[#C5A46D] shadow-[0_0_16px_rgba(197,164,109,0.15)]'
                    : 'text-[#A5A5A0] hover:text-[#F2EEE5] hover:bg-[#292D30]/60'
                }`}
                title="Show Full Studio (Chat & Queue)"
              >
                <Headphones className="w-5 h-5 group-hover:scale-105 transition" />
                <span className="text-[10px] font-normal tracking-tight whitespace-nowrap">DJ Booth</span>
                {isDjBoothMode && (
                  <span className="w-1.5 h-1.5 rounded-full bg-[#C5A46D] absolute top-1 right-1 animate-ping" />
                )}
              </button>

              {/* Invite Tab */}
              <button
                onClick={() => setShowInviteModal(true)}
                className="group flex flex-col items-center justify-center gap-1 text-[#A5A5A0] hover:text-[#F2EEE5] transition-all duration-300 py-1.5 w-12 rounded-2xl cursor-pointer hover:bg-[#292D30]/60"
                title="Invite Friends"
              >
                <UserPlus className="w-5 h-5 group-hover:scale-105 transition" />
                <span className="text-[10px] font-normal tracking-tight">Invite</span>
              </button>

              {/* Settings Tab */}
              <button
                onClick={() => setShowSettingsModal(true)}
                className="group flex flex-col items-center justify-center gap-1 text-[#A5A5A0] hover:text-[#F2EEE5] transition-all duration-300 py-1.5 w-12 rounded-2xl cursor-pointer hover:bg-[#292D30]/60"
                title="Settings & Audio Calibration"
              >
                <Settings className="w-5 h-5 group-hover:scale-105 transition" />
                <span className="text-[10px] font-normal tracking-tight">Settings</span>
              </button>
            </nav>

            {/* Bottom Group: Leave & Synced Latency Indicator */}
            <div className="flex flex-col items-center gap-2 pb-1" data-purpose="latency-indicator">
              <button
                onClick={() => setShowLeaveConfirmModal(true)}
                className="text-[#A5A5A0] hover:text-red-400 p-1.5 rounded-xl transition cursor-pointer"
                title="Leave Room"
              >
                <LogOut className="w-4 h-4" />
              </button>

              <div className="relative flex items-center justify-center">
                <span className={`animate-ping absolute inline-flex h-2.5 w-2.5 rounded-full ${syncStatus === 'synced' ? 'bg-[#8D9A86] opacity-60' : 'bg-[#C5A46D] opacity-60'}`} />
                <span className={`relative inline-flex rounded-full h-2 w-2 ${syncStatus === 'synced' ? 'bg-[#8D9A86] shadow-[0_0_8px_#8D9A86]' : 'bg-[#C5A46D]'}`} />
              </div>
              <span className="text-[9px] font-normal text-[#A5A5A0] tracking-tight leading-none pt-0.5">
                {syncStatus === 'synced' ? 'Synced' : 'Syncing'}
              </span>
              <span className="text-[9px] font-medium text-[#A5A5A0] tracking-tight leading-none font-mono">
                {Math.round(latency)}ms
              </span>
            </div>
          </aside>
          {/* END: LeftNavigationSidebar */}

          {/* BEGIN: CenterPlayerArea */}
          <main
            className="flex-1 flex flex-col justify-between items-center px-2 lg:px-4 py-1 overflow-hidden min-w-0 transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)]"
            data-purpose="center-player"
            id="centerPlayerContainer"
          >
            {/* Mobile Header Bar */}
            <div className="w-full flex md:hidden items-center justify-between px-2 py-1 mb-1 border-b border-[#F2EEE5]/[0.08]">
              <div className="flex items-center gap-2">
                <span className="text-xs font-serif font-bold text-[#F2EEE5]">{room.roomName || roomCode}</span>
                <span className="text-[10px] text-[#C5A46D] bg-[#292D30] px-2 py-0.5 rounded-full border border-[#C5A46D]/30">
                  {Math.round(latency)}ms
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowInviteModal(true)}
                  className="p-1 text-[#A5A5A0] hover:text-[#F2EEE5]"
                  title="Invite"
                >
                  <UserPlus className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setShowSettingsModal(true)}
                  className="p-1 text-[#A5A5A0] hover:text-[#F2EEE5]"
                  title="Settings"
                >
                  <Settings className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setShowLeaveConfirmModal(true)}
                  className="p-1 text-[#A5A5A0] hover:text-red-400"
                  title="Leave"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Turntable Section: High-End Audiophile Plinth & Precision Assembly */}
            <div
              className="relative flex-1 w-full max-w-[560px] flex items-center justify-center min-h-[280px] sm:min-h-[340px] py-1 select-none transition-transform duration-500"
              id="turntableInteractiveArea"
            >
              {/* Scheduled Countdown Overlay */}
              {room.scheduledStartTime && !room.isStarted ? (
                <div className="space-y-4 text-center z-20 flex flex-col items-center justify-center p-8 bg-[#202326] rounded-3xl max-w-sm border border-[#C5A46D]/30 shadow-2xl">
                  <Calendar className="w-10 h-10 text-[#C5A46D] animate-pulse" />
                  <div>
                    <h3 className="text-lg font-serif font-bold text-[#F2EEE5]">Scheduled Session</h3>
                    <p className="text-[#A5A5A0] text-xs mt-0.5">Host: @{room.participants.find(p => p.isHost)?.username}</p>
                  </div>
                  
                  <div className="space-y-1">
                    <span className="block text-[10px] font-semibold text-[#A5A5A0] uppercase tracking-widest">Starts in</span>
                    <span className="text-3xl font-black text-[#C5A46D] font-mono tracking-widest">
                      {formatCountdown(timeLeft)}
                    </span>
                  </div>

                  {isHost && (
                    <button
                      onClick={startScheduledRoom}
                      className="px-6 py-2.5 font-bold text-xs rounded-full cursor-pointer shadow-lg text-[#151719] bg-gradient-to-r from-[#D4B886] via-[#C5A46D] to-[#B38F52] hover:brightness-105"
                    >
                      Start Session Now
                    </button>
                  )}
                </div>
              ) : activePlayerMode === 'lyrics' && lyrics.length > 0 ? (
                /* Synced Lyrics Display Mode */
                <div
                  ref={lyricsContainerRef}
                  className="w-full max-h-[320px] overflow-y-auto space-y-5 px-6 my-auto text-center select-none custom-scroll z-20"
                  style={{ scrollBehavior: 'smooth' }}
                >
                  {lyrics.map((lyric, idx) => {
                    const curTime = effectiveCurrentTime;
                    const isActive = curTime >= lyric.time && (idx === lyrics.length - 1 || curTime < lyrics[idx + 1].time);
                    return (
                      <p
                        key={idx}
                        className={`text-base sm:text-xl font-serif font-bold transition-all duration-300 leading-relaxed ${
                          isActive ? 'text-[#C5A46D] scale-105 opacity-100 drop-shadow' : 'text-[#A5A5A0]/50 opacity-40'
                        }`}
                      >
                        {lyric.text}
                      </p>
                    );
                  })}
                </div>
              ) : (
                /* AUDIOPHILE TURNTABLE HERO CENTERPIECE */
                <div className="flex flex-col items-center">
                  {/* Status Indicator Badge Near Vinyl Player */}
                  <div className="flex items-center justify-between w-full max-w-sm px-2 mb-2 z-20">
                    <div
                      id="playbackStatusBadge"
                      className="flex items-center gap-2 px-3 py-1 rounded-full bg-[#181A1C]/90 border border-[#F2EEE5]/10 backdrop-blur-md shadow-md text-[10px] font-mono font-bold tracking-widest uppercase select-none"
                    >
                      <span
                        className={`w-2 h-2 rounded-full transition-colors duration-300 ${
                          currentPlaybackStatus === 'PLAYING'
                            ? 'bg-[#8D9A86] shadow-[0_0_8px_#8D9A86] animate-pulse'
                            : currentPlaybackStatus === 'BUFFERING'
                            ? 'bg-[#C5A46D] animate-ping'
                            : currentPlaybackStatus === 'ERROR'
                            ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]'
                            : currentPlaybackStatus === 'PAUSED'
                            ? 'bg-[#A5A5A0]'
                            : 'bg-[#50555C]'
                        }`}
                      />
                      <span
                        className={
                          currentPlaybackStatus === 'PLAYING'
                            ? 'text-[#C5A46D]'
                            : currentPlaybackStatus === 'ERROR'
                            ? 'text-red-400'
                            : 'text-[#A5A5A0]'
                        }
                      >
                        {currentPlaybackStatus}
                      </span>
                    </div>

                    {lyrics.length > 0 && (
                      <button
                        onClick={() => setActivePlayerMode(activePlayerMode === 'turntable' ? 'lyrics' : 'turntable')}
                        className="px-3 py-1 rounded-full bg-[#202326] border border-[#C5A46D]/30 text-xs font-semibold text-[#C5A46D] hover:text-[#F2EEE5] flex items-center gap-1.5 cursor-pointer transition"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>{activePlayerMode === 'turntable' ? 'Lyrics' : 'Vinyl'}</span>
                      </button>
                    )}
                  </div>

                  <TurntableHero
                    isPlaying={isPlaying}
                    playbackStatus={currentPlaybackStatus}
                    progressPercent={progressPercent}
                    coverUrl={currentTrack?.thumbnailUrl}
                    trackTitle={currentTrack?.title || 'Golden Hour'}
                    trackArtist={currentTrack?.artist}
                    onTogglePlay={togglePlayPause}
                  />
                </div>
              )}

              {/* Hidden Audio Player Backends */}
              <div className="sr-only" aria-hidden="true">
                {currentTrack?.source === 'spotify' && (
                  <SpotifyPlayerBackend
                    spotifyUri={currentTrack.spotifyUri || currentTrack.url}
                    accessToken={spotifyAccessToken}
                    isPlaying={isPlaying}
                    position={authoritativePosition}
                    volume={volume}
                    onEnded={() => handleAutoEnd(isShuffle)}
                    onPlaybackStateChange={(playing) => {
                      setExternalPlayerIsPlaying(playing);
                      setExternalPlaybackState(playing);
                    }}
                  />
                )}
                {currentTrack?.source === 'youtube' && (
                  <YouTubePlayerBackend
                    youtubeId={currentTrack.youtubeId || currentTrack.url}
                    isPlaying={isPlaying}
                    position={authoritativePosition}
                    volume={volume}
                    onEnded={() => handleAutoEnd(isShuffle)}
                    onPlaybackStateChange={(playing) => {
                      setExternalPlayerIsPlaying(playing);
                      setExternalPlaybackState(playing);
                    }}
                  />
                )}
              </div>
            </div>

            {/* Track Info & Controls Container (Redesigned with Refined Typography & Geometry) */}
            <div className="w-full max-w-xl flex flex-col gap-2.5 pb-1">
              
              {/* Now Playing Card */}
              <div className="flex items-center justify-between px-2" data-purpose="track-info">
                <div className="flex items-center gap-3.5 min-w-0">
                  {/* Song Thumbnail */}
                  <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-2xl overflow-hidden shadow-lg border border-[#F2EEE5]/[0.1] shrink-0 bg-[#202326] relative">
                    {currentTrack?.thumbnailUrl ? (
                      <img
                        alt={currentTrack.title}
                        className="w-full h-full object-cover object-left"
                        src={currentTrack.thumbnailUrl}
                      />
                    ) : (
                      <div className="w-full h-full bg-[#1C1F22] flex items-center justify-center text-[#C5A46D]">
                        <Music className="w-6 h-6" />
                      </div>
                    )}
                  </div>

                  {/* Title & Artist */}
                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="font-serif text-lg sm:text-2xl text-[#F2EEE5] font-semibold tracking-wide leading-tight truncate">
                        {currentTrack ? currentTrack.title : 'No Track Playing'}
                      </h2>
                      <button
                        onClick={() => setIsLiked(!isLiked)}
                        aria-label="Favorite"
                        className="text-[#A5A5A0] hover:text-[#C5A46D] transition cursor-pointer shrink-0"
                      >
                        <Heart className={`w-4 h-4 ${isLiked ? 'fill-[#C5A46D] text-[#C5A46D]' : ''}`} />
                      </button>
                    </div>
                    <p className="text-xs text-[#A5A5A0] tracking-wider font-normal truncate">
                      {currentTrack ? currentTrack.artist : 'Add a song to start session'}
                    </p>
                  </div>
                </div>

                {/* Host / Role Badge */}
                <div className="flex items-center gap-1.5 shrink-0">
                  {isHost && (
                    <div className="px-3 py-1 rounded-full border border-[#C5A46D]/40 bg-[#C5A46D]/10 text-[11px] font-semibold text-[#C5A46D] tracking-widest uppercase shadow-[0_0_12px_rgba(197,164,109,0.15)]">
                      HOST
                    </div>
                  )}
                  {!isHost && isCollaborative && (
                    <div className="px-3 py-1 rounded-full border border-[#8D9A86]/30 bg-[#8D9A86]/10 text-[11px] font-semibold text-[#8D9A86] tracking-widest uppercase">
                      COLLAB
                    </div>
                  )}
                  {isDjBoothMode && isCurrentDj && (
                    <div className="px-3 py-1 rounded-full border border-[#C5A46D]/40 bg-[#C5A46D]/10 text-[11px] font-semibold text-[#C5A46D] tracking-widest uppercase">
                      DJ
                    </div>
                  )}
                </div>
              </div>

              {/* Scrubber Progress Bar */}
              <div className="flex items-center gap-3 px-2" data-purpose="scrubber">
                <span className="text-[11px] font-medium text-[#A5A5A0] w-8 text-right font-mono">
                  {formatTime(displayedPosition)}
                </span>
                
                {/* Progress Slider Track */}
                <div className="relative flex-1 h-2 bg-[#292D30] rounded-full flex items-center cursor-pointer group">
                  {/* Elapsed Track Fill */}
                  <div
                    className="absolute left-0 top-0 bottom-0 bg-[#C5A46D] rounded-full"
                    style={{ width: `${progressPercent}%` }}
                  />
                  {/* Scrubber Thumb */}
                  <div
                    className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3.5 h-3.5 bg-[#F2EEE5] rounded-full shadow-[0_0_8px_rgba(197,164,109,0.6)] ring-2 ring-[#C5A46D] transition-transform group-hover:scale-125 pointer-events-none"
                    style={{ left: `${progressPercent}%` }}
                  />
                  <input
                    type="range"
                    min="0"
                    max={trackDuration}
                    step="0.1"
                    value={displayedPosition}
                    disabled={!currentTrack || !hasControl}
                    onPointerDown={() => {
                      setIsSeeking(true);
                      setLocalSeekPos(displayedPosition);
                    }}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      setLocalSeekPos(val);
                    }}
                    onPointerUp={(e) => {
                      const finalVal = parseFloat((e.target as HTMLInputElement).value);
                      setIsSeeking(false);
                      setLocalSeekPos(null);
                      seek(finalVal);
                    }}
                    onMouseUp={(e) => {
                      if (isSeeking) {
                        const finalVal = parseFloat((e.target as HTMLInputElement).value);
                        setIsSeeking(false);
                        setLocalSeekPos(null);
                        seek(finalVal);
                      }
                    }}
                    onTouchEnd={() => {
                      if (isSeeking && localSeekPos !== null) {
                        setIsSeeking(false);
                        seek(localSeekPos);
                        setLocalSeekPos(null);
                      }
                    }}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                    title={!hasControl ? 'Only host controls playback' : 'Seek position'}
                  />
                </div>

                <span className="text-[11px] font-medium text-[#A5A5A0] w-8 font-mono">
                  {currentTrack ? formatTime(currentTrack.duration) : '0:00'}
                </span>
              </div>

              {/* Playback Controls Bar (High-End Audio Equipment Styling) */}
              <div className="flex items-center justify-between px-3 sm:px-6 pt-0.5" data-purpose="playback-controls">
                {/* Shuffle */}
                <button
                  onClick={handleToggleShuffle}
                  aria-label="Shuffle"
                  className={`p-1.5 transition cursor-pointer ${
                    isShuffle ? 'text-[#C5A46D]' : 'text-[#A5A5A0] hover:text-[#F2EEE5]'
                  }`}
                  title={isShuffle ? 'Shuffle: ON' : 'Shuffle: OFF'}
                >
                  <Shuffle className="w-4 h-4" />
                </button>

                {/* Previous */}
                <button
                  onClick={prevTrack}
                  disabled={!currentTrack || !hasControl}
                  aria-label="Previous Track"
                  className="p-1.5 text-[#A5A5A0] hover:text-[#F2EEE5] transition cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Previous Track"
                >
                  <SkipBack className="w-5 h-5 fill-current" />
                </button>

                {/* Primary Champagne Gold Play / Pause Button */}
                <button
                  onClick={togglePlayPause}
                  disabled={!currentTrack || !hasControl}
                  aria-label="Play/Pause"
                  className={`relative group p-0.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition-all ${
                    isPlaying ? 'is-playing' : 'is-paused'
                  }`}
                  id="playPauseButton"
                  title={isPlaying ? 'Pause' : 'Play'}
                >
                  {/* Ambient Champagne Halo Glow */}
                  <div
                    className={`absolute -inset-1.5 rounded-full blur-md transition-all duration-300 ${
                      isPlaying
                        ? 'bg-[#C5A46D]/50 shadow-[0_0_20px_rgba(197,164,109,0.5)] animate-pulse'
                        : 'bg-[#C5A46D]/20 group-hover:bg-[#C5A46D]/40'
                    }`}
                  />
                  
                  {/* Play/Pause Button Disc */}
                  <div
                    className={`relative w-12 h-12 rounded-full flex items-center justify-center shadow-lg shadow-black/60 hover:scale-105 active:scale-95 transition-all duration-300 ${
                      isPlaying
                        ? 'bg-gradient-to-br from-[#F5E2BE] via-[#D4B886] to-[#B38F52] ring-2 ring-[#C5A46D]'
                        : 'bg-gradient-to-br from-[#E3CCA3] via-[#C5A46D] to-[#A8864E]'
                    }`}
                  >
                    {isPlaying ? (
                      <Pause className="w-5 h-5 fill-[#151719] text-[#151719]" />
                    ) : (
                      <Play className="w-5 h-5 fill-[#151719] text-[#151719] ml-0.5" />
                    )}
                  </div>
                </button>

                {/* Next */}
                <button
                  onClick={handleNextTrack}
                  disabled={!currentTrack || !hasControl}
                  aria-label="Next Track"
                  className="p-1.5 text-[#A5A5A0] hover:text-[#F2EEE5] transition cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Next Track"
                >
                  <SkipForward className="w-5 h-5 fill-current" />
                </button>

                {/* Repeat */}
                <button
                  onClick={toggleLoop}
                  disabled={!currentTrack || !hasControl}
                  aria-label="Repeat"
                  className={`p-1.5 transition cursor-pointer ${
                    room.playback.loopCurrentTrack ? 'text-[#C5A46D]' : 'text-[#A5A5A0] hover:text-[#F2EEE5]'
                  }`}
                  title={room.playback.loopCurrentTrack ? 'Loop: ON' : 'Loop: OFF'}
                >
                  {room.playback.loopCurrentTrack ? <Repeat1 className="w-4 h-4" /> : <Repeat className="w-4 h-4" />}
                </button>

                {/* Volume Slider Area */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setVolume(volume > 0 ? 0 : 0.8)}
                    className="text-[#A5A5A0] hover:text-[#F2EEE5] cursor-pointer"
                  >
                    {volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                  </button>
                  <div className="w-16 h-1.5 bg-[#292D30] rounded-full relative flex items-center cursor-pointer">
                    <div
                      className="h-1.5 bg-[#C5A46D] rounded-full"
                      style={{ width: `${volume * 100}%` }}
                    />
                    <div
                      className="w-3 h-3 bg-[#F2EEE5] rounded-full shadow-[0_0_6px_rgba(197,164,109,0.5)] absolute -translate-x-1/2"
                      style={{ left: `${volume * 100}%` }}
                    />
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.01"
                      value={volume}
                      onChange={(e) => setVolume(parseFloat(e.target.value))}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                  </div>
                </div>
              </div>

              {/* Mobile-only tab bar */}
              <div className="md:hidden flex items-center justify-around border-t border-[#F2EEE5]/[0.08] pt-2.5 mt-1 shrink-0">
                <button
                  onClick={() => setMobileTab('player')}
                  className={`pb-1 text-xs font-semibold tracking-wide transition-colors cursor-pointer relative ${
                    mobileTab === 'player' ? 'text-[#F2EEE5] font-bold' : 'text-[#A5A5A0]'
                  }`}
                >
                  Player
                  {mobileTab === 'player' && (
                    <motion.div
                      layoutId="mobileTabUnderline"
                      className="absolute -bottom-1.5 left-0 right-0 h-[2px] bg-[#C5A46D] rounded-full shadow-[0_0_8px_#C5A46D]"
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    />
                  )}
                </button>

                <button
                  onClick={() => setMobileTab('queue')}
                  className={`pb-1 text-xs font-semibold tracking-wide transition-colors cursor-pointer relative ${
                    mobileTab === 'queue' ? 'text-[#F2EEE5] font-bold' : 'text-[#A5A5A0]'
                  }`}
                >
                  Queue ({approvedQueue.length})
                  {mobileTab === 'queue' && (
                    <motion.div
                      layoutId="mobileTabUnderline"
                      className="absolute -bottom-1.5 left-0 right-0 h-[2px] bg-[#C5A46D] rounded-full shadow-[0_0_8px_#C5A46D]"
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    />
                  )}
                </button>

                <button
                  onClick={() => setMobileTab('chat')}
                  className={`pb-1 text-xs font-semibold tracking-wide transition-colors cursor-pointer relative ${
                    mobileTab === 'chat' ? 'text-[#F2EEE5] font-bold' : 'text-[#A5A5A0]'
                  }`}
                >
                  Chat
                  {mobileTab === 'chat' && (
                    <motion.div
                      layoutId="mobileTabUnderline"
                      className="absolute -bottom-1.5 left-0 right-0 h-[2px] bg-[#C5A46D] rounded-full shadow-[0_0_8px_#C5A46D]"
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    />
                  )}
                </button>

                <button
                  onClick={() => setMobileTab('listeners')}
                  className={`pb-1 text-xs font-semibold tracking-wide transition-colors cursor-pointer relative ${
                    mobileTab === 'listeners' ? 'text-[#F2EEE5] font-bold' : 'text-[#A5A5A0]'
                  }`}
                >
                  Listeners ({room.participants.length})
                  {mobileTab === 'listeners' && (
                    <motion.div
                      layoutId="mobileTabUnderline"
                      className="absolute -bottom-1.5 left-0 right-0 h-[2px] bg-[#C5A46D] rounded-full shadow-[0_0_8px_#C5A46D]"
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    />
                  )}
                </button>
              </div>

              {/* Mobile Active Drawer Container */}
              <div className="md:hidden mt-2 max-h-[340px] overflow-hidden flex flex-col">
                {mobileTab === 'chat' && (
                  <div className="flex-1 flex flex-col justify-between overflow-hidden">
                    {renderChatMessages()}
                    <form onSubmit={handleSendChat} className="relative mt-2">
                      <input
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        className="w-full bg-[#292D30] border border-[#F2EEE5]/[0.1] rounded-xl px-3.5 py-2.5 pr-10 text-xs text-[#F2EEE5] placeholder-[#A5A5A0]/50 focus:outline-none focus:border-[#C5A46D]/60 focus:ring-1 focus:ring-[#C5A46D]/50 transition"
                        placeholder="Send a message..."
                        type="text"
                      />
                    </form>
                  </div>
                )}
                {mobileTab === 'queue' && (
                  <div className="flex-1 flex flex-col justify-between overflow-hidden">
                    {renderQueueTrackList()}
                    {renderAddSongButton()}
                  </div>
                )}
                {mobileTab === 'listeners' && renderListenersContent()}
              </div>

            </div>
          </main>
          {/* END: CenterPlayerArea */}

          {/* BEGIN: SidePanelsWrapper */}
          <div className="hidden md:flex flex-row gap-4 lg:gap-5 items-stretch shrink-0 overflow-hidden" id="sidePanelsWrapper">
            
            {/* BEGIN: ChatAndListenersPanel (Redesigned in Dark Slate) */}
            <section
              className={`panel-drawer w-72 lg:w-80 shrink-0 bg-[#202326]/95 backdrop-blur-xl border border-[#F2EEE5]/[0.07] rounded-3xl p-5 flex flex-col justify-between shadow-2xl ${
                isChatOpen ? 'panel-expanded' : 'panel-collapsed'
              }`}
              data-purpose="chat-panel"
              id="panelChat"
            >
              {/* Header: Chat & Listeners Tab Navigation */}
              <div>
                <div className="flex items-center justify-between border-b border-[#F2EEE5]/[0.08] pb-3">
                  <div className="flex items-center gap-6">
                    <button
                      onClick={() => setActiveSideTab('chat')}
                      className={`relative font-serif text-sm tracking-wide transition cursor-pointer ${
                        activeSideTab === 'chat' ? 'text-[#F2EEE5] font-semibold' : 'text-[#A5A5A0] hover:text-[#F2EEE5]'
                      }`}
                    >
                      Chat
                      {activeSideTab === 'chat' && (
                        <span className="absolute -bottom-3 left-0 right-0 h-0.5 bg-[#C5A46D] shadow-[0_0_8px_#C5A46D]" />
                      )}
                    </button>
                    
                    <button
                      onClick={() => setActiveSideTab('listeners')}
                      className={`relative font-serif text-sm tracking-wide transition cursor-pointer ${
                        activeSideTab === 'listeners' ? 'text-[#F2EEE5] font-semibold' : 'text-[#A5A5A0] hover:text-[#F2EEE5]'
                      }`}
                    >
                      Listeners ({room.participants.length})
                      {activeSideTab === 'listeners' && (
                        <span className="absolute -bottom-3 left-0 right-0 h-0.5 bg-[#C5A46D] shadow-[0_0_8px_#C5A46D]" />
                      )}
                    </button>
                  </div>

                  <button
                    onClick={() => handleNavClick('chat')}
                    aria-label="Close Chat"
                    className="text-[#A5A5A0] hover:text-[#F2EEE5] transition cursor-pointer"
                    id="closeChatBtn"
                    title="Close Panel"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* User Card in Chat */}
                <div className="mt-4 p-2.5 rounded-2xl bg-[#292D30] border border-white/[0.05] flex items-center gap-3">
                  <div className={`relative w-8 h-8 rounded-full bg-gradient-to-br ${getAvatarGradient(username)} text-[#F2EEE5] font-bold text-xs flex items-center justify-center shadow-md`}>
                    {username ? username.slice(0, 2).toUpperCase() : 'ME'}
                    <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-[#8D9A86] border border-[#151719]" />
                  </div>
                  <div className="flex flex-col">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold text-[#F2EEE5] tracking-tight">@{username || 'Guest'}</span>
                      {isHost && <Crown className="w-3 h-3 text-[#C5A46D] fill-current" />}
                    </div>
                    <span className="text-[10px] text-[#A5A5A0]">{isHost ? 'Room Host' : 'Participant'}</span>
                  </div>
                </div>
              </div>

              {/* Body: Chat Stream or Listeners */}
              {activeSideTab === 'chat' ? (
                <>
                  {renderChatMessages()}

                  {/* Anchored Message Input Bar */}
                  <div className="relative mt-2">
                    {replyTo && (
                      <div className="flex items-center justify-between px-3 py-1 bg-black/40 rounded-lg text-[10px] text-[#C5A46D] mb-1.5">
                        <span>Replying to @{replyTo.username}</span>
                        <button onClick={() => setReplyTo(null)} className="hover:text-white font-bold">&times;</button>
                      </div>
                    )}

                    <form onSubmit={handleSendChat} className="relative flex items-center">
                      <input
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        className="w-full bg-[#292D30] border border-[#F2EEE5]/[0.1] rounded-xl px-3.5 py-2.5 pr-10 text-xs text-[#F2EEE5] placeholder-[#A5A5A0]/50 focus:outline-none focus:border-[#C5A46D]/60 focus:ring-1 focus:ring-[#C5A46D]/50 transition"
                        placeholder="Send a message..."
                        type="text"
                      />
                      <button
                        type="button"
                        onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                        aria-label="Emoji reactions"
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#A5A5A0] hover:text-[#C5A46D] transition cursor-pointer"
                      >
                        <Smile className="w-4 h-4" />
                      </button>
                    </form>

                    {/* Quick Reactions Bar */}
                    <div className="flex items-center justify-between px-2 pt-2">
                      {['❤️', '🔥', '😍', '👏', '🎵'].map((emoji) => (
                        <button
                          key={emoji}
                          onClick={() => sendReaction(emoji)}
                          className="text-sm hover:scale-125 active:scale-95 transition cursor-pointer"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>

                    {/* Emoji Picker Popover */}
                    {showEmojiPicker && (
                      <div className="absolute bottom-full mb-2 left-0 right-0 p-2.5 rounded-2xl bg-[#202326] border border-[#F2EEE5]/[0.15] grid grid-cols-6 gap-2 shadow-2xl z-30">
                        {['❤️', '🔥', '😍', '👏', '🎵', '💯', '😂', '😭', '🎉', '✨', '⚡', '👀'].map((emoji) => (
                          <button
                            key={emoji}
                            onClick={() => {
                              sendReaction(emoji);
                              setShowEmojiPicker(false);
                            }}
                            className="text-lg hover:scale-125 p-1 cursor-pointer transition"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <>
                  {renderListenersContent()}
                  <div className="pt-2 border-t border-[#F2EEE5]/[0.08] shrink-0">
                    <button
                      onClick={() => setShowDjModal(true)}
                      className="w-full py-2.5 rounded-2xl bg-[#292D30] border border-[#C5A46D]/30 hover:border-[#C5A46D]/60 text-xs font-semibold text-[#C5A46D] flex items-center justify-center gap-2 cursor-pointer transition"
                    >
                      <Disc className="w-4 h-4" />
                      <span>DJ Booth Management</span>
                    </button>
                  </div>
                </>
              )}
            </section>
            {/* END: ChatAndListenersPanel */}

            {/* BEGIN: QueuePanel (Redesigned with Subtle Card Separation) */}
            <section
              className={`panel-drawer w-72 lg:w-80 shrink-0 bg-[#202326]/95 backdrop-blur-xl border border-[#F2EEE5]/[0.07] rounded-3xl p-5 flex flex-col justify-between shadow-2xl ${
                isQueueOpen ? 'panel-expanded' : 'panel-collapsed'
              }`}
              data-purpose="queue-panel"
              id="panelQueue"
            >
              {/* Queue Header */}
              <div>
                <div className="flex items-center justify-between border-b border-[#F2EEE5]/[0.08] pb-3">
                  <div className="flex items-baseline gap-1.5">
                    <h2 className="font-serif text-[#F2EEE5] text-base font-semibold tracking-wide">Queue</h2>
                    <span className="text-xs font-normal text-[#A5A5A0] font-sans">({approvedQueue.length})</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {/* Audio Tuning Icon */}
                    <button
                      onClick={() => setShowSettingsModal(true)}
                      aria-label="Queue Settings"
                      className="text-[#A5A5A0] hover:text-[#F2EEE5] transition cursor-pointer"
                      title="Audio Settings"
                    >
                      <SlidersHorizontal className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleNavClick('queue')}
                      aria-label="Close Queue"
                      className="text-[#A5A5A0] hover:text-[#F2EEE5] transition cursor-pointer"
                      id="closeQueueBtn"
                      title="Close Panel"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Pending Requests Banner */}
                {pendingRequests.length > 0 && (
                  <div className="mt-3 p-2.5 rounded-2xl bg-[#292D30] border border-[#C5A46D]/30 space-y-2">
                    <div className="flex items-center justify-between text-xs font-semibold text-[#C5A46D]">
                      <span className="flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5" />
                        Song Requests ({pendingRequests.length})
                      </span>
                      {isHost && <span className="text-[10px] text-[#A5A5A0]">Host Review</span>}
                    </div>

                    <div className="space-y-1.5 max-h-[90px] overflow-y-auto custom-scroll pr-1">
                      {pendingRequests.map((track) => (
                        <div key={track.id} className="flex items-center justify-between p-2 rounded-xl bg-[#1C1F22] text-xs">
                          <div className="min-w-0 pr-2">
                            <p className="font-semibold text-[#F2EEE5] truncate text-xs">{track.title}</p>
                            <p className="text-[10px] text-[#A5A5A0] truncate">@{track.uploadedBy}</p>
                          </div>
                          {isHost ? (
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                onClick={() => approveTrack(track.id)}
                                className="px-2 py-0.5 bg-[#8D9A86]/20 text-[#8D9A86] border border-[#8D9A86]/30 hover:bg-[#8D9A86]/30 rounded text-[10px] font-bold"
                              >
                                OK
                              </button>
                              <button
                                onClick={() => removeFromQueue(track.id)}
                                className="px-2 py-0.5 bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded text-[10px] font-bold"
                              >
                                &times;
                              </button>
                            </div>
                          ) : (
                            <span className="text-[9px] text-[#C5A46D]">Pending</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Queued Tracks List */}
              {renderQueueTrackList()}

              {/* Bottom: Champagne Accent Add Song Button */}
              {renderAddSongButton()}
            </section>
            {/* END: QueuePanel */}

          </div>
          {/* END: SidePanelsWrapper */}

        </div>
        {/* END: DashboardLayout */}

      </div>
      {/* END: RoomRootContainer */}

      {/* ───── INVITE MODAL (Redesigned) ───── */}
      <AnimatePresence>
        {showInviteModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="w-full max-w-sm">
              <div className="bg-[#202326] border border-[#F2EEE5]/[0.08] p-7 text-center relative shadow-2xl rounded-3xl">
                <button onClick={() => setShowInviteModal(false)} className="absolute top-4 right-4 text-[#A5A5A0] hover:text-[#F2EEE5] text-xl cursor-pointer">&times;</button>
                <h3 className="text-lg font-serif font-bold text-[#F2EEE5] mb-5">Invite Friends</h3>

                {session?.user && (
                  <div className="mb-4 bg-[#1C1F22] border border-white/5 p-3 rounded-2xl text-left space-y-2">
                    <span className="text-[10px] font-semibold text-[#A5A5A0] uppercase tracking-wider block">Connected Friends</span>
                    <div className="space-y-1.5 max-h-[140px] overflow-y-auto custom-scroll">
                      {onlineFriends.length === 0 ? (
                        <p className="text-[10px] text-[#A5A5A0]/60 italic">No friends connected to invite.</p>
                      ) : (
                        onlineFriends.map((fr) => (
                          <div key={fr.id} className="flex justify-between items-center p-2 bg-[#292D30] rounded-xl text-xs">
                            <span className="font-semibold text-[#F2EEE5]">@{fr.friendName}</span>
                            <button
                              onClick={() => {
                                sendFriendInvite(fr.friendName);
                                alert(`Invitation sent to @${fr.friendName}!`);
                              }}
                              className="px-3 py-1 rounded-full text-[10px] font-bold cursor-pointer text-[#151719] bg-gradient-to-r from-[#D4B886] via-[#C5A46D] to-[#B38F52]"
                            >
                              Invite
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}

                <div className="bg-[#292D30] border border-[#C5A46D]/30 p-4 rounded-2xl mb-5">
                  <span className="block text-[10px] font-semibold text-[#A5A5A0] uppercase tracking-wider mb-1">Room Code</span>
                  <span className="text-2xl font-black text-[#C5A46D] font-mono tracking-widest select-all">{roomCode}</span>
                </div>

                <div className="space-y-2.5">
                  <button onClick={handleCopyCode} className="w-full py-2.5 bg-[#292D30] border border-[#F2EEE5]/[0.1] text-[#F2EEE5] rounded-full text-xs font-semibold hover:border-[#C5A46D]/50 cursor-pointer transition">
                    {copiedCode ? 'Copied Code!' : 'Copy Room Code'}
                  </button>
                  <button onClick={handleCopyLink} className="w-full py-2.5 rounded-full text-xs font-bold cursor-pointer shadow-lg text-[#151719] bg-gradient-to-r from-[#D4B886] via-[#C5A46D] to-[#B38F52] hover:brightness-105 transition">
                    {copiedLink ? 'Copied Link!' : 'Copy Invite Link'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ───── ROOM SETTINGS / CALIBRATION MODAL (Redesigned) ───── */}
      <AnimatePresence>
        {showSettingsModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="w-full max-w-md">
              <div className="bg-[#202326] border border-[#F2EEE5]/[0.08] p-7 relative shadow-2xl space-y-4 rounded-3xl">
                <button onClick={() => setShowSettingsModal(false)} className="absolute top-4 right-4 text-[#A5A5A0] hover:text-[#F2EEE5] text-xl cursor-pointer">&times;</button>
                
                <h3 className="text-lg font-serif font-bold text-[#F2EEE5] flex items-center gap-2">
                  <Shield className="w-5 h-5 text-[#C5A46D]" />
                  <span>Room Settings & Audio Tuning</span>
                </h3>

                <div className="space-y-3 pt-2 text-xs">
                  <div className="flex justify-between items-center p-3 rounded-2xl bg-[#292D30] border border-white/5">
                    <div>
                      <p className="font-semibold text-[#F2EEE5]">Collaborative Mode</p>
                      <p className="text-[10px] text-[#A5A5A0]">Allow listeners to control playback and add songs freely</p>
                    </div>
                    <input
                      type="checkbox"
                      disabled={!isHost}
                      checked={room.settings.collaborativeMode}
                      onChange={(e) => updateSettings({ collaborativeMode: e.target.checked })}
                      className="w-4 h-4 accent-[#C5A46D] cursor-pointer"
                    />
                  </div>

                  {/* Audio Delay calibration */}
                  <div className="p-3 rounded-2xl bg-[#292D30] border border-white/5 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-[#F2EEE5]">Local Audio Delay Calibration</span>
                      <span className="text-[#C5A46D] font-bold font-mono">{audioDelay > 0 ? `+${audioDelay}` : audioDelay} ms</span>
                    </div>
                    <input
                      type="range"
                      min="-200"
                      max="200"
                      step="10"
                      value={audioDelay}
                      onChange={(e) => saveAudioDelay(parseInt(e.target.value))}
                      className="w-full accent-[#C5A46D] cursor-pointer"
                    />
                    <p className="text-[10px] text-[#A5A5A0]">Fine-tune sync timing for Bluetooth headphones, DACs, or high latency connections</p>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    onClick={() => setShowSettingsModal(false)}
                    className="w-full py-2.5 rounded-full text-xs font-bold cursor-pointer text-[#151719] bg-gradient-to-r from-[#D4B886] via-[#C5A46D] to-[#B38F52] hover:brightness-105"
                  >
                    Done
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ───── DJ BOOTH MODAL (Redesigned) ───── */}
      <AnimatePresence>
        {showDjModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="w-full max-w-sm">
              <div className="bg-[#202326] border border-[#F2EEE5]/[0.08] p-6 relative shadow-2xl space-y-4 rounded-3xl">
                <button onClick={() => setShowDjModal(false)} className="absolute top-4 right-4 text-[#A5A5A0] hover:text-[#F2EEE5] text-xl cursor-pointer">&times;</button>
                
                <h3 className="text-base font-serif font-bold text-[#F2EEE5] flex items-center gap-2">
                  <Disc className="w-4 h-4 text-[#C5A46D]" />
                  <span>DJ Booth Management</span>
                </h3>

                <div className="p-3 rounded-2xl bg-[#292D30] border border-white/5 space-y-2 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-[#A5A5A0]">DJ Booth Status:</span>
                    <span className="font-bold text-[#C5A46D]">{isDjBoothMode ? 'Active' : 'Inactive'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[#A5A5A0]">Active DJ:</span>
                    <span className="font-bold text-[#F2EEE5]">@{activeDjUsername || 'None'}</span>
                  </div>
                </div>

                <div className="space-y-2 pt-1">
                  {isHost && (
                    <button
                      onClick={() => updateSettings({ djBoothMode: !isDjBoothMode })}
                      className="w-full py-2.5 rounded-full border border-[#C5A46D]/40 text-[#C5A46D] hover:bg-[#C5A46D]/10 text-xs font-bold cursor-pointer transition"
                    >
                      {isDjBoothMode ? 'Disable DJ Booth Mode' : 'Enable DJ Booth Mode'}
                    </button>
                  )}

                  {isUserDj ? (
                    <button
                      onClick={leaveDjBooth}
                      className="w-full py-2.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-bold cursor-pointer transition"
                    >
                      Step Down as DJ
                    </button>
                  ) : (
                    <button
                      onClick={joinDjBooth}
                      className="w-full py-2.5 rounded-full text-xs font-bold cursor-pointer text-[#151719] bg-gradient-to-r from-[#D4B886] via-[#C5A46D] to-[#B38F52] hover:brightness-105"
                    >
                      Step Up to DJ Booth
                    </button>
                  )}
                </div>
              </div>
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
        initialSource={addSongInitialSource}
      />

      {/* LEAVE ROOM CONFIRMATION MODAL */}
      {showLeaveConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md select-none">
          <div className="w-full max-w-sm bg-[#202326] border border-[#F2EEE5]/[0.08] p-6 shadow-2xl space-y-4 relative rounded-3xl">
            <button
              onClick={() => setShowLeaveConfirmModal(false)}
              className="absolute top-5 right-5 text-[#A5A5A0] hover:text-[#F2EEE5] text-xl font-bold cursor-pointer"
            >
              &times;
            </button>
            <div className="flex items-center gap-3">
              <div className="p-3 bg-red-500/15 border border-red-500/30 rounded-2xl shrink-0">
                <LogOut className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <h3 className="text-base font-serif font-bold text-[#F2EEE5]">Leave Session?</h3>
                <p className="text-[#A5A5A0] text-xs mt-0.5">{room?.roomName || roomCode}</p>
              </div>
            </div>
            <p className="text-xs text-[#A5A5A0] leading-relaxed">
              You can rejoin anytime from Explore Rooms or using the room code.
            </p>
            <div className="flex justify-end gap-2.5 pt-2">
              <button
                onClick={() => setShowLeaveConfirmModal(false)}
                className="px-4 py-2 bg-[#292D30] border border-[#F2EEE5]/[0.1] text-[#F2EEE5] rounded-full text-xs font-semibold cursor-pointer hover:border-white/20"
              >
                Cancel
              </button>
              <button
                onClick={confirmLeave}
                className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-full text-xs font-bold shadow-lg cursor-pointer transition"
              >
                Confirm Leave
              </button>
            </div>
          </div>
        </div>
      )}

      {/* KICK MEMBER CONFIRMATION MODAL */}
      {memberToKick && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md select-none">
          <div className="w-full max-w-sm bg-[#202326] p-6 shadow-2xl space-y-4 relative border border-red-500/30 rounded-3xl">
            <button
              onClick={() => setMemberToKick(null)}
              className="absolute top-5 right-5 text-[#A5A5A0] hover:text-[#F2EEE5] text-xl font-bold cursor-pointer"
            >
              &times;
            </button>
            <div className="flex items-center gap-3">
              <div className="p-3 bg-red-500/15 border border-red-500/30 rounded-2xl shrink-0">
                <UserX className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <h3 className="text-base font-serif font-bold text-[#F2EEE5]">Remove Member?</h3>
                <p className="text-xs text-[#A5A5A0] mt-0.5">
                  @{memberToKick.username} will be disconnected from the room.
                </p>
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setMemberToKick(null)}
                className="flex-1 py-2.5 bg-[#292D30] border border-[#F2EEE5]/[0.1] text-[#F2EEE5] rounded-full text-xs font-semibold cursor-pointer hover:border-white/20"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  kickParticipant(memberToKick.id, memberToKick.username);
                  setMemberToKick(null);
                }}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-full text-xs font-bold cursor-pointer shadow-lg transition"
              >
                Kick Member
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
