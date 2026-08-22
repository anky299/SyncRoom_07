'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession, signIn, signOut } from 'next-auth/react';
import dynamic from 'next/dynamic';
import { useTheme, THEMES, ThemeName } from '@/context/ThemeContext';
import { GlassCard } from '@/components/GlassCard';
import { getBackendUrl } from '@/lib/config';
import { safeFetchJson } from '@/lib/api';
import {
  Home as HomeIcon,
  Grid,
  Library,
  Users,
  MessageSquare,
  Settings,
  Crown,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Heart,
  Moon,
  Search,
  ChevronRight,
  ChevronLeft,
  Plus,
  ArrowRight,
  Compass,
  Radio,
  Clock,
  Music,
  Shield,
  Zap,
  Lock,
  Unlock,
  LogOut,
  Edit2,
  Activity,
  Check,
  Flame,
  Sparkles,
  Inbox,
  Loader2,
  Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// Lazy load Equalizer visualizer & 3D CityDome components
const EqualizerHero = dynamic(() => import('@/components/Headphones3D'), {
  ssr: false,
  loading: () => (
    <div className="w-72 h-72 md:w-96 md:h-96 flex items-center justify-center bg-[#0A142D]/60 border border-[var(--theme-accent,#00F0FF)]/30 rounded-full shadow-[0_0_30px_rgba(0,240,255,0.2)]">
      <div className="w-12 h-12 rounded-full border-2 border-[var(--theme-accent,#00F0FF)] border-t-transparent animate-spin" />
    </div>
  ),
});

const CityDome3D = dynamic(() => import('@/components/CityDome3D'), {
  ssr: false,
  loading: () => (
    <div className="w-44 h-44 flex items-center justify-center bg-[#0A142D]/40 border border-[#00F0FF]/20 rounded-full">
      <div className="w-8 h-8 rounded-full border-2 border-[#00F0FF] border-t-transparent animate-spin" />
    </div>
  ),
});

const BACKEND_URL = getBackendUrl();
const AVATAR_PRESETS = ['#00F0FF', '#00FF9D', '#FF5E7E', '#39FF14', '#A855F7', '#FF9F43'];

export default function RealDataHomePage() {
  const router = useRouter();
  const { data: session, update: updateSession } = useSession();
  const { activeTheme, setTheme } = useTheme();

  // Modal states
  const [activeModal, setActiveModal] = useState<'create' | 'join' | 'auth' | 'schedule' | null>(null);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Form states
  const [username, setUsername] = useState('');
  const [roomName, setRoomName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [password, setPassword] = useState('');
  const [maxParticipants, setMaxParticipants] = useState(10);
  const [collaborativeMode, setCollaborativeMode] = useState(true);

  // Auth Form states
  const [email, setEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authUsername, setAuthUsername] = useState('');
  const [authAvatar, setAuthAvatar] = useState('#00F0FF');

  // Profile Edit states
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [editUsername, setEditUsername] = useState('');
  const [editAvatar, setEditAvatar] = useState('#00F0FF');
  const [editBio, setEditBio] = useState('');
  const [statusText, setStatusText] = useState('Let the music bring us together.');
  const [isEditingStatus, setIsEditingStatus] = useState(false);
  const [optOutStats, setOptOutStats] = useState(false);

  // ROOM DELETION MODAL STATE
  const [roomToDelete, setRoomToDelete] = useState<{ roomId: string; roomName: string } | null>(null);
  const [deletingRoom, setDeletingRoom] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  // Docked Mini Player state (Real Active Session)
  const [isPlayingMini, setIsPlayingMini] = useState(false);
  const [isLikedMini, setIsLikedMini] = useState(false);
  const [miniVolume, setMiniVolume] = useState(0.8);

  // Dark Mode Toggle state
  const [darkModeActive, setDarkModeActive] = useState(true);

  // REAL USER DATA & STATS
  const [stats, setStats] = useState<{
    history: any[];
    roomHistory: any[];
    totalMinutes: number;
    topTrack: string;
    favoriteRoom: string;
  } | null>(null);

  const [friends, setFriends] = useState<any[]>([]);
  const [platformStats, setPlatformStats] = useState<{ totalRoomsCreated: number; totalUsers: number } | null>(null);
  const [dataLoading, setDataLoading] = useState(true);

  const [friendSearch, setFriendSearch] = useState('');
  const [friendError, setFriendError] = useState('');
  const [friendSuccess, setFriendSuccess] = useState('');

  // Initial user sync
  useEffect(() => {
    fetchPlatformStats();
    if (session?.user) {
      const uName = (session.user as any).username || '';
      setUsername(uName);
      setEditUsername(uName);
      setEditAvatar((session.user as any).avatar || '#00F0FF');
      setEditBio((session.user as any).bio || '');
      setOptOutStats((session.user as any).optedOutStats || false);
      fetchUserData(uName);
    } else {
      setDataLoading(false);
    }
  }, [session]);

  const fetchPlatformStats = async () => {
    try {
      const data = await safeFetchJson('/api/rooms/stats');
      setPlatformStats(data);
    } catch (e) {
      console.log('Failed to fetch platform stats', e);
    }
  };

  const fetchUserData = async (uName: string) => {
    setDataLoading(true);
    try {
      const statsData = await safeFetchJson(`/api/stats?username=${encodeURIComponent(uName)}`);
      setStats(statsData);

      const friendsData = await safeFetchJson(`/api/friends/list?username=${encodeURIComponent(uName)}`);
      setFriends(friendsData);
    } catch (e) {
      console.log('Failed to fetch user data', e);
    } finally {
      setDataLoading(false);
    }
  };

  const handleConfirmDeleteRoom = async () => {
    if (!roomToDelete) return;
    setDeletingRoom(true);
    setDeleteError('');
    const curUser = (session?.user as any)?.username || username || 'Guest';

    try {
      const data = await safeFetchJson(`/api/rooms/${roomToDelete.roomId}?username=${encodeURIComponent(curUser)}`, {
        method: 'DELETE',
      });
      if (data.success) {
        setStats((prev) =>
          prev
            ? {
                ...prev,
                roomHistory: prev.roomHistory.filter((r) => r.roomId.toLowerCase() !== roomToDelete.roomId.toLowerCase()),
              }
            : null
        );
        setRoomToDelete(null);
      } else {
        setDeleteError(data.error || 'Failed to delete room');
      }
    } catch (err: any) {
      setDeleteError(err.message || 'Error connecting to server');
    } finally {
      setDeletingRoom(false);
    }
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage('');

    try {
      if (authMode === 'register') {
        await safeFetchJson('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email,
            password: authPassword,
            username: authUsername,
            avatar: authAvatar,
          }),
        });
      }

      const result = await signIn('credentials', {
        email,
        password: authPassword,
        redirect: false,
      });

      if (result?.error) {
        throw new Error('Invalid email or password');
      }

      setActiveModal(null);
      setEmail('');
      setAuthPassword('');
      setAuthUsername('');
    } catch (err: any) {
      setErrorMessage(err.message || 'Authentication error');
    } finally {
      setLoading(false);
    }
  };

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editUsername.trim()) return;

    setLoading(true);
    try {
      const updatedUser = await safeFetchJson('/api/auth/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: (session?.user as any).id,
          username: editUsername.trim(),
          avatar: editAvatar,
          bio: editBio.trim(),
          optedOutStats: optOutStats,
        }),
      });

      await updateSession({
        username: updatedUser.username,
        avatar: updatedUser.avatar,
        bio: updatedUser.bio,
        optedOutStats: updatedUser.optedOutStats,
      });

      setShowProfileModal(false);
      fetchUserData(updatedUser.username);
    } catch (err: any) {
      alert(err.message || 'Failed to update');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalUsername = username.trim() || (session?.user as any)?.username || 'Guest';
    setLoading(true);
    setErrorMessage('');

    try {
      const { io } = await import('socket.io-client');
      const socket = io(BACKEND_URL);
      
      socket.emit('room-create', {
        roomName: roomName.trim() || `${finalUsername}'s Room`,
        username: finalUsername,
        settings: {
          isPrivate,
          password: isPrivate ? password : undefined,
          maxParticipants,
          collaborativeMode,
        }
      }, (response: { success: boolean; room?: any; error?: string }) => {
        socket.disconnect();
        if (response.success && response.room) {
          router.push(`/room/${response.room.roomId}?username=${encodeURIComponent(finalUsername)}`);
        } else {
          setErrorMessage(response.error || 'Failed to create room');
          setLoading(false);
        }
      });
    } catch (err) {
      setErrorMessage('Could not connect to backend server.');
      setLoading(false);
    }
  };

  const handleJoinRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomCode.trim()) {
      setErrorMessage('Room code is required');
      return;
    }
    const finalUsername = username.trim() || (session?.user as any)?.username || 'Guest';
    setLoading(true);
    setErrorMessage('');

    const formattedCode = roomCode.trim().toUpperCase();
    let targetUrl = `/room/${formattedCode}?username=${encodeURIComponent(finalUsername)}`;
    if (isPrivate && password) {
      targetUrl += `&password=${encodeURIComponent(password)}`;
    }
    router.push(targetUrl);
  };

  const handleAddFriend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!friendSearch.trim()) return;

    setFriendError('');
    setFriendSuccess('');
    const uName = (session?.user as any)?.username || username || 'Guest';
    try {
      await safeFetchJson('/api/friends/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: uName,
          friendUsername: friendSearch.trim(),
        }),
      });

      setFriendSuccess('Friend request sent!');
      setFriendSearch('');
      fetchUserData(uName);
    } catch (e: any) {
      setFriendError(e.message || 'Failed to add friend');
    }
  };

  // Template Presets for Room Creation
  const templates = [
    { id: '1', title: 'Chill Vibes', desc: 'Relax & unwind preset', max: 10, img: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=400&q=80' },
    { id: '2', title: 'Party Mode', desc: 'High energy preset', max: 20, img: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&w=400&q=80' },
    { id: '3', title: 'Study Session', desc: 'Productivity preset', max: 8, img: 'https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=400&q=80' },
    { id: '4', title: 'Lo-fi Beats', desc: 'Lo-fi room preset', max: 15, img: 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?auto=format&fit=crop&w=400&q=80' },
  ];

  return (
    <div
      className="relative min-h-screen text-[#F4F4F5] flex flex-col justify-between overflow-x-hidden"
      style={{ backgroundColor: activeTheme.bg }}
    >
      
      {/* TOP NAVIGATION BAR */}
      <header className="sticky top-0 z-50 w-full bg-[#060B19]/80 backdrop-blur-xl border-b border-white/10 px-6 py-3 flex justify-between items-center">
        {/* Left: Waveform Logo */}
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => router.push('/')}>
          <div className="flex items-center gap-1">
            <span className="w-1 h-5 rounded-full animate-pulse" style={{ backgroundColor: activeTheme.accent }} />
            <span className="w-1 h-7 rounded-full animate-pulse" style={{ backgroundColor: activeTheme.accent, animationDelay: '0.15s' }} />
            <span className="w-1 h-4 rounded-full animate-pulse" style={{ backgroundColor: activeTheme.accent, animationDelay: '0.3s' }} />
          </div>
          <span className="font-display font-black text-2xl tracking-tight text-white">
            Sync<span style={{ color: activeTheme.accent }}>Room</span>
          </span>
        </div>

        {/* Center: Segmented Theme Switcher Control Pill */}
        <div className="hidden md:flex items-center gap-1 bg-[#0A142D]/80 border border-white/10 p-1 rounded-full text-xs font-semibold">
          {(Object.keys(THEMES) as ThemeName[]).map((themeKey) => {
            const theme = THEMES[themeKey];
            const isActive = activeTheme.id === themeKey;
            return (
              <button
                key={themeKey}
                onClick={() => setTheme(themeKey)}
                className={`px-4 py-1.5 rounded-full transition-all cursor-pointer ${
                  isActive
                    ? 'theme-pill-active font-extrabold text-white shadow-lg'
                    : 'text-zinc-400 hover:text-white'
                }`}
                style={isActive ? { borderColor: activeTheme.accent } : {}}
              >
                {theme.name}
              </button>
            );
          })}
        </div>

        {/* Right: Account & Action Controls */}
        <div className="flex items-center gap-3">
          <div
            onClick={() => {
              if (!session) {
                setAuthMode('login');
                setActiveModal('auth');
              } else {
                setShowProfileModal(true);
              }
            }}
            className="flex items-center gap-2 bg-[#0A142D]/80 border border-white/10 px-3 py-1.5 rounded-full cursor-pointer hover:border-white/30 transition-all"
          >
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-black text-black select-none"
              style={{ backgroundColor: (session?.user as any)?.avatar || activeTheme.accent }}
            >
              {(session?.user as any)?.username?.charAt(0).toUpperCase() || 'G'}
            </div>
            <span className="text-xs font-bold text-white">
              {(session?.user as any)?.username || 'Guest'}
            </span>
            <ChevronRight className="w-3.5 h-3.5 text-zinc-400 rotate-90" />
          </div>

          <button
            onClick={() => { setErrorMessage(''); setActiveModal('join'); }}
            className="btn-theme-outline px-4 py-2 text-xs font-bold rounded-full cursor-pointer"
          >
            Join Space
          </button>

          <button
            onClick={() => { setErrorMessage(''); setActiveModal('create'); }}
            className="btn-theme-primary px-5 py-2 text-xs font-extrabold rounded-full cursor-pointer"
          >
            Create Room
          </button>
        </div>
      </header>

      {/* MAIN 3-COLUMN LAYOUT */}
      <div className="relative z-10 flex-grow grid grid-cols-1 lg:grid-cols-12 gap-6 p-6 max-w-[1600px] mx-auto w-full">
        
        {/* 1. LEFT SIDEBAR NAVIGATION (Col span 2) */}
        <aside className="lg:col-span-2 flex flex-col justify-between gap-6">
          <GlassCard className="p-4 flex flex-col space-y-1">
            <button className="flex items-center gap-3 px-4 py-3 bg-[#00F0FF]/15 border border-[#00F0FF]/40 rounded-xl text-white font-bold text-xs shadow-[0_0_15px_rgba(0,240,255,0.2)]">
              <HomeIcon className="w-4 h-4 text-[#00F0FF]" />
              <span>Home</span>
            </button>

            <button onClick={() => setActiveModal('join')} className="flex items-center gap-3 px-4 py-3 text-zinc-400 hover:text-white hover:bg-white/5 rounded-xl text-xs font-semibold transition-all cursor-pointer">
              <Grid className="w-4 h-4" />
              <span>Rooms</span>
            </button>

            <button onClick={() => setActiveModal('create')} className="flex items-center gap-3 px-4 py-3 text-zinc-400 hover:text-white hover:bg-white/5 rounded-xl text-xs font-semibold transition-all cursor-pointer">
              <Library className="w-4 h-4" />
              <span>Library</span>
            </button>

            <button className="flex items-center gap-3 px-4 py-3 text-zinc-400 hover:text-white hover:bg-white/5 rounded-xl text-xs font-semibold transition-all">
              <Users className="w-4 h-4" />
              <span>Friends</span>
            </button>

            <button className="flex items-center justify-between px-4 py-3 text-zinc-400 hover:text-white hover:bg-white/5 rounded-xl text-xs font-semibold transition-all">
              <div className="flex items-center gap-3">
                <MessageSquare className="w-4 h-4" />
                <span>Messages</span>
              </div>
            </button>

            <button className="flex items-center gap-3 px-4 py-3 text-zinc-400 hover:text-white hover:bg-white/5 rounded-xl text-xs font-semibold transition-all">
              <Settings className="w-4 h-4" />
              <span>Settings</span>
            </button>

            <button className="flex items-center gap-3 px-4 py-3 text-zinc-400 hover:text-white hover:bg-white/5 rounded-xl text-xs font-semibold transition-all">
              <Crown className="w-4 h-4 text-amber-400" />
              <span>Premium</span>
            </button>
          </GlassCard>

          {/* DOCKED MINI PLAYER AT BOTTOM OF SIDEBAR (REAL STREAMING / IDLE STATE) */}
          <GlassCard className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-10 h-10 rounded-lg bg-[#0A142D] border border-white/10 flex items-center justify-center shrink-0">
                  <Radio className="w-5 h-5 text-[#00F0FF]" />
                </div>
                <div className="min-w-0">
                  <h4 className="font-extrabold text-xs text-white truncate">SyncRoom Stream</h4>
                  <p className="text-[10px] text-zinc-500 font-mono-tech truncate">Idle - No Track Playing</p>
                </div>
              </div>
              <button disabled className="text-zinc-600 cursor-not-allowed">
                <Heart className="w-4 h-4" />
              </button>
            </div>

            {/* Audio Progress Bar */}
            <div className="space-y-1">
              <input
                type="range"
                disabled
                min="0"
                max="100"
                value="0"
                className="w-full h-1 accent-[#00F0FF] cursor-not-allowed opacity-40"
              />
              <div className="flex justify-between text-[9px] text-zinc-600 font-mono-tech">
                <span>0:00</span>
                <span>0:00</span>
              </div>
            </div>

            {/* Transport Controls */}
            <div className="flex items-center justify-center gap-4">
              <button disabled className="text-zinc-600 cursor-not-allowed"><SkipBack className="w-4 h-4" /></button>
              <button
                disabled
                className="w-9 h-9 rounded-full bg-zinc-800 text-zinc-500 flex items-center justify-center cursor-not-allowed"
              >
                <Play className="w-4 h-4 fill-current ml-0.5" />
              </button>
              <button disabled className="text-zinc-600 cursor-not-allowed"><SkipForward className="w-4 h-4" /></button>
            </div>

            {/* Volume Slider */}
            <div className="flex items-center gap-2 text-zinc-500 pt-1">
              <VolumeX className="w-3 h-3" />
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={miniVolume}
                onChange={(e) => setMiniVolume(parseFloat(e.target.value))}
                className="w-full h-1 accent-white cursor-pointer"
              />
              <Volume2 className="w-3 h-3" />
            </div>

            {/* Dark Mode Toggle */}
            <div className="pt-2 border-t border-white/5 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 text-zinc-400">
                <Moon className="w-3.5 h-3.5" />
                <span className="font-semibold text-[11px]">Dark Mode</span>
              </div>
              <button
                onClick={() => setDarkModeActive(!darkModeActive)}
                className={`w-9 h-5 rounded-full p-0.5 transition-all cursor-pointer ${darkModeActive ? 'bg-[#00F0FF]' : 'bg-zinc-700'}`}
              >
                <div className={`w-4 h-4 rounded-full bg-black transition-all ${darkModeActive ? 'translate-x-4' : 'translate-x-0'}`} />
              </button>
            </div>
          </GlassCard>
        </aside>

        {/* 2. CENTER HERO STAGE & TEMPLATES (Col span 6) */}
        <main className="lg:col-span-6 flex flex-col gap-6">
          
          {/* HERO SECTION CONTAINER */}
          <GlassCard className="p-8 relative overflow-hidden min-h-[440px] flex flex-col justify-between" glow={true}>
            
            {/* Ambient Background Particles */}
            <div className="absolute inset-0 pointer-events-none opacity-20">
              <div className="w-full h-full bg-[radial-gradient(#00F0FF_1px,transparent_1px)] [background-size:20px_20px]" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center z-10">
              
              {/* Left Hero Headlines */}
              <div className="md:col-span-7 space-y-4 text-left">
                <div className="inline-block px-3 py-1 bg-[#0A142D] border border-[#00F0FF]/40 rounded-full text-[9px] font-mono-tech font-extrabold text-[#00F0FF] uppercase tracking-wider shadow-[0_0_12px_rgba(0,240,255,0.2)]">
                  SYNCHRONIZED MUSIC PLATFORM
                </div>

                <div className="space-y-1">
                  <h1 className="text-5xl font-display font-black text-white leading-none">
                    Listen
                  </h1>
                  <h1 className="text-5xl font-display font-black text-transparent bg-clip-text bg-gradient-to-r from-[#00F0FF] to-[#0072FF] leading-none">
                    Together.
                  </h1>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xl font-display font-extrabold text-[#00F0FF]">Zero Latency.</span>
                  <div className="flex items-center gap-1">
                    <span className="w-1 h-3 bg-[#00F0FF] rounded-full animate-bounce" />
                    <span className="w-1 h-5 bg-[#00F0FF] rounded-full animate-bounce [animation-delay:0.15s]" />
                    <span className="w-1 h-2 bg-[#00F0FF] rounded-full animate-bounce [animation-delay:0.3s]" />
                  </div>
                </div>

                <p className="text-zinc-300 text-xs leading-relaxed max-w-sm">
                  Create private music rooms in seconds. Share audio tracks, invite friends, and enjoy continuous frame-rate clock synchronization across all browser tabs.
                </p>

                <div className="flex flex-wrap gap-3 pt-2">
                  <button
                    onClick={() => { setErrorMessage(''); setActiveModal('create'); }}
                    className="btn-theme-primary px-5 py-3 text-xs font-extrabold rounded-xl flex items-center gap-2 cursor-pointer"
                  >
                    Launch Room Space
                    <ArrowRight className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => { setErrorMessage(''); setActiveModal('join'); }}
                    className="btn-theme-outline px-5 py-3 text-xs font-bold rounded-xl flex items-center gap-2 cursor-pointer"
                  >
                    <Compass className="w-4 h-4 text-[#00F0FF]" />
                    Enter Room Code
                  </button>
                </div>

                {/* REAL PLATFORM ROOMS COUNTER */}
                <div className="flex items-center gap-3 pt-3">
                  <div className="p-2 bg-[#0A142D] border border-white/10 rounded-xl flex items-center gap-2 text-xs font-mono-tech">
                    <Radio className="w-4 h-4 text-[#00F0FF] animate-pulse" />
                    <span className="font-extrabold text-white">{platformStats?.totalRoomsCreated ?? 0}</span>
                    <span className="text-zinc-400 text-[11px]">Rooms Created</span>
                  </div>
                </div>
              </div>

              {/* Right Theme-Reactive Audio Equalizer Centerpiece */}
              <div className="md:col-span-5 flex items-center justify-center">
                <EqualizerHero className="w-64 h-64 md:w-80 md:h-80" accentColor={activeTheme.accent} />
              </div>

            </div>
          </GlassCard>

          {/* FEATURED TEMPLATES CAROUSEL SECTION */}
          <GlassCard className="p-6 space-y-4">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#00F0FF]" />
                <h3 className="font-display font-extrabold text-sm text-white">Featured Room Presets</h3>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {templates.map((tpl) => (
                <div
                  key={tpl.id}
                  onClick={() => {
                    setRoomName(tpl.title);
                    setMaxParticipants(tpl.max);
                    setErrorMessage('');
                    setActiveModal('create');
                  }}
                  className="group relative rounded-xl overflow-hidden bg-[#0A142D]/80 border border-white/10 hover:border-[#00F0FF]/50 transition-all cursor-pointer"
                >
                  <div className="relative h-28 w-full overflow-hidden">
                    <img src={tpl.img} alt={tpl.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                    <button className="absolute bottom-2 right-2 w-7 h-7 rounded-full bg-[#00F0FF] text-black flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg">
                      <Play className="w-3.5 h-3.5 fill-black ml-0.5" />
                    </button>
                  </div>
                  <div className="p-2.5 space-y-1">
                    <h4 className="font-bold text-xs text-white truncate">{tpl.title}</h4>
                    <p className="text-[10px] text-zinc-400 truncate">{tpl.desc}</p>
                    <div className="flex items-center justify-between pt-1 text-[9px] text-zinc-500 font-mono-tech">
                      <span className="flex items-center gap-1"><Users className="w-3 h-3 text-[#00F0FF]" /> Max {tpl.max}</span>
                      <button className="w-5 h-5 rounded-full bg-white/10 hover:bg-[#00F0FF] hover:text-black flex items-center justify-center transition-all">
                        <Plus className="w-3 h-3 fill-current" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </GlassCard>
        </main>

        {/* 3. RIGHT SIDEBAR PROFILE & REAL SOCIAL PANEL (Col span 4) */}
        <aside className="lg:col-span-4 flex flex-col gap-6">
          
          {/* PROFILE CARD WITH REAL STATS & 3D CITYDOME GRAPHIC */}
          <GlassCard className="p-6 relative overflow-hidden" glow={true}>
            <div className="grid grid-cols-12 gap-3 items-start">
              
              <div className="col-span-7 space-y-3">
                <div className="flex gap-3 items-center">
                  <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center text-lg font-black text-black select-none shrink-0"
                    style={{ backgroundColor: (session?.user as any)?.avatar || activeTheme.accent }}
                  >
                    {(session?.user as any)?.username?.charAt(0).toUpperCase() || 'G'}
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-extrabold text-sm text-white truncate">
                      {(session?.user as any)?.username || 'Guest User'}
                    </h3>
                    <p className="text-zinc-400 text-[10px] truncate">
                      {(session?.user as any)?.email || 'Sign in to sync account'}
                    </p>
                  </div>
                </div>

                {/* Editable Status Line */}
                <div className="flex items-center gap-2 text-xs text-zinc-300 italic">
                  {isEditingStatus ? (
                    <input
                      type="text"
                      value={statusText}
                      onChange={(e) => setStatusText(e.target.value)}
                      onBlur={() => setIsEditingStatus(false)}
                      autoFocus
                      className="bg-black/60 px-2 py-0.5 rounded border border-[#00F0FF] text-white text-xs"
                    />
                  ) : (
                    <span onClick={() => setIsEditingStatus(true)} className="cursor-pointer line-clamp-1">
                      "{statusText}"
                    </span>
                  )}
                  <Edit2 className="w-3 h-3 text-[#00F0FF] shrink-0 cursor-pointer" onClick={() => setIsEditingStatus(true)} />
                </div>
              </div>

              {/* 3D Floating Glass Cityscape Dome Graphic */}
              <div className="col-span-5 flex justify-end items-center">
                <CityDome3D className="w-36 h-36" accentColor={activeTheme.accent} />
              </div>

            </div>

            {/* REAL USER STATS ROW (WITH LOADING SKELETONS & ZERO STATES) */}
            <div className="grid grid-cols-3 gap-2 mt-4 border-t border-white/10 pt-3 text-center">
              <div className="bg-[#0A142D]/80 p-2 rounded-xl border border-white/5">
                {dataLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin text-[#00F0FF] mx-auto my-1" />
                ) : (
                  <span className="block text-base font-mono-tech font-black text-[#00F0FF]">
                    {stats?.totalMinutes ?? 0}
                  </span>
                )}
                <span className="text-[9px] uppercase font-bold text-zinc-500 tracking-wider">Mins Heard</span>
              </div>

              <div className="bg-[#0A142D]/80 p-2 rounded-xl border border-white/5">
                {dataLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin text-[#00F0FF] mx-auto my-1" />
                ) : (
                  <span className="block text-[10px] font-extrabold text-white truncate mt-0.5">
                    {stats?.topTrack || 'No songs played'}
                  </span>
                )}
                <span className="text-[9px] uppercase font-bold text-zinc-500 tracking-wider">Top Song 🎵</span>
              </div>

              <div className="bg-[#0A142D]/80 p-2 rounded-xl border border-white/5">
                {dataLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin text-[#00F0FF] mx-auto my-1" />
                ) : (
                  <span className="block text-[10px] font-extrabold text-[#00F0FF] truncate mt-0.5">
                    {stats?.favoriteRoom || 'No rooms yet'}
                  </span>
                )}
                <span className="text-[9px] uppercase font-bold text-zinc-500 tracking-wider">Top Room 👥</span>
              </div>
            </div>

            <button
              onClick={() => {
                if (!session) {
                  setAuthMode('login');
                  setActiveModal('auth');
                } else {
                  setShowProfileModal(true);
                }
              }}
              className="w-full mt-3 py-2 border border-[#00F0FF]/30 hover:border-[#00F0FF] text-[#00F0FF] rounded-xl text-xs font-extrabold transition-all cursor-pointer flex justify-center items-center gap-1.5"
            >
              {session ? 'Edit Profile Details' : 'Sign In / Register'} <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </GlassCard>

          {/* REAL FRIENDS NETWORK CARD (EMPTY STATE & REAL API WIRING) */}
          <GlassCard className="p-5 flex flex-col">
            <div className="flex justify-between items-center mb-3">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-[#00F0FF]" />
                <h3 className="font-display font-extrabold text-xs text-white">Friends Network</h3>
                {friends.length > 0 && <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />}
              </div>
            </div>

            <form onSubmit={handleAddFriend} className="flex gap-2 mb-3">
              <input
                type="text"
                required
                value={friendSearch}
                onChange={(e) => setFriendSearch(e.target.value)}
                placeholder="Find friends by username..."
                className="flex-grow px-3 py-1.5 bg-[#0A142D] border border-white/10 rounded-xl outline-none text-white text-xs font-mono-tech"
              />
              <button
                type="submit"
                className="px-3.5 bg-[#00F0FF] text-black font-extrabold rounded-xl text-xs hover:bg-[#0072FF] hover:text-white transition-all cursor-pointer"
              >
                Add
              </button>
            </form>

            {friendError && <p className="text-[10px] text-red-400 mb-1">{friendError}</p>}
            {friendSuccess && <p className="text-[10px] text-green-400 mb-1">{friendSuccess}</p>}

            {/* REAL FRIENDS LIST / EMPTY STATE */}
            {dataLoading ? (
              <div className="py-4 text-center">
                <Loader2 className="w-5 h-5 animate-spin text-[#00F0FF] mx-auto" />
              </div>
            ) : friends.length === 0 ? (
              <div className="p-4 bg-[#0A142D]/40 border border-white/5 rounded-xl text-center space-y-1">
                <Inbox className="w-6 h-6 text-zinc-500 mx-auto mb-1" />
                <p className="text-xs font-bold text-zinc-300">No friends connected yet</p>
                <p className="text-[10px] text-zinc-500 font-mono-tech">Search above to add friends to your network.</p>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1 scrollbar-none">
                {friends.map((f) => (
                  <div key={f.id} className="flex flex-col items-center shrink-0 space-y-1 group cursor-pointer">
                    <div className="relative">
                      <div className="w-10 h-10 rounded-full bg-[#0A142D] border border-[#00F0FF]/40 flex items-center justify-center text-xs font-black text-[#00F0FF]">
                        {f.friendName?.charAt(0).toUpperCase() || 'F'}
                      </div>
                      <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-[#060B19] ${f.status === 'accepted' ? 'bg-green-400' : 'bg-amber-400'}`} />
                    </div>
                    <span className="text-[10px] font-bold text-white truncate max-w-[56px]">@{f.friendName}</span>
                    <span className="text-[8px] font-mono-tech text-zinc-400">{f.status}</span>
                  </div>
                ))}
              </div>
            )}
          </GlassCard>

          {/* REAL RECENT ROOMS CARD (EMPTY STATE & REAL API WIRING) */}
          <GlassCard className="p-5 flex flex-col space-y-3">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Radio className="w-4 h-4 text-[#00F0FF]" />
                <h3 className="font-display font-extrabold text-xs text-white">Recent Rooms</h3>
              </div>
            </div>

            {dataLoading ? (
              <div className="py-4 text-center">
                <Loader2 className="w-5 h-5 animate-spin text-[#00F0FF] mx-auto" />
              </div>
            ) : (!stats?.roomHistory || stats.roomHistory.length === 0) ? (
              <div className="p-4 bg-[#0A142D]/40 border border-white/5 rounded-xl text-center space-y-1">
                <Radio className="w-6 h-6 text-zinc-500 mx-auto mb-1" />
                <p className="text-xs font-bold text-zinc-300">No recent room spaces</p>
                <p className="text-[10px] text-zinc-500 font-mono-tech">Create or join a room space to get started!</p>
              </div>
            ) : (
              <div className="space-y-2">
                {stats.roomHistory.map((rm) => {
                  const curUser = ((session?.user as any)?.username || username || 'Guest').trim();
                  const isHostOfRoom = (rm.hostUsername || rm.username || '').toLowerCase() === curUser.toLowerCase();

                  return (
                    <div
                      key={rm.roomId}
                      onClick={() => router.push(`/room/${rm.roomId}?username=${curUser}`)}
                      className="flex items-center justify-between p-2.5 bg-[#0A142D]/80 hover:bg-[#0A142D] rounded-xl border border-white/5 hover:border-[#00F0FF]/40 transition-all cursor-pointer group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-lg bg-[#00F0FF]/10 border border-[#00F0FF]/30 flex items-center justify-center shrink-0">
                          <Radio className="w-4 h-4 text-[#00F0FF]" />
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-extrabold text-xs text-white truncate group-hover:text-[#00F0FF]">{rm.roomName}</h4>
                          <p className="text-[9px] text-zinc-400 font-mono-tech uppercase">{rm.roomId}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {isHostOfRoom && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setRoomToDelete({ roomId: rm.roomId, roomName: rm.roomName });
                            }}
                            title="Delete Room"
                            className="p-1.5 rounded-lg text-zinc-400 hover:text-red-400 hover:bg-red-500/10 transition-all cursor-pointer opacity-80 hover:opacity-100"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button className="w-7 h-7 rounded-full bg-[#00F0FF] text-black flex items-center justify-center shadow-md hover:scale-105 transition-all cursor-pointer">
                          <Play className="w-3 h-3 fill-black ml-0.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </GlassCard>

        </aside>

      </div>

      {/* BOTTOM FEATURE CALLOUT STRIP */}
      <section className="relative z-10 max-w-[1600px] mx-auto w-full px-6 py-6 border-t border-white/10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          
          <div className="p-3 bg-[#0A142D]/40 border border-white/5 rounded-xl flex items-center gap-3">
            <div className="p-2 bg-[#00F0FF]/10 rounded-lg shrink-0"><Zap className="w-4 h-4 text-[#00F0FF]" /></div>
            <div className="text-left">
              <h4 className="font-extrabold text-xs text-white">Perfect Sync</h4>
              <p className="text-[10px] text-zinc-400">Across all devices</p>
            </div>
          </div>

          <div className="p-3 bg-[#0A142D]/40 border border-white/5 rounded-xl flex items-center gap-3">
            <div className="p-2 bg-[#00F0FF]/10 rounded-lg shrink-0"><Music className="w-4 h-4 text-[#00F0FF]" /></div>
            <div className="text-left">
              <h4 className="font-extrabold text-xs text-white">High Quality</h4>
              <p className="text-[10px] text-zinc-400">Crystal clear audio</p>
            </div>
          </div>

          <div className="p-3 bg-[#0A142D]/40 border border-white/5 rounded-xl flex items-center gap-3">
            <div className="p-2 bg-[#00F0FF]/10 rounded-lg shrink-0"><Lock className="w-4 h-4 text-[#00F0FF]" /></div>
            <div className="text-left">
              <h4 className="font-extrabold text-xs text-white">Private Rooms</h4>
              <p className="text-[10px] text-zinc-400">Secure & encrypted</p>
            </div>
          </div>

          <div className="p-3 bg-[#0A142D]/40 border border-white/5 rounded-xl flex items-center gap-3">
            <div className="p-2 bg-[#00F0FF]/10 rounded-lg shrink-0"><MessageSquare className="w-4 h-4 text-[#00F0FF]" /></div>
            <div className="text-left">
              <h4 className="font-extrabold text-xs text-white">Real-time Chat</h4>
              <p className="text-[10px] text-zinc-400">Talk while listening</p>
            </div>
          </div>

        </div>
      </section>

      {/* AMBIENT BOTTOM WAVEFORM LINE ART */}
      <div className="bottom-waveform-line" />

      {/* MODAL DIALOG OVERLAYS */}
      <AnimatePresence>
        {activeModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-md"
            >
              <GlassCard className="p-7 relative border-[#00F0FF]/40" glow={true}>
                <button onClick={() => setActiveModal(null)} className="absolute top-5 right-5 text-zinc-400 hover:text-white text-base cursor-pointer">&times;</button>

                {/* Auth Modal */}
                {activeModal === 'auth' && (
                  <form onSubmit={handleAuthSubmit} className="space-y-4">
                    <div>
                      <h2 className="text-xl font-display font-black text-white">{authMode === 'login' ? 'Welcome Back' : 'Create Identity'}</h2>
                      <p className="text-zinc-400 text-xs mt-0.5">{authMode === 'login' ? 'Sign in with credentials' : 'Register a new user account'}</p>
                    </div>

                    {errorMessage && <div className="p-3 text-xs bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl font-mono-tech">{errorMessage}</div>}

                    <div className="space-y-3">
                      <div>
                        <label className="block text-[10px] font-mono-tech font-bold text-zinc-400 uppercase tracking-wider mb-1.5">Email Address</label>
                        <input
                          type="email"
                          required
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="name@domain.com"
                          className="w-full px-3 py-2 bg-[#0A142D] border border-white/10 rounded-xl outline-none text-white text-xs font-mono-tech"
                        />
                      </div>

                      {authMode === 'register' && (
                        <>
                          <div>
                            <label className="block text-[10px] font-mono-tech font-bold text-zinc-400 uppercase tracking-wider mb-1.5">Display Username</label>
                            <input
                              type="text"
                              required
                              value={authUsername}
                              onChange={(e) => setAuthUsername(e.target.value)}
                              placeholder="e.g. ankit"
                              className="w-full px-3 py-2 bg-[#0A142D] border border-white/10 rounded-xl outline-none text-white text-xs"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] font-mono-tech font-bold text-zinc-400 uppercase tracking-wider mb-1.5">Avatar Color</label>
                            <div className="flex gap-2">
                              {AVATAR_PRESETS.map((color) => (
                                <div
                                  key={color}
                                  onClick={() => setAuthAvatar(color)}
                                  className={`w-6 h-6 rounded-full cursor-pointer border-2 transition-all ${authAvatar === color ? 'border-white scale-110 shadow-md' : 'border-transparent opacity-60'}`}
                                  style={{ backgroundColor: color }}
                                />
                              ))}
                            </div>
                          </div>
                        </>
                      )}

                      <div>
                        <label className="block text-[10px] font-mono-tech font-bold text-zinc-400 uppercase tracking-wider mb-1.5">Password</label>
                        <input
                          type="password"
                          required
                          value={authPassword}
                          onChange={(e) => setAuthPassword(e.target.value)}
                          placeholder="••••••••"
                          className="w-full px-3 py-2 bg-[#0A142D] border border-white/10 rounded-xl outline-none text-white text-xs font-mono-tech"
                        />
                      </div>
                    </div>

                    <button type="submit" disabled={loading} className="btn-theme-primary w-full py-3 text-xs font-extrabold rounded-xl cursor-pointer">
                      {loading ? 'Authenticating...' : authMode === 'login' ? 'Sign In' : 'Register Account'}
                    </button>

                    <p className="text-center text-xs text-zinc-400 mt-2">
                      {authMode === 'login' ? "Don't have an account? " : 'Already registered? '}
                      <span onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')} className="text-white font-bold hover:underline cursor-pointer">
                        {authMode === 'login' ? 'Register' : 'Sign In'}
                      </span>
                    </p>
                  </form>
                )}

                {/* Create Room Modal */}
                {activeModal === 'create' && (
                  <form onSubmit={handleCreateRoom} className="space-y-4">
                    <div>
                      <h2 className="text-xl font-display font-black text-white">Create Room Space</h2>
                      <p className="text-zinc-400 text-xs mt-0.5">Configure synchronized room settings</p>
                    </div>

                    {errorMessage && <div className="p-3 text-xs bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl font-mono-tech">{errorMessage}</div>}

                    <div className="space-y-3">
                      <div>
                        <label className="block text-[10px] font-mono-tech font-bold text-zinc-400 uppercase tracking-wider mb-1.5">Room Name</label>
                        <input
                          type="text"
                          value={roomName}
                          onChange={(e) => setRoomName(e.target.value)}
                          placeholder="e.g. Apna Adda"
                          className="w-full px-3 py-2 bg-[#0A142D] border border-white/10 rounded-xl outline-none text-white text-xs"
                        />
                      </div>

                      <div className="flex gap-3">
                        <div className="w-1/2">
                          <label className="block text-[10px] font-mono-tech font-bold text-zinc-400 uppercase tracking-wider mb-1.5">Max Listeners ({maxParticipants})</label>
                          <input
                            type="range"
                            min="2"
                            max="20"
                            value={maxParticipants}
                            onChange={(e) => setMaxParticipants(parseInt(e.target.value))}
                            className="w-full cursor-pointer accent-[#00F0FF]"
                          />
                        </div>

                        <div className="w-1/2 flex flex-col justify-end">
                          <div className="flex items-center gap-2 justify-between bg-[#0A142D] px-3 py-2 rounded-xl border border-white/10">
                            <span className="text-[10px] font-mono-tech font-bold text-zinc-400 uppercase tracking-wider">Collaborative</span>
                            <input
                              type="checkbox"
                              checked={collaborativeMode}
                              onChange={(e) => setCollaborativeMode(e.target.checked)}
                              className="w-3.5 h-3.5 rounded text-[#00F0FF] bg-[#0A142D] border-white/10 cursor-pointer"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="bg-[#0A142D] p-3 rounded-xl border border-white/10 space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
                            {isPrivate ? <Lock className="w-3.5 h-3.5 text-pink-400" /> : <Unlock className="w-3.5 h-3.5 text-green-400" />}
                            Private Room Password
                          </span>
                          <input
                            type="checkbox"
                            checked={isPrivate}
                            onChange={(e) => setIsPrivate(e.target.checked)}
                            className="w-3.5 h-3.5 rounded text-[#00F0FF] bg-[#0A142D] border-white/10 cursor-pointer"
                          />
                        </div>

                        {isPrivate && (
                          <input
                            type="password"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Room password"
                            className="w-full px-3 py-2 bg-black border border-white/10 rounded-xl outline-none text-white text-xs font-mono-tech"
                          />
                        )}
                      </div>
                    </div>

                    <button type="submit" disabled={loading} className="btn-theme-primary w-full py-3 text-xs font-extrabold rounded-xl cursor-pointer">
                      Launch Room Space
                    </button>
                  </form>
                )}

                {/* Join Room Modal */}
                {activeModal === 'join' && (
                  <form onSubmit={handleJoinRoom} className="space-y-4">
                    <div>
                      <h2 className="text-xl font-display font-black text-white">Join Space</h2>
                      <p className="text-zinc-400 text-xs mt-0.5">Enter room code credentials</p>
                    </div>

                    {errorMessage && <div className="p-3 text-xs bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl font-mono-tech">{errorMessage}</div>}

                    <div className="space-y-3">
                      <div>
                        <label className="block text-[10px] font-mono-tech font-bold text-zinc-400 uppercase tracking-wider mb-1.5">Room Code</label>
                        <input
                          type="text"
                          required
                          maxLength={6}
                          value={roomCode}
                          onChange={(e) => setRoomCode(e.target.value)}
                          placeholder="e.g. MBKY93"
                          className="w-full px-3 py-2 bg-[#0A142D] border border-white/10 rounded-xl outline-none text-white text-xs font-mono-tech tracking-widest text-center uppercase"
                        />
                      </div>

                      <div className="bg-[#0A142D] p-3 rounded-xl border border-white/10 space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-bold text-zinc-300">Room Password?</span>
                          <input
                            type="checkbox"
                            checked={isPrivate}
                            onChange={(e) => setIsPrivate(e.target.checked)}
                            className="w-3.5 h-3.5 rounded text-[#00F0FF] bg-[#0A142D] border-white/10 cursor-pointer"
                          />
                        </div>

                        {isPrivate && (
                          <input
                            type="password"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Enter password"
                            className="w-full px-3 py-2 bg-black border border-white/10 rounded-xl outline-none text-white text-xs font-mono-tech"
                          />
                        )}
                      </div>
                    </div>

                    <button type="submit" className="btn-theme-primary w-full py-3 text-xs font-extrabold rounded-xl cursor-pointer">
                      Connect Stream
                    </button>
                  </form>
                )}
              </GlassCard>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* EDIT PROFILE DRAWER MODAL */}
      <AnimatePresence>
        {showProfileModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="w-full max-w-md">
              <GlassCard className="p-7 relative border-white/10" glow={true}>
                <button onClick={() => setShowProfileModal(false)} className="absolute top-5 right-5 text-zinc-400 hover:text-white text-base cursor-pointer">&times;</button>
                <form onSubmit={handleProfileUpdate} className="space-y-4">
                  <h2 className="text-lg font-display font-black text-white">Edit Profile Details</h2>

                  <div className="space-y-3 text-xs">
                    <div>
                      <label className="block text-[10px] font-mono-tech font-bold text-zinc-400 uppercase tracking-wider mb-1.5">Display Username</label>
                      <input
                        type="text"
                        required
                        value={editUsername}
                        onChange={(e) => setEditUsername(e.target.value)}
                        className="w-full px-3 py-2 bg-[#0A142D] border border-white/10 rounded-xl outline-none text-white font-bold"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-mono-tech font-bold text-zinc-400 uppercase tracking-wider mb-1.5">Avatar Color</label>
                      <div className="flex gap-2">
                        {AVATAR_PRESETS.map((color) => (
                          <div
                            key={color}
                            onClick={() => setEditAvatar(color)}
                            className={`w-6 h-6 rounded-full cursor-pointer border-2 transition-all ${editAvatar === color ? 'border-white scale-110 shadow-md' : 'border-transparent opacity-50'}`}
                            style={{ backgroundColor: color }}
                          />
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-mono-tech font-bold text-zinc-400 uppercase tracking-wider mb-1.5">Status Line</label>
                      <input
                        type="text"
                        value={statusText}
                        onChange={(e) => setStatusText(e.target.value)}
                        className="w-full px-3 py-2 bg-[#0A142D] border border-white/10 rounded-xl outline-none text-white text-xs"
                      />
                    </div>
                  </div>

                  <button type="submit" disabled={loading} className="btn-theme-primary w-full py-2.5 text-xs font-extrabold rounded-xl cursor-pointer">
                    Save Changes
                  </button>
                </form>
              </GlassCard>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* DELETE ROOM CONFIRMATION MODAL */}
      {roomToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="w-full max-w-md bg-[#0A142D] border border-white/10 rounded-3xl p-6 shadow-2xl space-y-4 relative">
            <button
              onClick={() => { setRoomToDelete(null); setDeleteError(''); }}
              className="absolute top-5 right-5 text-zinc-400 hover:text-white text-lg font-bold cursor-pointer"
            >
              &times;
            </button>
            <div className="flex items-center gap-3 text-red-400">
              <div className="p-2.5 bg-red-500/10 border border-red-500/30 rounded-2xl shrink-0">
                <Trash2 className="w-6 h-6 text-red-400" />
              </div>
              <div>
                <h3 className="text-base font-display font-extrabold text-white">Delete "{roomToDelete.roomName}"?</h3>
                <p className="text-zinc-400 text-[10px] font-mono-tech uppercase">Code: {roomToDelete.roomId}</p>
              </div>
            </div>

            <p className="text-xs text-zinc-300 leading-relaxed">
              This will permanently remove the room space, queue history, and chat logs. Active participants will be disconnected. This action cannot be undone.
            </p>

            {deleteError && <p className="text-xs text-red-400 font-mono-tech">{deleteError}</p>}

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => { setRoomToDelete(null); setDeleteError(''); }}
                className="px-4 py-2 bg-white/5 hover:bg-white/10 text-zinc-300 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDeleteRoom}
                disabled={deletingRoom}
                className="px-5 py-2 bg-red-500 hover:bg-red-600 text-white rounded-xl text-xs font-extrabold shadow-lg transition-all cursor-pointer flex items-center gap-1.5"
              >
                {deletingRoom ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  'Delete Room'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
