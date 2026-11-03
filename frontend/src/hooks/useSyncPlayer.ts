'use client';

import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { getBackendUrl } from '@/lib/config';
import { safeFetchJson } from '@/lib/api';

export type TrackSource = 'upload' | 'spotify' | 'youtube';

export interface Track {
  id: string;
  title: string;
  artist: string;
  duration: number;
  url: string;
  source: TrackSource;
  spotifyUri?: string;
  youtubeId?: string;
  thumbnailUrl?: string;
  uploadedBy: string;
  votes: { [username: string]: 'up' | 'down' };
  voteCount: number;
  approved: boolean;
  lyricsUrl?: string; // Phase 3 Synced Lyrics LRC path
  loop?: boolean; // Track-level loop flag
}

export interface PlaybackState {
  isPlaying: boolean;
  position: number;
  serverTimestamp: number;
  loopCurrentTrack?: boolean;
}

export interface Participant {
  id: string;
  username: string;
  isHost: boolean;
  isOnline: boolean;
}

export interface RoomSettings {
  isPrivate: boolean;
  password?: string;
  maxParticipants: number;
  collaborativeMode: boolean;
  enableChat: boolean;
  enableReactions: boolean;
  enableVoting: boolean;
  allowEveryoneToAddSongs: boolean;
  allowEveryoneToSkip: boolean;
  hostApprovalRequired: boolean;
  autoPickNext: boolean;
  djBoothMode?: boolean;
}

export interface ChatMessage {
  id: string;
  username: string;
  message: string;
  timestamp: number;
  replyToId?: string;
  replyToUser?: string;
}

export interface Room {
  roomId: string;
  roomName: string;
  hostId: string;
  settings: RoomSettings;
  currentTrack: Track | null;
  playback: PlaybackState;
  queue: Track[];
  playedTracks?: Track[];
  participants: Participant[];
  chatHistory: ChatMessage[];
  theme?: string; // Phase 3 Room visual themes
  djs?: string[]; // Phase 3 Rotating DJs
  currentDjIndex?: number;
  scheduledStartTime?: number; // Phase 3 Scheduled room starts
  isStarted?: boolean;
}

export interface ReactionItem {
  id: string;
  emoji: string;
  x: number;
}

export interface LyricLine {
  time: number; // position in seconds
  text: string;
}

const BACKEND_URL = getBackendUrl();

