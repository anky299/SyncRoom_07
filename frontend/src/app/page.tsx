'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession, signIn, signOut } from 'next-auth/react';
import {
  Search,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Shuffle,
  Repeat,
  Heart,
  Zap,
  Monitor,
  Lock,
  Unlock,
  UserPlus,
  Music,
  Users,
  Radio,
  Plus,
  Edit2,
  Trash2,
  Loader2,
  Inbox,
  ArrowRight,
  Menu,
  X,
  Copy,
  Share2,
  Check,
  Sliders,
  Settings,
  LogOut,
  User,
  Volume2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { MOCK_TRACKS, MOCK_ROOMS, MockTrack, MockRoom } from '@/lib/mockData';
import { useToast } from '@/components/ToastContext';
import { SearchModal } from '@/components/SearchModal';
import { safeFetchJson } from '@/lib/api';
import { io } from 'socket.io-client';
import { getBackendUrl } from '@/lib/config';

const AVATAR_PRESETS = ['#00F0FF', '#00FF9D', '#FF5E7E', '#39FF14', '#A855F7', '#FF9F43'];

function SyncRoomHeroContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, update: updateSession } = useSession();
  const { showToast } = useToast();

  // Navigation tab & Modals
  const [activeNavTab, setActiveNavTab] = useState<'home' | 'rooms' | 'library' | 'about'>('home');
  const [activeModal, setActiveModal] = useState<'create' | 'join' | 'auth' | 'settings' | 'created_success' | null>(null);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  // Check URL query on mount for actions
  useEffect(() => {
    const action = searchParams.get('action');
    if (action === 'create') setActiveModal('create');
    if (action === 'join') setActiveModal('join');
  }, [searchParams]);

  // Click outside to close profile dropdown
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsProfileDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // =========================================================================
  // MUSIC PLAYER INTERACTIVE FRONTEND STATE (Multi-track Queue & Real Progress)
  // =========================================================================
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const currentTrack = MOCK_TRACKS[currentTrackIndex] || MOCK_TRACKS[0];
  const [isPlayerPlaying, setIsPlayerPlaying] = useState(false);
  const [playerCurrentSeconds, setPlayerCurrentSeconds] = useState(56);
  const [isPlayerLiked, setIsPlayerLiked] = useState(currentTrack.isLiked || false);
  const [isShuffle, setIsShuffle] = useState(false);
  const [isRepeat, setIsRepeat] = useState(false);

  // Synchronize like state with current track
  useEffect(() => {
    setIsPlayerLiked(currentTrack.isLiked || false);
  }, [currentTrackIndex]);

  // Playback timer simulation
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isPlayerPlaying) {
      interval = setInterval(() => {
        setPlayerCurrentSeconds((prev) => {
          if (prev >= currentTrack.duration) {
            if (isRepeat) return 0;
            handleNextTrack();
            return 0;
          }
          return prev + 1;
        });
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isPlayerPlaying, currentTrackIndex, isRepeat]);

  const handleNextTrack = () => {
    if (isShuffle) {
      const nextIdx = Math.floor(Math.random() * MOCK_TRACKS.length);
      setCurrentTrackIndex(nextIdx);
    } else {
      setCurrentTrackIndex((prev) => (prev + 1) % MOCK_TRACKS.length);
    }
    setPlayerCurrentSeconds(0);
    showToast(`Next track: ${MOCK_TRACKS[(currentTrackIndex + 1) % MOCK_TRACKS.length].title}`);
  };

  const handlePrevTrack = () => {
    if (playerCurrentSeconds > 3) {
      setPlayerCurrentSeconds(0);
    } else {
      setCurrentTrackIndex((prev) => (prev - 1 + MOCK_TRACKS.length) % MOCK_TRACKS.length);
      setPlayerCurrentSeconds(0);
    }
  };

  const handleProgressBarClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, clickX / rect.width));
    const newSeconds = Math.round(percentage * currentTrack.duration);
    setPlayerCurrentSeconds(newSeconds);
  };

  const formatTime = (totalSecs: number) => {
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // =========================================================================
  // ROOM CREATION & JOINING FRONTEND STATE
  // =========================================================================
  const [createdRoomData, setCreatedRoomData] = useState<{
    name: string;
    code: string;
    description: string;
    isPrivate: boolean;
  } | null>(null);

  const [createRoomName, setCreateRoomName] = useState('');
  const [createDescription, setCreateDescription] = useState('');
  const [createIsPrivate, setCreateIsPrivate] = useState(false);
  const [createPassword, setCreatePassword] = useState('');
  const [maxParticipants, setMaxParticipants] = useState(10);
  const [collaborativeMode, setCollaborativeMode] = useState(true);
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);

  const [joinRoomCode, setJoinRoomCode] = useState('');
  const [joinPassword, setJoinPassword] = useState('');
  const [isJoiningLoading, setIsJoiningLoading] = useState(false);
  const [joinErrorMessage, setJoinErrorMessage] = useState('');

  // App Settings State
  const [appAudioQuality, setAppAudioQuality] = useState('lossless');
  const [appLowLatency, setAppLowLatency] = useState(true);
  const [appMasterVolume, setAppMasterVolume] = useState(0.85);

  // Authentication & Profile states
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authUsername, setAuthUsername] = useState('');
  const [authAvatar, setAuthAvatar] = useState('#00F0FF');
  const [authLoading, setAuthLoading] = useState(false);
  const [authErrorMessage, setAuthErrorMessage] = useState('');

  const [showProfileModal, setShowProfileModal] = useState(false);
  const [editUsername, setEditUsername] = useState('');
  const [editAvatar, setEditAvatar] = useState('#00F0FF');
  const [statusText, setStatusText] = useState('Good music sounds better together.');
  const [isEditingStatus, setIsEditingStatus] = useState(false);

  // User Stats & Friends list
  const [friendsList, setFriendsList] = useState([
    { id: 'f1', name: 'ElenaVibes', isOnline: true },
    { id: 'f2', name: 'KaiSynth', isOnline: true },
    { id: 'f3', name: 'DJMaya', isOnline: false },
  ]);
  const [friendSearchInput, setFriendSearchInput] = useState('');

  const currentDisplayName = (session?.user as any)?.username || authUsername || 'Guest';

  // =========================================================================
  // ACTIONS & HANDLERS
  // =========================================================================

  const handleCreateRoomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isCreatingRoom) return;

    const finalName = createRoomName.trim() || `${currentDisplayName}'s Space`;
    setIsCreatingRoom(true);

    const backendUrl = getBackendUrl();
    const tempSocket = io(backendUrl, {
      timeout: 8000,
      reconnection: false,
    });

    let isHandled = false;

    const cleanUpAndFinish = () => {
      if (!isHandled) {
        isHandled = true;
        setIsCreatingRoom(false);
        tempSocket.disconnect();
      }
    };

    const timeout = setTimeout(() => {
      if (!isHandled) {
        showToast('Connection to server timed out. Please try again.');
        cleanUpAndFinish();
      }
    }, 8000);

    tempSocket.on('connect', () => {
      tempSocket.emit(
        'room-create',
        {
          roomName: finalName,
          username: currentDisplayName,
          settings: {
            isPrivate: createIsPrivate,
            password: createIsPrivate ? createPassword.trim() : undefined,
            maxParticipants,
            collaborativeMode,
            enableChat: true,
            enableReactions: true,
            enableVoting: true,
            allowEveryoneToAddSongs: true,
            allowEveryoneToSkip: false,
            hostApprovalRequired: false,
            autoPickNext: true,
          },
        },
        (res: { success: boolean; room?: any; error?: string }) => {
          clearTimeout(timeout);
          if (res?.success && res.room && res.room.roomId) {
            const authoritativeRoom = res.room;
            const newRoom = {
              name: authoritativeRoom.roomName || finalName,
              code: authoritativeRoom.roomId,
              description: createDescription.trim() || 'Synchronized audio lounge space.',
              isPrivate: authoritativeRoom.settings?.isPrivate ?? createIsPrivate,
            };
            setCreatedRoomData(newRoom);
            setActiveModal('created_success');
            showToast(`Room "${newRoom.name}" created!`);
          } else {
            showToast(res?.error || 'Failed to create room on server.');
          }
          cleanUpAndFinish();
        }
      );
    });

    tempSocket.on('connect_error', () => {
      clearTimeout(timeout);
      showToast('Cannot connect to backend server. Make sure the backend is running.');
      cleanUpAndFinish();
    });
  };

  const handleJoinRoomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const formatted = joinRoomCode.trim().toUpperCase();
    if (!formatted) {
      setJoinErrorMessage('Please enter a valid 6-character room code.');
      return;
    }

    setJoinErrorMessage('');

    if (joinPassword && joinPassword.trim()) {
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('syncroom_join_password', joinPassword.trim());
      }
    }

    setActiveModal(null);
    showToast(`Joining room space ${formatted}...`);
    router.push(`/room/${formatted}?username=${encodeURIComponent(currentDisplayName)}`);
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    showToast('Room code copied to clipboard!');
  };

  const handleShareRoom = async (code: string, name: string) => {
    const shareUrl = `${window.location.origin}/room/${code}?username=Guest`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `SyncRoom: ${name}`,
          text: `Join my synchronized music room on SyncRoom!`,
          url: shareUrl,
        });
        showToast('Room shared successfully!');
        return;
      } catch (err) {
        // User cancelled or share failed, fallback to copy
      }
    }
    navigator.clipboard.writeText(shareUrl);
    showToast('Room invite link copied to clipboard!');
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthErrorMessage('');

    try {
      if (authMode === 'register') {
        await safeFetchJson('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: authEmail,
            password: authPassword,
            username: authUsername,
            avatar: authAvatar,
          }),
        });
      }

      const result = await signIn('credentials', {
        email: authEmail,
        password: authPassword,
        redirect: false,
      });

      if (result?.error) {
        throw new Error('Invalid email or password');
      }

      setActiveModal(null);
      showToast(`Welcome back, @${authUsername || 'musicLover'}!`);
    } catch (err: any) {
      setAuthErrorMessage(err.message || 'Authentication error');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleAddFriend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!friendSearchInput.trim()) return;
    const newFriendName = friendSearchInput.trim();
    setFriendsList((prev) => [
      ...prev,
      { id: `f-${Date.now()}`, name: newFriendName, isOnline: true },
    ]);
    showToast(`Friend request sent to @${newFriendName}`);
    setFriendSearchInput('');
  };

  return (
    <div className="min-h-screen bg-[#060814] text-white flex flex-col selection:bg-[#F5A623] selection:text-black">
      {/* =========================================================================
          1. TOP NAVIGATION OVERLAY (Transparent / Dark pill navbar)
         ========================================================================= */}
      <header className="absolute top-0 left-0 right-0 z-40 w-full px-6 md:px-12 py-6">
        <div className="max-w-[1440px] mx-auto flex items-center justify-between">
          {/* Left: Waveform Minimalist Logo */}
          <div
            onClick={() => {
              setActiveNavTab('home');
              router.push('/');
            }}
            className="flex items-center gap-3 cursor-pointer group"
          >
            <div className="flex items-center gap-[3px] h-6">
              <span className="w-[3px] h-3 bg-gradient-to-t from-[#8B5CF6] to-[#22D3EE] rounded-full group-hover:h-5 transition-all duration-300" />
              <span className="w-[3px] h-5 bg-gradient-to-t from-[#8B5CF6] to-[#22D3EE] rounded-full group-hover:h-6 transition-all duration-300" />
              <span className="w-[3px] h-6 bg-gradient-to-t from-[#8B5CF6] to-[#22D3EE] rounded-full group-hover:h-3 transition-all duration-300" />
              <span className="w-[3px] h-4 bg-gradient-to-t from-[#8B5CF6] to-[#22D3EE] rounded-full group-hover:h-5 transition-all duration-300" />
              <span className="w-[3px] h-2 bg-gradient-to-t from-[#8B5CF6] to-[#22D3EE] rounded-full group-hover:h-4 transition-all duration-300" />
            </div>
            <span className="text-xl md:text-2xl font-bold tracking-tight text-white font-sans">
              Syncroom
            </span>
          </div>

          {/* Center Navigation Links */}
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-zinc-300">
            <button
              onClick={() => {
                setActiveNavTab('home');
                router.push('/');
              }}
              className={`relative py-1 cursor-pointer transition-colors ${
                activeNavTab === 'home' ? 'text-white font-semibold' : 'text-zinc-400 hover:text-white'
              }`}
            >
              Home
              {activeNavTab === 'home' && (
                <span className="absolute -bottom-1 left-0 right-0 h-[2px] bg-gradient-to-r from-[#8B5CF6] to-[#A78BFA] rounded-full shadow-[0_0_8px_#8B5CF6]" />
              )}
            </button>

            <button
              onClick={() => {
                setActiveNavTab('rooms');
                router.push('/rooms');
              }}
              className={`relative py-1 cursor-pointer transition-colors ${
                activeNavTab === 'rooms' ? 'text-white font-semibold' : 'text-zinc-400 hover:text-white'
              }`}
            >
              Rooms
            </button>

            <button
              onClick={() => {
                setActiveNavTab('library');
                router.push('/library');
              }}
              className={`relative py-1 cursor-pointer transition-colors ${
                activeNavTab === 'library' ? 'text-white font-semibold' : 'text-zinc-400 hover:text-white'
              }`}
            >
              Library
            </button>

            <button
              onClick={() => {
                setActiveNavTab('about');
                router.push('/about');
              }}
              className={`relative py-1 cursor-pointer transition-colors ${
                activeNavTab === 'about' ? 'text-white font-semibold' : 'text-zinc-400 hover:text-white'
              }`}
            >
              About
            </button>
          </nav>

          {/* Right Controls: Search, Profile Dropdown, Join Room, Create Room */}
          <div className="flex items-center gap-3 md:gap-4">
            {/* Search Icon */}
            <button
              onClick={() => setIsSearchModalOpen(true)}
              className="p-2 text-zinc-300 hover:text-white hover:bg-white/5 rounded-full transition-colors cursor-pointer"
              title="Search rooms, tracks, users"
            >
              <Search className="w-4 h-4 md:w-5 md:h-5" />
            </button>

            {/* Profile / Avatar Dropdown Anchor */}
            <div className="relative" ref={dropdownRef}>
              <div
                onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
                title="Account Options"
                className="hidden sm:flex items-center gap-2 px-2.5 py-1.5 bg-black/40 hover:bg-black/60 border border-white/10 rounded-full cursor-pointer transition-all"
              >
                <div
                  className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black text-black select-none"
                  style={{ backgroundColor: (session?.user as any)?.avatar || authAvatar }}
                >
                  {currentDisplayName.charAt(0).toUpperCase()}
                </div>
                <span className="text-xs font-semibold text-zinc-200">
                  {currentDisplayName}
                </span>
              </div>

              {/* Profile Dropdown Menu */}
              <AnimatePresence>
                {isProfileDropdownOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute right-0 mt-2 w-56 bg-[#0E1428]/95 backdrop-blur-2xl border border-white/15 rounded-2xl p-2 shadow-2xl z-50 text-xs space-y-1"
                  >
                    <div className="px-3 py-2 border-b border-white/10 mb-1">
                      <p className="font-bold text-white truncate">@{currentDisplayName}</p>
                      <p className="text-[10px] text-zinc-400 truncate">
                        {(session?.user as any)?.email || 'Guest Session'}
                      </p>
                    </div>

                    <button
                      onClick={() => {
                        setIsProfileDropdownOpen(false);
                        setShowProfileModal(true);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-zinc-300 hover:text-white hover:bg-white/5 transition-colors cursor-pointer text-left"
                    >
                      <User className="w-3.5 h-3.5 text-[#8B5CF6]" />
                      <span>Edit Profile</span>
                    </button>

                    <button
                      onClick={() => {
                        setIsProfileDropdownOpen(false);
                        setActiveModal('settings');
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-zinc-300 hover:text-white hover:bg-white/5 transition-colors cursor-pointer text-left"
                    >
                      <Settings className="w-3.5 h-3.5 text-[#22D3EE]" />
                      <span>Sound Settings</span>
                    </button>

                    <div className="border-t border-white/10 pt-1">
                      {session ? (
                        <button
                          onClick={() => {
                            setIsProfileDropdownOpen(false);
                            signOut();
                            showToast('Signed out successfully');
                          }}
                          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer text-left"
                        >
                          <LogOut className="w-3.5 h-3.5" />
                          <span>Sign Out</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            setIsProfileDropdownOpen(false);
                            setActiveModal('auth');
                          }}
                          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[#FBBF24] hover:bg-[#FBBF24]/10 transition-colors cursor-pointer text-left font-bold"
                        >
                          <User className="w-3.5 h-3.5" />
                          <span>Sign In / Register</span>
                        </button>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Join Room Button */}
            <button
              onClick={() => {
                setJoinErrorMessage('');
                setActiveModal('join');
              }}
              className="px-4 md:px-5 py-2 text-xs md:text-sm font-medium text-white bg-black/30 hover:bg-white/10 border border-purple-500/30 hover:border-purple-400/60 rounded-full transition-all duration-200 cursor-pointer backdrop-blur-md shadow-sm"
            >
              Join Room
            </button>

            {/* Create Room Button */}
            <button
              onClick={() => {
                setActiveModal('create');
              }}
              className="px-4 md:px-5 py-2 text-xs md:text-sm font-bold text-[#060814] bg-gradient-to-r from-[#22D3EE] to-[#8B5CF6] hover:opacity-95 hover:shadow-[0_0_20px_rgba(34,211,238,0.4)] rounded-full transition-all duration-200 cursor-pointer"
            >
              Create Room
            </button>

            {/* Mobile Hamburger Menu Icon */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-2 text-zinc-300 hover:text-white transition-colors cursor-pointer"
            >
              {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        <AnimatePresence>
          {isMobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="md:hidden mt-4 bg-[#0D1224]/95 backdrop-blur-2xl border border-white/10 rounded-3xl p-5 shadow-2xl space-y-4"
            >
              <div className="grid grid-cols-2 gap-2 text-sm font-semibold">
                <button
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    router.push('/');
                  }}
                  className="p-3 bg-white/5 rounded-xl text-left hover:bg-white/10 transition-colors"
                >
                  Home
                </button>
                <button
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    router.push('/rooms');
                  }}
                  className="p-3 bg-white/5 rounded-xl text-left hover:bg-white/10 transition-colors"
                >
                  Rooms
                </button>
                <button
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    router.push('/library');
                  }}
                  className="p-3 bg-white/5 rounded-xl text-left hover:bg-white/10 transition-colors"
                >
                  Library
                </button>
                <button
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    router.push('/about');
                  }}
                  className="p-3 bg-white/5 rounded-xl text-left hover:bg-white/10 transition-colors"
                >
                  About
                </button>
              </div>

              <div className="flex gap-2 pt-2 border-t border-white/10">
                <button
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    setActiveModal('join');
                  }}
                  className="w-1/2 py-2.5 rounded-xl bg-white/10 text-white font-bold text-xs text-center"
                >
                  Join Room
                </button>
                <button
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    setActiveModal('create');
                  }}
                  className="w-1/2 py-2.5 rounded-xl bg-[#FBBF24] text-black font-bold text-xs text-center"
                >
                  Create Room
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* =========================================================================
          2. FULL-SCREEN CINEMATIC HERO SECTION
         ========================================================================= */}
      <section className="relative min-h-[85vh] lg:min-h-[92vh] flex flex-col justify-between pt-28 md:pt-32 pb-8 md:pb-12 px-6 md:px-12 overflow-hidden">
        {/* Photographic Sunset Dusk Background Image */}
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat z-0"
          style={{ backgroundImage: `url('/hero_sunset.jpg')` }}
        />

        {/* Cinematic Vignette & Gradient Overlays for High Legibility */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#060814]/95 via-[#060814]/75 to-transparent z-10 pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#060814] via-[#060814]/40 to-transparent z-10 pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-transparent via-[#060814]/20 to-[#060814]/80 z-10 pointer-events-none" />

        {/* Hero Content Container */}
        <div className="relative z-20 max-w-[1440px] mx-auto w-full my-auto grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center py-6">
          {/* ----------------- LEFT HERO CONTENT (Col span 7) ----------------- */}
          <div className="lg:col-span-7 space-y-6 md:space-y-8 text-left">
            {/* Eyebrow Label */}
            <div className="flex items-center gap-3">
              <span className="text-xs md:text-sm font-semibold tracking-[0.2em] text-[#A78BFA] uppercase">
                A Synchronized Music Experience
              </span>
              <span className="h-[1px] w-10 md:w-16 bg-[#8B5CF6]/40 inline-block" />
            </div>

            {/* Main Dominant Headline */}
            <div className="space-y-0.5">
              <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-[68px] xl:text-[76px] font-extrabold tracking-tight text-white leading-[1.05]">
                Good Music<br />
                Sounds Better<br />
                <span className="font-script text-[#FBBF24] text-5xl sm:text-6xl md:text-7xl lg:text-[84px] xl:text-[94px] font-bold tracking-normal inline-block transform -rotate-1 mt-1">
                  Together.
                </span>
              </h1>
            </div>

            {/* Supporting Paragraph */}
            <p className="text-sm md:text-base text-zinc-300 font-normal leading-relaxed max-w-lg">
              Create a room, invite your friends, and listen to the same song at the same time — no delays, just vibes.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-wrap items-center gap-4 pt-2">
              {/* Primary Sunset Amber CTA */}
              <button
                onClick={() => setActiveModal('create')}
                className="px-7 md:px-8 py-3.5 md:py-4 rounded-full bg-[#FBBF24] hover:bg-[#F59E0B] text-[#080B14] font-bold text-sm md:text-base flex items-center gap-2 shadow-[0_0_25px_rgba(251,191,36,0.35)] hover:shadow-[0_0_35px_rgba(251,191,36,0.5)] hover:scale-[1.02] transition-all duration-200 cursor-pointer"
              >
                <span>Create a Room</span>
                <ArrowRight className="w-4 h-4 text-[#080B14] stroke-[2.5]" />
              </button>

              {/* Secondary Dark Glass Pill Button */}
              <button
                onClick={() => {
                  setJoinErrorMessage('');
                  setActiveModal('join');
                }}
                className="px-7 md:px-8 py-3.5 md:py-4 rounded-full bg-black/40 hover:bg-white/10 border border-white/20 hover:border-purple-400/60 text-white font-medium text-sm md:text-base backdrop-blur-md transition-all duration-200 cursor-pointer shadow-sm"
              >
                Join Room
              </button>
            </div>
          </div>

          {/* ----------------- RIGHT FLOATING GLASS MUSIC PLAYER (Col span 5) ----------------- */}
          <div className="lg:col-span-5 flex justify-center lg:justify-end">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
              className="w-full max-w-[360px] bg-[#101422]/80 backdrop-blur-2xl border border-white/10 rounded-2xl p-5 shadow-[0_25px_60px_rgba(0,0,0,0.7)] text-white relative group"
            >
              {/* Top Row: Artwork + Track Info + Heart Icon */}
              <div className="flex items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-12 h-12 rounded-xl overflow-hidden bg-zinc-800 shrink-0 border border-white/10 shadow-md relative">
                    <img
                      src={currentTrack.coverUrl}
                      alt={`${currentTrack.title} Cover`}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="min-w-0 text-left">
                    <h3 className="font-bold text-sm text-white truncate tracking-tight">
                      {currentTrack.title}
                    </h3>
                    <p className="text-xs text-zinc-400 truncate mt-0.5">
                      {currentTrack.artist}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => {
                    const newState = !isPlayerLiked;
                    setIsPlayerLiked(newState);
                    showToast(newState ? `Added to Liked Songs` : `Removed from Liked Songs`);
                  }}
                  className="p-2 text-zinc-400 hover:text-white transition-colors cursor-pointer shrink-0"
                  title="Like track"
                >
                  <Heart
                    className={`w-4 h-4 transition-colors ${
                      isPlayerLiked ? 'fill-red-500 text-red-500' : 'text-zinc-300 hover:text-white'
                    }`}
                  />
                </button>
              </div>

              {/* Seekable Progress Bar & Timestamps */}
              <div className="space-y-1.5 mb-4">
                <div
                  onClick={handleProgressBarClick}
                  className="w-full h-1.5 bg-white/15 hover:bg-white/25 rounded-full overflow-hidden relative cursor-pointer group/bar transition-all"
                  title="Click to seek"
                >
                  <div
                    className="h-full bg-white rounded-full transition-all"
                    style={{
                      width: `${Math.min(100, (playerCurrentSeconds / currentTrack.duration) * 100)}%`,
                    }}
                  />
                </div>
                <div className="flex justify-between items-center text-[10px] font-mono text-zinc-400">
                  <span>{formatTime(playerCurrentSeconds)}</span>
                  <span>{currentTrack.durationFormatted}</span>
                </div>
              </div>

              {/* Playback Controls Strip */}
              <div className="flex items-center justify-between px-2 pt-1 text-zinc-300">
                <button
                  onClick={() => {
                    const nextShuffle = !isShuffle;
                    setIsShuffle(nextShuffle);
                    showToast(nextShuffle ? 'Shuffle enabled' : 'Shuffle disabled');
                  }}
                  className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                    isShuffle ? 'text-[#22D3EE]' : 'text-zinc-400 hover:text-white'
                  }`}
                  title="Shuffle"
                >
                  <Shuffle className="w-4 h-4" />
                </button>

                <button
                  onClick={handlePrevTrack}
                  className="p-1.5 text-zinc-300 hover:text-white transition-colors cursor-pointer"
                  title="Previous"
                >
                  <SkipBack className="w-4 h-4 fill-current" />
                </button>

                {/* Central Dominant Pause/Play Button */}
                <button
                  onClick={() => {
                    const nextPlaying = !isPlayerPlaying;
                    setIsPlayerPlaying(nextPlaying);
                    showToast(nextPlaying ? `Playing ${currentTrack.title}` : 'Paused playback');
                  }}
                  className="w-10 h-10 rounded-full bg-white hover:bg-zinc-100 text-black flex items-center justify-center shadow-lg hover:scale-105 transition-all cursor-pointer"
                  title={isPlayerPlaying ? 'Pause' : 'Play'}
                >
                  {isPlayerPlaying ? (
                    <Pause className="w-4 h-4 fill-black" />
                  ) : (
                    <Play className="w-4 h-4 fill-black ml-0.5" />
                  )}
                </button>

                <button
                  onClick={handleNextTrack}
                  className="p-1.5 text-zinc-300 hover:text-white transition-colors cursor-pointer"
                  title="Next"
                >
                  <SkipForward className="w-4 h-4 fill-current" />
                </button>

                <button
                  onClick={() => {
                    const nextRepeat = !isRepeat;
                    setIsRepeat(nextRepeat);
                    showToast(nextRepeat ? 'Repeat track enabled' : 'Repeat disabled');
                  }}
                  className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                    isRepeat ? 'text-[#22D3EE]' : 'text-zinc-400 hover:text-white'
                  }`}
                  title="Repeat"
                >
                  <Repeat className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          </div>
        </div>

        {/* ----------------- FEATURE HIGHLIGHT STRIP (Bottom of Hero) ----------------- */}
        <div className="relative z-20 max-w-[1440px] mx-auto w-full pt-6">
          <div className="flex flex-wrap items-center gap-6 sm:gap-10 text-xs sm:text-sm font-medium text-zinc-300">
            {/* Feature 1: Zero Latency */}
            <div
              onClick={() => showToast('Sub-millisecond NTP sync active')}
              className="flex items-center gap-2.5 cursor-pointer hover:text-white transition-colors"
            >
              <Zap className="w-4 h-4 text-[#FBBF24] fill-[#FBBF24]" />
              <span>Zero Latency</span>
            </div>

            <span className="hidden sm:inline-block w-[1px] h-3.5 bg-white/10" />

            {/* Feature 2: Works on All Devices */}
            <div
              onClick={() => showToast('Accessible on Mobile, Desktop, and Tablets')}
              className="flex items-center gap-2.5 cursor-pointer hover:text-white transition-colors"
            >
              <Monitor className="w-4 h-4 text-[#FBBF24]" />
              <span>Works on All Devices</span>
            </div>

            <span className="hidden sm:inline-block w-[1px] h-3.5 bg-white/10" />

            {/* Feature 3: Private & Ad-free */}
            <div
              onClick={() => showToast('Private rooms are encrypted and ad-free')}
              className="flex items-center gap-2.5 cursor-pointer hover:text-white transition-colors"
            >
              <Lock className="w-4 h-4 text-[#FBBF24]" />
              <span>Private & Ad-free</span>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          3. HOW IT WORKS SECTION (Directly below Hero)
         ========================================================================= */}
      <section
        id="how-it-works-section"
        className="relative z-20 bg-[#060814] px-6 md:px-12 py-20 md:py-28 border-t border-white/5"
      >
        <div className="max-w-[1440px] mx-auto space-y-12">
          {/* Section Header */}
          <div className="space-y-3 text-left">
            <div className="flex items-center gap-2.5">
              <span className="h-[2px] w-6 bg-[#8B5CF6]" />
              <span className="text-xs font-bold tracking-[0.2em] text-[#A78BFA] uppercase">
                How It Works
              </span>
            </div>
            <h2 className="text-3xl md:text-5xl font-extrabold text-white tracking-tight">
              Get Started in Seconds
            </h2>
          </div>

          {/* Three Connected Step Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative items-stretch">
            {/* Card 01 */}
            <div
              onClick={() => setActiveModal('create')}
              className="relative bg-[#0A0E1C]/80 backdrop-blur-md border border-purple-500/20 hover:border-purple-500/50 rounded-2xl p-7 flex flex-col justify-between transition-all duration-300 group hover:-translate-y-1 shadow-[0_10px_30px_rgba(0,0,0,0.4)] cursor-pointer"
            >
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-zinc-400 bg-white/5 px-2.5 py-1 rounded-md border border-white/10">
                    01
                  </span>
                  <div className="w-11 h-11 rounded-xl bg-[#8B5CF6]/15 border border-[#8B5CF6]/30 flex items-center justify-center text-[#A78BFA] group-hover:scale-110 transition-transform">
                    <UserPlus className="w-5 h-5" />
                  </div>
                </div>
                <div className="space-y-2 text-left">
                  <h3 className="text-lg font-bold text-white tracking-tight group-hover:text-[#22D3EE] transition-colors">
                    Create or Join a Room
                  </h3>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    Start a new room or join with a room code.
                  </p>
                </div>
              </div>
            </div>

            {/* Card 02 */}
            <div
              onClick={() => router.push('/library')}
              className="relative bg-[#0A0E1C]/80 backdrop-blur-md border border-purple-500/20 hover:border-purple-500/50 rounded-2xl p-7 flex flex-col justify-between transition-all duration-300 group hover:-translate-y-1 shadow-[0_10px_30px_rgba(0,0,0,0.4)] cursor-pointer"
            >
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-zinc-400 bg-white/5 px-2.5 py-1 rounded-md border border-white/10">
                    02
                  </span>
                  <div className="w-11 h-11 rounded-xl bg-[#8B5CF6] text-white flex items-center justify-center shadow-[0_0_20px_rgba(139,92,246,0.5)] group-hover:scale-110 transition-transform">
                    <Music className="w-5 h-5 fill-current" />
                  </div>
                </div>
                <div className="space-y-2 text-left">
                  <h3 className="text-lg font-bold text-white tracking-tight group-hover:text-[#A78BFA] transition-colors">
                    Add a Song
                  </h3>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    Pick a song from your library and hit play.
                  </p>
                </div>
              </div>
            </div>

            {/* Card 03 */}
            <div
              onClick={() => router.push('/rooms')}
              className="relative bg-[#0A0E1C]/80 backdrop-blur-md border border-purple-500/20 hover:border-purple-500/50 rounded-2xl p-7 flex flex-col justify-between transition-all duration-300 group hover:-translate-y-1 shadow-[0_10px_30px_rgba(0,0,0,0.4)] cursor-pointer"
            >
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-zinc-400 bg-white/5 px-2.5 py-1 rounded-md border border-white/10">
                    03
                  </span>
                  <div className="w-11 h-11 rounded-xl bg-[#8B5CF6]/15 border border-[#8B5CF6]/30 flex items-center justify-center text-[#A78BFA] group-hover:scale-110 transition-transform">
                    <Users className="w-5 h-5" />
                  </div>
                </div>
                <div className="space-y-2 text-left">
                  <h3 className="text-lg font-bold text-white tracking-tight group-hover:text-[#FBBF24] transition-colors">
                    Listen Together
                  </h3>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    Enjoy the same music in perfect sync, wherever you are.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          4. RECENT ACTIVE ROOMS & SOCIAL NETWORK SECTION
         ========================================================================= */}
      <section className="relative z-20 bg-[#080C1B] px-6 md:px-12 py-16 border-t border-white/5">
        <div className="max-w-[1440px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column: Recent Rooms */}
          <div className="lg:col-span-7 space-y-4 text-left">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Radio className="w-4 h-4 text-[#22D3EE]" />
                <h3 className="text-base font-bold text-white tracking-tight">
                  Live Room Spaces
                </h3>
              </div>
              <button
                onClick={() => router.push('/rooms')}
                className="text-xs font-semibold text-[#A78BFA] hover:text-white flex items-center gap-1 transition-colors cursor-pointer"
              >
                <span>View All</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {MOCK_ROOMS.slice(0, 4).map((rm) => (
                <div
                  key={rm.id}
                  onClick={() => router.push(`/room/${rm.code}?username=${encodeURIComponent(currentDisplayName)}`)}
                  className="flex items-center justify-between p-3.5 bg-[#0A0E1C]/80 hover:bg-[#0E1428] rounded-2xl border border-white/10 hover:border-[#8B5CF6]/50 transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-[#8B5CF6]/15 border border-[#8B5CF6]/30 flex items-center justify-center shrink-0">
                      <Radio className="w-4 h-4 text-[#A78BFA]" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-bold text-xs text-white truncate group-hover:text-[#22D3EE]">
                        {rm.name}
                      </h4>
                      <p className="text-[10px] font-mono text-zinc-400 uppercase">
                        {rm.code} • {rm.listenersCount} listeners
                      </p>
                    </div>
                  </div>

                  <span className="w-7 h-7 rounded-full bg-white/10 group-hover:bg-[#22D3EE] group-hover:text-black flex items-center justify-center transition-all shrink-0">
                    <Play className="w-3 h-3 fill-current ml-0.5" />
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Right Column: Friends Network */}
          <div className="lg:col-span-5 space-y-4 text-left">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Users className="w-4 h-4 text-[#A78BFA]" />
                <h3 className="text-base font-bold text-white tracking-tight">
                  Friends Network
                </h3>
              </div>
            </div>

            <form onSubmit={handleAddFriend} className="flex gap-2">
              <input
                type="text"
                required
                value={friendSearchInput}
                onChange={(e) => setFriendSearchInput(e.target.value)}
                placeholder="Find friend by username..."
                className="flex-grow px-3.5 py-2 bg-[#0A0E1C] border border-white/10 rounded-xl outline-none text-white text-xs font-mono"
              />
              <button
                type="submit"
                className="px-4 bg-[#8B5CF6] hover:bg-[#7c3aed] text-white font-bold rounded-xl text-xs transition-colors cursor-pointer"
              >
                Add
              </button>
            </form>

            <div className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-none">
              {friendsList.map((f) => (
                <div
                  key={f.id}
                  onClick={() => showToast(`@${f.name} is ${f.isOnline ? 'online' : 'offline'}`)}
                  className="flex flex-col items-center shrink-0 space-y-1 group cursor-pointer"
                >
                  <div className="relative">
                    <div className="w-10 h-10 rounded-full bg-[#0A0E1C] border border-[#8B5CF6]/40 flex items-center justify-center text-xs font-bold text-[#A78BFA]">
                      {f.name.charAt(0).toUpperCase()}
                    </div>
                    <span
                      className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-[#060814] ${
                        f.isOnline ? 'bg-emerald-400' : 'bg-zinc-500'
                      }`}
                    />
                  </div>
                  <span className="text-[10px] font-medium text-zinc-300 truncate max-w-[60px]">
                    @{f.name}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          5. FOOTER
         ========================================================================= */}
      <footer className="bg-[#04060E] py-8 px-6 md:px-12 border-t border-white/5 text-center text-xs text-zinc-500">
        <div className="max-w-[1440px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© {new Date().getFullYear()} Syncroom Inc. All audio synchronized in real time.</p>
          <div className="flex items-center gap-6">
            <span onClick={() => router.push('/about')} className="hover:text-zinc-300 cursor-pointer">
              About
            </span>
            <span onClick={() => router.push('/rooms')} className="hover:text-zinc-300 cursor-pointer">
              Rooms
            </span>
            <span onClick={() => router.push('/library')} className="hover:text-zinc-300 cursor-pointer">
              Library
            </span>
          </div>
        </div>
      </footer>

      {/* =========================================================================
          6. MODALS OVERLAYS (CREATE, JOIN, SUCCESS, SETTINGS, AUTH, SEARCH)
         ========================================================================= */}
      <AnimatePresence>
        {/* Create Room Form Modal */}
        {activeModal === 'create' && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-md bg-[#0D1224] border border-white/15 rounded-3xl p-7 relative shadow-2xl"
            >
              <button
                onClick={() => setActiveModal(null)}
                className="absolute top-5 right-5 text-zinc-400 hover:text-white text-lg font-bold cursor-pointer"
              >
                &times;
              </button>

              <form onSubmit={handleCreateRoomSubmit} className="space-y-4">
                <div>
                  <h2 className="text-xl font-bold text-white">Create a Room</h2>
                  <p className="text-zinc-400 text-xs mt-0.5">Configure your synchronized room space</p>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-wider mb-1.5">
                      Room Name
                    </label>
                    <input
                      type="text"
                      required
                      value={createRoomName}
                      onChange={(e) => setCreateRoomName(e.target.value)}
                      placeholder="e.g. Sunset Rooftop Chill"
                      className="w-full px-3.5 py-2.5 bg-[#060814] border border-white/10 rounded-xl outline-none text-white text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-wider mb-1.5">
                      Optional Description
                    </label>
                    <input
                      type="text"
                      value={createDescription}
                      onChange={(e) => setCreateDescription(e.target.value)}
                      placeholder="e.g. Acoustic guitar & indie vibes"
                      className="w-full px-3.5 py-2.5 bg-[#060814] border border-white/10 rounded-xl outline-none text-white text-xs"
                    />
                  </div>

                  <div className="flex gap-3">
                    <div className="w-1/2">
                      <label className="block text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-wider mb-1.5">
                        Max Listeners ({maxParticipants})
                      </label>
                      <input
                        type="range"
                        min="2"
                        max="30"
                        value={maxParticipants}
                        onChange={(e) => setMaxParticipants(parseInt(e.target.value))}
                        className="w-full cursor-pointer accent-[#FBBF24]"
                      />
                    </div>

                    <div className="w-1/2 flex flex-col justify-end">
                      <div className="flex items-center gap-2 justify-between bg-[#060814] px-3 py-2 rounded-xl border border-white/10">
                        <span className="text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-wider">
                          Collab Queue
                        </span>
                        <input
                          type="checkbox"
                          checked={collaborativeMode}
                          onChange={(e) => setCollaborativeMode(e.target.checked)}
                          className="w-3.5 h-3.5 rounded text-[#FBBF24] bg-[#060814] border-white/10 cursor-pointer"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="bg-[#060814] p-3 rounded-xl border border-white/10 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
                        {createIsPrivate ? (
                          <Lock className="w-3.5 h-3.5 text-pink-400" />
                        ) : (
                          <Unlock className="w-3.5 h-3.5 text-emerald-400" />
                        )}
                        Private Room Password
                      </span>
                      <input
                        type="checkbox"
                        checked={createIsPrivate}
                        onChange={(e) => setCreateIsPrivate(e.target.checked)}
                        className="w-3.5 h-3.5 rounded text-[#FBBF24] bg-[#060814] border-white/10 cursor-pointer"
                      />
                    </div>

                    {createIsPrivate && (
                      <input
                        type="password"
                        required
                        value={createPassword}
                        onChange={(e) => setCreatePassword(e.target.value)}
                        placeholder="Enter room password"
                        className="w-full px-3 py-2 bg-black border border-white/10 rounded-xl outline-none text-white text-xs font-mono"
                      />
                    )}
                  </div>
                </div>

                <div className="flex gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => setActiveModal(null)}
                    className="w-1/3 py-3 text-xs font-bold bg-white/5 hover:bg-white/10 text-zinc-300 rounded-xl cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isCreatingRoom}
                    className="w-2/3 py-3 text-xs font-bold text-[#080B14] bg-[#FBBF24] hover:bg-[#F59E0B] disabled:opacity-60 disabled:cursor-not-allowed rounded-xl cursor-pointer transition-all shadow-md flex items-center justify-center gap-1.5"
                  >
                    {isCreatingRoom ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Creating Space...</span>
                      </>
                    ) : (
                      <span>Create Room →</span>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {/* Room Created Success Screen */}
        {activeModal === 'created_success' && createdRoomData && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-md bg-[#0D1224] border border-[#22D3EE]/30 rounded-3xl p-7 relative shadow-2xl text-center space-y-5"
            >
              <button
                onClick={() => setActiveModal(null)}
                className="absolute top-5 right-5 text-zinc-400 hover:text-white text-lg font-bold cursor-pointer"
              >
                &times;
              </button>

              <div className="w-14 h-14 rounded-2xl bg-[#22D3EE]/15 border border-[#22D3EE]/30 text-[#22D3EE] flex items-center justify-center mx-auto shadow-lg">
                <Check className="w-7 h-7" />
              </div>

              <div>
                <h2 className="text-xl font-bold text-white">Room Created!</h2>
                <p className="text-xs text-zinc-400 mt-1">{createdRoomData.name}</p>
              </div>

              {/* Room Code Showcase Box */}
              <div className="bg-[#060814] border border-white/10 rounded-2xl p-4 space-y-1">
                <p className="text-[10px] font-mono uppercase text-zinc-400 font-bold tracking-widest">
                  Room Access Code
                </p>
                <div className="text-3xl font-mono font-black text-[#FBBF24] tracking-widest">
                  {createdRoomData.code}
                </div>
              </div>

              {/* Action Buttons: Copy Code, Share, Enter Room */}
              <div className="space-y-2.5">
                <div className="flex gap-2">
                  <button
                    onClick={() => handleCopyCode(createdRoomData.code)}
                    className="w-1/2 py-2.5 bg-white/10 hover:bg-white/15 text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Code</span>
                  </button>

                  <button
                    onClick={() => handleShareRoom(createdRoomData.code, createdRoomData.name)}
                    className="w-1/2 py-2.5 bg-white/10 hover:bg-white/15 text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    <span>Share Link</span>
                  </button>
                </div>

                <button
                  onClick={() => {
                    if (createIsPrivate && createPassword && createPassword.trim()) {
                      if (typeof window !== 'undefined') {
                        sessionStorage.setItem('syncroom_join_password', createPassword.trim());
                      }
                    }
                    setActiveModal(null);
                    router.push(
                      `/room/${createdRoomData.code}?username=${encodeURIComponent(currentDisplayName)}`
                    );
                  }}
                  className="w-full py-3.5 text-xs font-bold text-[#080B14] bg-gradient-to-r from-[#22D3EE] to-[#8B5CF6] rounded-xl hover:opacity-95 transition-all cursor-pointer flex items-center justify-center gap-2 shadow-lg"
                >
                  <span>Enter Room Now</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Join Room Modal */}
        {activeModal === 'join' && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-md bg-[#0D1224] border border-white/15 rounded-3xl p-7 relative shadow-2xl"
            >
              <button
                onClick={() => setActiveModal(null)}
                className="absolute top-5 right-5 text-zinc-400 hover:text-white text-lg font-bold cursor-pointer"
              >
                &times;
              </button>

              <form onSubmit={handleJoinRoomSubmit} className="space-y-4">
                <div>
                  <h2 className="text-xl font-bold text-white">Join Room Space</h2>
                  <p className="text-zinc-400 text-xs mt-0.5">Enter the 6-character room code</p>
                </div>

                {joinErrorMessage && (
                  <div className="p-3 text-xs bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl font-mono">
                    {joinErrorMessage}
                  </div>
                )}

                <div className="space-y-3">
                  <div>
                    <label className="block text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-wider mb-1.5">
                      Room Code
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={8}
                      value={joinRoomCode}
                      onChange={(e) => setJoinRoomCode(e.target.value.toUpperCase())}
                      placeholder="e.g. SUNSET"
                      className="w-full px-3.5 py-3 bg-[#060814] border border-white/10 rounded-xl outline-none text-white text-sm font-mono tracking-widest text-center uppercase"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-wider mb-1.5">
                      Password (If room is private)
                    </label>
                    <input
                      type="password"
                      value={joinPassword}
                      onChange={(e) => setJoinPassword(e.target.value)}
                      placeholder="Optional password"
                      className="w-full px-3.5 py-2.5 bg-[#060814] border border-white/10 rounded-xl outline-none text-white text-xs font-mono"
                    />
                  </div>
                </div>

                <div className="flex gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => setActiveModal(null)}
                    className="w-1/3 py-3 text-xs font-bold bg-white/5 hover:bg-white/10 text-zinc-300 rounded-xl cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isJoiningLoading}
                    className="w-2/3 py-3 text-xs font-bold text-[#080B14] bg-[#FBBF24] hover:bg-[#F59E0B] rounded-xl cursor-pointer transition-all flex items-center justify-center gap-2"
                  >
                    {isJoiningLoading ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Connecting...</span>
                      </>
                    ) : (
                      <span>Join Space →</span>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {/* Settings Modal */}
        {activeModal === 'settings' && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-md bg-[#0D1224] border border-white/15 rounded-3xl p-7 relative shadow-2xl space-y-4"
            >
              <button
                onClick={() => setActiveModal(null)}
                className="absolute top-5 right-5 text-zinc-400 hover:text-white text-lg font-bold cursor-pointer"
              >
                &times;
              </button>

              <div>
                <h2 className="text-xl font-bold text-white">Audio & Playback Settings</h2>
                <p className="text-xs text-zinc-400 mt-0.5">Customize your playback experience</p>
              </div>

              <div className="space-y-4 text-xs">
                <div>
                  <label className="block text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-wider mb-1.5">
                    Audio Streaming Quality
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {['standard', 'lossless'].map((quality) => (
                      <button
                        key={quality}
                        type="button"
                        onClick={() => {
                          setAppAudioQuality(quality);
                          showToast(`Quality set to ${quality}`);
                        }}
                        className={`py-2 rounded-xl border text-center capitalize cursor-pointer font-semibold transition-all ${
                          appAudioQuality === quality
                            ? 'bg-[#8B5CF6] text-white border-transparent'
                            : 'bg-white/5 text-zinc-400 border-white/10'
                        }`}
                      >
                        {quality} (320kbps)
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="block text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-wider">
                      Master Volume ({Math.round(appMasterVolume * 100)}%)
                    </label>
                    <Volume2 className="w-3.5 h-3.5 text-zinc-400" />
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={appMasterVolume}
                    onChange={(e) => setAppMasterVolume(parseFloat(e.target.value))}
                    className="w-full accent-[#22D3EE] cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/10">
                  <div>
                    <p className="font-bold text-white">NTP Ultra-Low Latency Mode</p>
                    <p className="text-[10px] text-zinc-400">Compensate for sub-millisecond clock drift</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={appLowLatency}
                    onChange={(e) => {
                      setAppLowLatency(e.target.checked);
                      showToast(e.target.checked ? 'Ultra-low latency enabled' : 'Standard latency enabled');
                    }}
                    className="w-4 h-4 rounded text-[#22D3EE] accent-[#22D3EE] cursor-pointer"
                  />
                </div>
              </div>

              <button
                onClick={() => {
                  setActiveModal(null);
                  showToast('Settings saved!');
                }}
                className="w-full py-3 bg-[#22D3EE] text-black font-bold rounded-xl text-xs transition-all cursor-pointer"
              >
                Save Settings
              </button>
            </motion.div>
          </div>
        )}

        {/* Auth Modal */}
        {activeModal === 'auth' && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-md bg-[#0D1224] border border-white/15 rounded-3xl p-7 relative shadow-2xl"
            >
              <button
                onClick={() => setActiveModal(null)}
                className="absolute top-5 right-5 text-zinc-400 hover:text-white text-lg font-bold cursor-pointer"
              >
                &times;
              </button>

              <form onSubmit={handleAuthSubmit} className="space-y-4">
                <div>
                  <h2 className="text-xl font-bold text-white">
                    {authMode === 'login' ? 'Welcome Back' : 'Create Identity'}
                  </h2>
                  <p className="text-zinc-400 text-xs mt-0.5">
                    {authMode === 'login' ? 'Sign in to access synchronized rooms' : 'Register a new profile'}
                  </p>
                </div>

                {authErrorMessage && (
                  <div className="p-3 text-xs bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl font-mono">
                    {authErrorMessage}
                  </div>
                )}

                <div className="space-y-3">
                  <div>
                    <label className="block text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-wider mb-1.5">
                      Email Address
                    </label>
                    <input
                      type="email"
                      required
                      value={authEmail}
                      onChange={(e) => setAuthEmail(e.target.value)}
                      placeholder="name@domain.com"
                      className="w-full px-3.5 py-2.5 bg-[#060814] border border-white/10 rounded-xl outline-none text-white text-xs font-mono"
                    />
                  </div>

                  {authMode === 'register' && (
                    <>
                      <div>
                        <label className="block text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-wider mb-1.5">
                          Display Username
                        </label>
                        <input
                          type="text"
                          required
                          value={authUsername}
                          onChange={(e) => setAuthUsername(e.target.value)}
                          placeholder="e.g. ankit"
                          className="w-full px-3.5 py-2.5 bg-[#060814] border border-white/10 rounded-xl outline-none text-white text-xs"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-wider mb-1.5">
                          Avatar Color
                        </label>
                        <div className="flex gap-2">
                          {AVATAR_PRESETS.map((color) => (
                            <div
                              key={color}
                              onClick={() => setAuthAvatar(color)}
                              className={`w-6 h-6 rounded-full cursor-pointer border-2 transition-all ${
                                authAvatar === color ? 'border-white scale-110 shadow-md' : 'border-transparent opacity-60'
                              }`}
                              style={{ backgroundColor: color }}
                            />
                          ))}
                        </div>
                      </div>
                    </>
                  )}

                  <div>
                    <label className="block text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-wider mb-1.5">
                      Password
                    </label>
                    <input
                      type="password"
                      required
                      value={authPassword}
                      onChange={(e) => setAuthPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full px-3.5 py-2.5 bg-[#060814] border border-white/10 rounded-xl outline-none text-white text-xs font-mono"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={authLoading}
                  className="w-full py-3 text-xs font-bold text-[#080B14] bg-[#FBBF24] hover:bg-[#F59E0B] rounded-xl cursor-pointer transition-all"
                >
                  {authLoading ? 'Authenticating...' : authMode === 'login' ? 'Sign In' : 'Register Account'}
                </button>

                <p className="text-center text-xs text-zinc-400 mt-2">
                  {authMode === 'login' ? "Don't have an account? " : 'Already registered? '}
                  <span
                    onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}
                    className="text-white font-bold hover:underline cursor-pointer"
                  >
                    {authMode === 'login' ? 'Register' : 'Sign In'}
                  </span>
                </p>
              </form>
            </motion.div>
          </div>
        )}

        {/* Profile Edit Modal */}
        {showProfileModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-md bg-[#0D1224] border border-white/15 rounded-3xl p-7 relative shadow-2xl"
            >
              <button
                onClick={() => setShowProfileModal(false)}
                className="absolute top-5 right-5 text-zinc-400 hover:text-white text-lg font-bold cursor-pointer"
              >
                &times;
              </button>
              <div className="space-y-4">
                <h2 className="text-lg font-bold text-white">Profile Details</h2>

                <div className="space-y-3 text-xs">
                  <div>
                    <label className="block text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-wider mb-1.5">
                      Display Name
                    </label>
                    <input
                      type="text"
                      value={editUsername || currentDisplayName}
                      onChange={(e) => setEditUsername(e.target.value)}
                      className="w-full px-3 py-2 bg-[#060814] border border-white/10 rounded-xl outline-none text-white font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-wider mb-1.5">
                      Status Line
                    </label>
                    <input
                      type="text"
                      value={statusText}
                      onChange={(e) => setStatusText(e.target.value)}
                      className="w-full px-3 py-2 bg-[#060814] border border-white/10 rounded-xl outline-none text-white text-xs"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setShowProfileModal(false);
                    showToast('Profile updated!');
                  }}
                  className="w-full py-2.5 text-xs font-bold text-[#080B14] bg-[#FBBF24] hover:bg-[#F59E0B] rounded-xl cursor-pointer transition-all"
                >
                  Save Changes
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Global Interactive Search Modal */}
      <SearchModal
        isOpen={isSearchModalOpen}
        onClose={() => setIsSearchModalOpen(false)}
        onPlayTrack={(track) => {
          const foundIdx = MOCK_TRACKS.findIndex((t) => t.id === track.id);
          if (foundIdx !== -1) {
            setCurrentTrackIndex(foundIdx);
            setIsPlayerPlaying(true);
            setPlayerCurrentSeconds(0);
          }
        }}
      />
    </div>
  );
}

export default function SyncRoomHeroPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#060814]" />}>
      <SyncRoomHeroContent />
    </Suspense>
  );
}
