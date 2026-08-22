'use client';

import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

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
}

export interface PlaybackState {
  isPlaying: boolean;
  position: number;
  serverTimestamp: number;
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

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';

export function useSyncPlayer(roomId: string, username: string) {
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

  // Audio HTML5 Element
  const audioRef = useRef<HTMLAudioElement | null>(null);

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

  // Initialize Audio element
  useEffect(() => {
    const audio = new Audio();
    audio.crossOrigin = 'anonymous';
    audio.preload = 'auto';
    audioRef.current = audio;

    return () => {
      audio.pause();
      audio.src = '';
      audioRef.current = null;
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
        { roomId, username },
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

    newSocket.on('kicked', () => {
      setError('You have been kicked by the host.');
      setRoom(null);
      newSocket.disconnect();
    });

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
  }, [roomId, username]);

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
    if (!track || track.source === 'youtube' || track.source === 'spotify') {
      if (!audio.paused) audio.pause();
      audio.src = '';
      return;
    }

    const audioSource = track.url.startsWith('http') ? track.url : `${BACKEND_URL}${track.url}`;

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
  }, [room?.currentTrack?.id, room?.playback?.isPlaying]);

  // Main Drift Correction Tick loop incorporating manual Audio Calibration
  useEffect(() => {
    const timer = setInterval(() => {
      const audio = audioRef.current;
      const activeRoom = roomRef.current;

      if (!audio || !activeRoom || !activeRoom.currentTrack || !activeRoom.playback.isPlaying) {
        setDrift(0);
        return;
      }

      const serverTimeNow = Date.now() + clockOffsetRef.current;
      const timeSinceUpdateMs = serverTimeNow - activeRoom.playback.serverTimestamp;
      
      // Calculate target position adding manual Audio Delay calibration calibration
      const delayOffsetSecs = audioDelayRef.current / 1000;
      const targetPos = activeRoom.playback.position + (timeSinceUpdateMs / 1000) + delayOffsetSecs;

      const localPos = audio.currentTime;
      const currentDrift = localPos - targetPos;
      setDrift(Math.round(currentDrift * 1000));

      const absDrift = Math.abs(currentDrift);

      if (targetPos >= activeRoom.currentTrack.duration) {
        if (isHost && audio.currentTime >= activeRoom.currentTrack.duration - 0.5) {
          nextTrack();
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
    }, 250);

    return () => clearInterval(timer);
  }, [room?.roomId, isHost]);

  // Emitters and Controllers
  const togglePlayPause = () => {
    if (!socket || !room || !hasControl) return;

    const audio = audioRef.current;
    if (!audio) return;

    const isPlaying = !room.playback.isPlaying;
    const position = audio.currentTime;

    socket.emit('playback-state-change', {
      roomId: room.roomId,
      isPlaying,
      position,
    }, (res: { success: boolean; error?: string }) => {
      if (!res.success) alert(res.error);
    });
  };

  const seek = (seconds: number) => {
    if (!socket || !room || !hasControl) return;

    const isPlaying = room.playback.isPlaying;
    socket.emit('playback-state-change', {
      roomId: room.roomId,
      isPlaying,
      position: seconds,
    }, (res: { success: boolean; error?: string }) => {
      if (!res.success) alert(res.error);
    });
  };

  const nextTrack = () => {
    if (!socket || !room) return;
    
    const canSkip = isHost || (room.settings.collaborativeMode && room.settings.allowEveryoneToSkip);
    if (!canSkip) {
      alert('Only the host can skip tracks.');
      return;
    }

    socket.emit('playback-next', { roomId: room.roomId }, (res: { success: boolean; error?: string }) => {
      if (!res.success) alert(res.error);
    });
  };

  const addToQueue = (track: Track) => {
    if (!socket || !room) return;

    const canAdd = isHost || (room.settings.collaborativeMode && room.settings.allowEveryoneToAddSongs);
    if (!canAdd) {
      alert('Only the host can add tracks.');
      return;
    }

    socket.emit('queue-add', { roomId: room.roomId, track }, (res: { success: boolean; error?: string }) => {
      if (!res.success) alert(res.error);
    });
  };

  const updateQueue = (newQueue: Track[]) => {
    if (!socket || !room || !isHost) return;
    socket.emit('queue-update', { roomId: room.roomId, queue: newQueue });
  };

  const removeFromQueue = (trackId: string) => {
    if (!socket || !room) return;
    socket.emit('queue-remove', { roomId: room.roomId, trackId });
  };

  const voteTrack = (trackId: string, voteType: 'up' | 'down' | 'none') => {
    if (!socket || !room) return;
    socket.emit('queue-vote', { roomId: room.roomId, trackId, voteType, username });
  };

  const approveTrack = (trackId: string) => {
    if (!socket || !room || !isHost) return;
    socket.emit('track-approve', { roomId: room.roomId, trackId });
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

  const kickParticipant = (targetId: string) => {
    if (!socket || !room || !isHost) return;
    socket.emit('participant-kick', { roomId: room.roomId, targetId });
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

    const response = await fetch(`${BACKEND_URL}/api/upload`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errRes = await response.json();
      throw new Error(errRes.error || 'Upload failed');
    }

    const track = await response.json();
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
    audioElement: audioRef.current,
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