export function useSyncPlayer(roomId: string, username: string, password?: string) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [participant, setParticipant] = useState<Participant | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);

  // Sync / Latency states
  const [latency, setLatency] = useState(0);
  const [clockOffset, setClockOffset] = useState(0);
  const [drift, setDrift] = useState(0);
  const [syncStatus, setSyncStatus] = useState<'synced' | 'syncing' | 'unstable'>('syncing');

  // Phase 2 states
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [activityLog, setActivityLog] = useState<{ id: string; text: string; timestamp: number }[]>([]);
  const [reactions, setReactions] = useState<ReactionItem[]>([]);

  // Phase 3 states
  const [audioDelay, setAudioDelay] = useState<number>(0); // -200ms to +200ms
  const [lyrics, setLyrics] = useState<LyricLine[]>([]);
  const [authoritativePosition, setAuthoritativePosition] = useState<number>(0);

  // Audio HTML5 Element
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [audioElementState, setAudioElementState] = useState<HTMLAudioElement | null>(null);
  const [isAudioPlaying, setIsAudioPlaying] = useState<boolean>(false);
  const [playbackStatus, setPlaybackStatus] = useState<'READY' | 'PLAYING' | 'PAUSED' | 'BUFFERING' | 'ERROR'>('READY');

  // Refs for timer loops
  const roomRef = useRef<Room | null>(null);
  const clockOffsetRef = useRef(0);
  const audioDelayRef = useRef(0);
  
  const isHost = room?.hostId === socket?.id || !!room?.participants?.find(p => p.username.toLowerCase() === username.toLowerCase() && p.isHost);
  const isCollaborative = room?.settings?.collaborativeMode ?? false;
  const isDjBoothMode = room?.settings?.djBoothMode ?? false;
  const activeDjUsername = room?.djs?.[room?.currentDjIndex || 0];
  const isCurrentDj = !!activeDjUsername && activeDjUsername.toLowerCase() === username.toLowerCase();
  
  // Host ALWAYS has control. In Collaborative mode, everyone has control unless DJ Booth mode is active. In DJ Booth mode, Current DJ + Host have control.
  const hasControl = isHost || (isCollaborative && !isDjBoothMode) || (isDjBoothMode && isCurrentDj);

  const offsetsRef = useRef<number[]>([]);

  useEffect(() => {
    roomRef.current = room;
  }, [room]);

  useEffect(() => {
    clockOffsetRef.current = clockOffset;
  }, [clockOffset]);

  useEffect(() => {
    audioDelayRef.current = audioDelay;
  }, [audioDelay]);

  // Load custom delay calibrations from client LocalStorage
  useEffect(() => {
    const saved = localStorage.getItem('syncroom_audio_delay');
    if (saved) {
      setAudioDelay(parseInt(saved) || 0);
    }
  }, []);

  const saveAudioDelay = (val: number) => {
    setAudioDelay(val);
    localStorage.setItem('syncroom_audio_delay', val.toString());
  };

  // Initialize Audio element with robust state listeners
  useEffect(() => {
    const audio = new Audio();
    audio.crossOrigin = 'anonymous';
    audio.preload = 'auto';
    audioRef.current = audio;
    setAudioElementState(audio);

    const onPlay = () => {
      setIsAudioPlaying(true);
      setPlaybackStatus('PLAYING');
    };
    const onPlaying = () => {
      setIsAudioPlaying(true);
      setPlaybackStatus('PLAYING');
    };
    const onPause = () => {
      setIsAudioPlaying(false);
      setPlaybackStatus('PAUSED');
    };
    const onEnded = () => {
      setIsAudioPlaying(false);
      setPlaybackStatus('PAUSED');
    };
    const onWaiting = () => {
      setPlaybackStatus('BUFFERING');
    };
    const onError = () => {
      setIsAudioPlaying(false);
      setPlaybackStatus('ERROR');
    };

    audio.addEventListener('play', onPlay);
    audio.addEventListener('playing', onPlaying);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('waiting', onWaiting);
    audio.addEventListener('error', onError);

    return () => {
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('playing', onPlaying);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('waiting', onWaiting);
      audio.removeEventListener('error', onError);
      audio.pause();
      audio.src = '';
      audioRef.current = null;
      setAudioElementState(null);
    };
  }, []);

  // Sync lyrics when current track changes
  useEffect(() => {
    const lyricsPath = room?.currentTrack?.lyricsUrl;
    if (!lyricsPath) {
      setLyrics([]);
      return;
    }

    const fetchLyricsFile = async () => {
      try {
        const fullUrl = lyricsPath.startsWith('http') ? lyricsPath : `${BACKEND_URL}${lyricsPath}`;
        const res = await fetch(fullUrl);
        if (res.ok) {
          const text = await res.text();
          
          // Parse LRC timestamp files (e.g. [01:23.45] lyric lines)
          const lines = text.split(/\r?\n/);
          const parsedLines: LyricLine[] = [];
          
          lines.forEach((line) => {
            const matches = Array.from(line.matchAll(/\[(\d+):(\d+(?:\.\d+)?)\]/g));
            const lyricText = line.replace(/\[\d+:\d+(?:\.\d+)?\]/g, '').trim();
            if (matches.length > 0 && lyricText) {
              matches.forEach((m) => {
                const mins = parseInt(m[1]);
                const secs = parseFloat(m[2]);
                parsedLines.push({
                  time: mins * 60 + secs,
                  text: lyricText,
                });
              });
            }
          });

          // Sort lines chronologically
          parsedLines.sort((a, b) => a.time - b.time);
          setLyrics(parsedLines);
        }
      } catch (e) {
        console.log('Failed to fetch/parse lyrics:', e);
      }
    };

    fetchLyricsFile();
  }, [room?.currentTrack?.id, room?.currentTrack?.lyricsUrl]);

  // Reaction spawn trigger
  const spawnReaction = (emoji: string) => {
    const id = Math.random().toString(36).substring(2, 9);
    setReactions((prev) => [
      ...prev,
      {
        id,
        emoji,
        x: Math.random() * 80 + 10,
      },
    ]);
    setTimeout(() => {
      setReactions((prev) => prev.filter((r) => r.id !== id));
    }, 2200);
  };

  // Initialize Socket.IO connection
  useEffect(() => {
    if (!roomId || !username) return;

    const newSocket = io(BACKEND_URL, {
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    });

    setSocket(newSocket);

    let connectionTimer: NodeJS.Timeout;

    newSocket.on('connect', () => {
      setIsConnected(true);
      setIsReconnecting(false);
      setError(null);

      // 8-Second Connection Safety Timeout
      connectionTimer = setTimeout(() => {
        if (!roomRef.current) {
          setError('Unable to connect to room space. Connection timed out or server unreachable.');
          newSocket.disconnect();
        }
      }, 8000);

      newSocket.emit(
        'room-join',
        { roomId, username, password: password || undefined },
        (res: { success: boolean; room?: Room; participant?: Participant; error?: string }) => {
          clearTimeout(connectionTimer);
          if (res.success && res.room && res.participant) {
            setRoom(res.room);
            setParticipant(res.participant);
            setChatMessages(res.room.chatHistory || []);
          } else {
            setError(res.error || 'Failed to join room');
            newSocket.disconnect();
          }
        }
      );

      performNtpSync(newSocket);
    });

    newSocket.on('disconnect', () => {
      setIsConnected(false);
      setIsReconnecting(true);
    });

    newSocket.on('connect_error', () => {
      setError('Connection failed. Server unreachable or offline.');
      setIsReconnecting(true);
    });

    newSocket.on('room-updated', (updatedRoom: Room) => {
      setRoom(updatedRoom);
    });

    newSocket.on('room-update', (data: { room: Room }) => {
      setRoom(data.room);
    });

    newSocket.on('presence-event', (data: { type: string; participant?: Participant; participantId?: string; room: Room }) => {
      setRoom(data.room);
    });

    newSocket.on('playback-sync', (data: { playback: PlaybackState; updatedBy: string }) => {
      setRoom((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          playback: data.playback,
        };
      });
    });

    newSocket.on('playback-updated', (playback: PlaybackState) => {
      setRoom((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          playback,
        };
      });
    });

    const handleKicked = (data?: { message?: string }) => {
      setError(data?.message || 'You were removed from this room by the host.');
      setRoom(null);
      newSocket.disconnect();
    };
    newSocket.on('kicked', handleKicked);
    newSocket.on('room-kicked', handleKicked);

    newSocket.on('room-deleted', (data: { message?: string }) => {
      setError(data.message || 'This room has been deleted by the host.');
      setRoom(null);
      newSocket.disconnect();
    });

    newSocket.on('chat-message', (data: ChatMessage) => {
      setChatMessages((prev) => [...prev, data]);
    });

    newSocket.on('room-reaction', (data: { emoji: string }) => {
      spawnReaction(data.emoji);
    });

    newSocket.on('activity-log', (data: { id: string; text: string; timestamp: number }) => {
      setActivityLog((prev) => [...prev, data].slice(-50));
    });

    // Notify invitation alert
    newSocket.on('friend-invite-received', (data: { roomId: string; hostName: string; friendName: string }) => {
      if (data.friendName.toLowerCase() === username.toLowerCase()) {
        alert(`🔔 Invite received from @${data.hostName} to join room "${data.roomId}"!`);
      }
    });

    return () => {
      newSocket.disconnect();
    };
  }, [roomId, username, password]);

  // NTP Clock sync loop
  const performNtpSync = (s: Socket) => {
    let syncCount = 0;
    const runPing = () => {
      if (!s.connected) return;
      s.emit('sync-ping', { clientTime: Date.now() });
    };

    s.on('sync-pong', (data: { clientTime: number; serverTime: number }) => {
      const now = Date.now();
      const rtt = now - data.clientTime;
      const oneWayLatency = rtt / 2;
      const offset = data.serverTime - (data.clientTime + oneWayLatency);

      const prevOffsets = [...offsetsRef.current, offset].slice(-8);
      offsetsRef.current = prevOffsets;

      const sortedOffsets = [...prevOffsets].sort((a, b) => a - b);
      const medianOffset = sortedOffsets[Math.floor(sortedOffsets.length / 2)];

      setLatency(oneWayLatency);
      setClockOffset(medianOffset);
      setSyncStatus(oneWayLatency > 150 ? 'unstable' : 'synced');

      syncCount++;
      const delay = syncCount < 5 ? 1000 : 10000;
      setTimeout(runPing, delay);
    });

    runPing();
  };

  // Reconcile playback state
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !room) return;

    const track = room.currentTrack;
    if (!track) {
      if (!audio.paused) audio.pause();
      audio.src = '';
      setIsAudioPlaying(false);
      setPlaybackStatus('READY');
      return;
    }

    if (track.source === 'youtube' || track.source === 'spotify') {
      if (!audio.paused) audio.pause();
      audio.src = '';
      return;
    }

    const resolveAudioUrl = (url: string) => {
      if (!url) return '';
      if (url.startsWith('http://') || url.startsWith('https://')) return url;
      if (url.startsWith('/audio/')) return url;
      return `${BACKEND_URL}${url.startsWith('/') ? '' : '/'}${url}`;
    };

    const audioSource = resolveAudioUrl(track.url);

    if (audio.src !== audioSource) {
      audio.src = audioSource;
      audio.load();
    }

    const { isPlaying } = room.playback;

    if (isPlaying) {
      if (audio.paused) {
        audio.play().catch((e) => console.log('Autoplay blocked:', e));
      }
    } else {
      if (!audio.paused) {
        audio.pause();
      }
    }
  }, [room?.currentTrack?.id, room?.currentTrack?.url, room?.playback?.isPlaying]);

  // Main Drift Correction Tick loop incorporating manual Audio Calibration
  useEffect(() => {
    const timer = setInterval(() => {
      const audio = audioRef.current;
      const activeRoom = roomRef.current;

      if (!activeRoom || !activeRoom.currentTrack) {
        setAuthoritativePosition(0);
        setDrift(0);
        return;
      }

      const duration = activeRoom.currentTrack.duration || 180;
      const serverTimeNow = Date.now() + clockOffsetRef.current;
      let targetPos = activeRoom.playback.position;

      if (activeRoom.playback.isPlaying) {
        const timeSinceUpdateMs = Math.max(0, serverTimeNow - activeRoom.playback.serverTimestamp);
        const delayOffsetSecs = audioDelayRef.current / 1000;
        targetPos = Math.min(duration, activeRoom.playback.position + (timeSinceUpdateMs / 1000) + delayOffsetSecs);
      }

      setAuthoritativePosition(targetPos);

      const isUpload = activeRoom.currentTrack.source === 'upload' || !activeRoom.currentTrack.source;

      if (isUpload && audio) {
        if (!activeRoom.playback.isPlaying) {
          setDrift(0);
          return;
        }

        const localPos = audio.currentTime;
        const currentDrift = localPos - targetPos;
        setDrift(Math.round(currentDrift * 1000));

        const absDrift = Math.abs(currentDrift);

        if (targetPos >= duration) {
          if (isHost && audio.currentTime >= duration - 0.5) {
            handleAutoEnd();
          }
          return;
        }

        if (absDrift > 1.5) {
          audio.currentTime = Math.max(0, targetPos);
          audio.playbackRate = 1.0;
        } else if (absDrift > 0.05) {
          if (currentDrift > 0) {
            audio.playbackRate = 0.95;
          } else {
            audio.playbackRate = 1.05;
          }
        } else {
          audio.playbackRate = 1.0;
        }
      } else {
        setDrift(0);
        if (targetPos >= duration && activeRoom.playback.isPlaying && isHost) {
          handleAutoEnd();
        }
      }
    }, 250);

    return () => clearInterval(timer);
  }, [room?.roomId, isHost]);

  // Audio HTML5 ended listener
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const handleAudioEnded = () => {
      if (isHost || (roomRef.current?.settings.collaborativeMode)) {
        handleAutoEnd();
      }
    };
    audio.addEventListener('ended', handleAudioEnded);
    return () => {
      audio.removeEventListener('ended', handleAudioEnded);
    };
  }, [isHost]);

  // Auto-end transition or loop
  const handleAutoEnd = (shuffle?: boolean) => {
    if (!socket || !roomRef.current) return;
    socket.emit('playback-next', { roomId: roomRef.current.roomId, isAutoEnd: true, shuffle }, (res: { success: boolean; error?: string; looped?: boolean }) => {
      if (res && !res.success && res.error) console.log('[AutoEnd Error]', res.error);
    });
  };

  // Emitters and Controllers
  const togglePlayPause = () => {
    if (!socket || !room || !hasControl) return;

    const willPlay = !room.playback.isPlaying;
    const isHtmlAudio = room.currentTrack?.source === 'upload' || !room.currentTrack?.source;

    if (isHtmlAudio && audioRef.current) {
      if (willPlay) {
        // Direct execution in user click gesture avoids Autoplay blocking
        const playPromise = audioRef.current.play();
        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              setIsAudioPlaying(true);
              setPlaybackStatus('PLAYING');
            })
            .catch((err) => {
              console.warn('[Audio Play Promise Note]', err);
            });
        }
      } else {
        audioRef.current.pause();
        setIsAudioPlaying(false);
        setPlaybackStatus('PAUSED');
      }
    }

    const position = isHtmlAudio && audioRef.current ? audioRef.current.currentTime : authoritativePosition;

    socket.emit('playback-state-change', {
      roomId: room.roomId,
      isPlaying: willPlay,
      position,
    }, (res: { success: boolean; error?: string }) => {
      if (res && !res.success && res.error) console.error(res.error);
    });
  };

  const setExternalPlaybackState = (
    playing: boolean,
    status?: 'READY' | 'PLAYING' | 'PAUSED' | 'BUFFERING' | 'ERROR'
  ) => {
    setIsAudioPlaying(playing);
    if (status) {
      setPlaybackStatus(status);
    } else {
      setPlaybackStatus(playing ? 'PLAYING' : 'PAUSED');
    }
  };

  const seek = (seconds: number) => {
    if (!socket || !room || !hasControl) return;

    const isPlaying = room.playback.isPlaying;
    const isHtmlAudio = room.currentTrack?.source === 'upload' || !room.currentTrack?.source;
    if (isHtmlAudio && audioRef.current) {
      audioRef.current.currentTime = seconds;
    }
    setAuthoritativePosition(seconds);

    socket.emit('playback-state-change', {
      roomId: room.roomId,
      isPlaying,
      position: seconds,
    }, (res: { success: boolean; error?: string }) => {
      if (!res.success) alert(res.error);
    });
  };

  const prevTrack = () => {
    if (!socket || !room || !hasControl) return;
    const isHtmlAudio = room.currentTrack?.source === 'upload' || !room.currentTrack?.source;
    const currentPos = isHtmlAudio && audioRef.current ? audioRef.current.currentTime : authoritativePosition;

    if (currentPos > 3) {
      seek(0);
      return;
    }

    socket.emit('playback-prev', { roomId: room.roomId, currentPosition: currentPos }, (res: { success: boolean; error?: string }) => {
      if (res && !res.success && res.error) alert(res.error);
    });
  };

  const nextTrack = (shuffle?: boolean) => {
    if (!socket || !room || !hasControl) return;
    socket.emit('playback-next', { roomId: room.roomId, isAutoEnd: false, shuffle }, (res: { success: boolean; error?: string }) => {
      if (res && !res.success && res.error) alert(res.error);
    });
  };

  const toggleLoop = () => {
    if (!socket || !room || !hasControl) return;
    const nextLoop = !room.playback.loopCurrentTrack;
    socket.emit('playback-loop', { roomId: room.roomId, loop: nextLoop }, (res: { success: boolean; error?: string }) => {
      if (res && !res.success && res.error) alert(res.error);
    });
  };

  const toggleQueueItemLoop = (trackId: string) => {
    if (!socket || !room || !hasControl) return;
    socket.emit('queue-loop-toggle', { roomId: room.roomId, trackId }, (res: { success: boolean; error?: string }) => {
      if (res && !res.success && res.error) alert(res.error);
    });
  };

  const addToQueue = (track: Track) => {
    if (!socket || !room) return;
    socket.emit('queue-add', { roomId: room.roomId, track }, (res: { success: boolean; error?: string; approved?: boolean }) => {
      if (res && !res.success && res.error) alert(res.error);
    });
  };

  const updateQueue = (newQueue: Track[]) => {
    if (!socket || !room || !isHost) return;
    socket.emit('queue-update', { roomId: room.roomId, queue: newQueue });
  };

  const removeFromQueue = (trackId: string) => {
    if (!socket || !room) return;
    socket.emit('queue-remove', { roomId: room.roomId, trackId }, (res: { success: boolean; error?: string }) => {
      if (res && !res.success && res.error) alert(res.error);
    });
  };

  const voteTrack = (trackId: string, voteType: 'up' | 'down' | 'none') => {
    if (!socket || !room) return;
    socket.emit('queue-vote', { roomId: room.roomId, trackId, voteType, username });
  };

  const approveTrack = (trackId: string) => {
    if (!socket || !room || !isHost) return;
    socket.emit('track-approve', { roomId: room.roomId, trackId }, (res: { success: boolean; error?: string }) => {
      if (res && !res.success && res.error) alert(res.error);
    });
  };

  const sendChatMessage = (message: string, replyToId?: string, replyToUser?: string) => {
    if (!socket || !room) return;
    socket.emit('chat-message', { roomId: room.roomId, username, message, replyToId, replyToUser });
  };

  const sendReaction = (emoji: string) => {
    if (!socket || !room) return;
    socket.emit('room-reaction', { roomId: room.roomId, username, emoji });
  };

  const updateTheme = (theme: string) => {
    if (!socket || !room || !isHost) return;
    socket.emit('theme-update', { roomId: room.roomId, theme });
  };

  const startScheduledRoom = () => {
    if (!socket || !room || !isHost) return;
    socket.emit('scheduled-start', { roomId: room.roomId });
  };

  const joinDjBooth = () => {
    if (!socket || !room) return;
    socket.emit('dj-join', { roomId: room.roomId, username });
  };

  const leaveDjBooth = () => {
    if (!socket || !room) return;
    socket.emit('dj-leave', { roomId: room.roomId, username });
  };

  const skipDjTurn = () => {
    if (!socket || !room || !isHost) return;
    socket.emit('dj-skip', { roomId: room.roomId });
  };

  const leaveRoom = () => {
    if (socket && room) {
      socket.emit('room-leave', { roomId: room.roomId });
    }
  };

  const sendFriendInvite = (friendName: string) => {
    if (!socket || !room) return;
    socket.emit('friend-invite', { roomId: room.roomId, username, friendName });
  };

  const kickParticipant = (targetId: string, targetUsername?: string) => {
    if (!socket || !room || !isHost) return;
    socket.emit('room-kick', { roomId: room.roomId, targetId, targetUsername }, (res: { success: boolean; error?: string }) => {
      if (res && !res.success && res.error) alert(res.error);
    });
  };

  const transferHost = (targetId: string) => {
    if (!socket || !room || !isHost) return;
    socket.emit('host-transfer', { roomId: room.roomId, targetId });
  };

  const updateSettings = (settings: Partial<RoomSettings>) => {
    if (!socket || !room || !isHost) return;
    socket.emit('settings-update', { roomId: room.roomId, settings });
  };

  // Upload track accepting optional second lyrics .lrc file in form-data
  const uploadTrack = async (file: File, lyricsFile?: File): Promise<Track> => {
    if (!room) throw new Error('No room active');

    const allowedAudio = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/mp4', 'audio/m4a', 'audio/x-m4a'];
    if (!allowedAudio.includes(file.type) && !file.name.match(/\.(mp3|wav|ogg|m4a)$/i)) {
      throw new Error('Unsupported audio format.');
    }

    if (file.size > 20 * 1024 * 1024) {
      throw new Error('Audio file exceeds 20MB limit.');
    }

    if (lyricsFile && !lyricsFile.name.match(/\.(lrc|txt)$/i)) {
      throw new Error('Lyrics file must be .LRC or .TXT');
    }

    const fileUrl = URL.createObjectURL(file);
    const audioObj = new Audio(fileUrl);
    
    const duration = await new Promise<number>((resolve) => {
      audioObj.addEventListener('loadedmetadata', () => {
        resolve(audioObj.duration);
        URL.revokeObjectURL(fileUrl);
      });
      audioObj.addEventListener('error', () => {
        resolve(0);
        URL.revokeObjectURL(fileUrl);
      });
    });

    const formData = new FormData();
    formData.append('audio', file);
    if (lyricsFile) {
      formData.append('lyrics', lyricsFile);
    }
    formData.append('roomId', room.roomId);
    formData.append('title', file.name.replace(/\.[^/.]+$/, ''));
    formData.append('artist', username);
    formData.append('duration', duration.toString());
    formData.append('uploadedBy', username);

    const track = await safeFetchJson('/api/upload', {
      method: 'POST',
      body: formData,
    });

    return track;
  };

  return {
    room,
    participant,
    isHost,
    isConnected,
    isReconnecting,
    error,
    latency,
    clockOffset,
    drift,
    syncStatus,
    chatMessages,
    activityLog,
    reactions,
    audioDelay,
    lyrics,
    authoritativePosition,
    audioElement: audioElementState,
    isAudioPlaying,
    playbackStatus,
    setExternalPlaybackState,
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
    skipDjTurn,
    leaveRoom,
    sendFriendInvite,
    kickParticipant,
    transferHost,
    updateSettings,
    uploadTrack,
    saveAudioDelay,
    socket,
  };
}
