export type TrackSource = 'upload' | 'spotify' | 'youtube';

export interface Track {
  id: string;
  title: string;
  artist: string;
  duration: number; // in seconds
  url: string; // url to stream/download
  source: TrackSource; // 'upload' | 'spotify' | 'youtube'
  spotifyUri?: string; // e.g. spotify:track:6rqhFgbbK86udmRqvY8OCB
  youtubeId?: string; // e.g. dQw4w9WgXcQ
  thumbnailUrl?: string; // thumbnail image URL
  uploadedBy: string; // username
  votes: { [username: string]: 'up' | 'down' }; // record of user votes
  voteCount: number; // accumulated up - down votes
  approved: boolean; // false if host approval is required and track has not been approved
  lyricsUrl?: string; // path to optional synced lyrics file (.LRC)
}

export interface PlaybackState {
  isPlaying: boolean;
  position: number; // position in seconds
  serverTimestamp: number; // time when state was recorded
}

export interface Participant {
  id: string; // socket.id
  username: string;
  isHost: boolean;
  isOnline: boolean;
  avatarUrl?: string; // custom profile avatar url
}

export interface RoomSettings {
  isPrivate: boolean;
  password?: string;
  maxParticipants: number;
  collaborativeMode: boolean; // if true, non-hosts can add to queue/vote/chat/react
  // Social
  enableChat: boolean;
  enableReactions: boolean;
  enableVoting: boolean;
  // Moderation
  allowEveryoneToAddSongs: boolean;
  allowEveryoneToSkip: boolean;
  hostApprovalRequired: boolean;
  autoPickNext: boolean; // pick top-voted track next on end
  djBoothMode?: boolean; // if true, queue control rotates between DJs in booth
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
  theme?: string;
  djs?: string[];
  currentDjIndex?: number;
  scheduledStartTime?: number;
  isStarted?: boolean;
}

export interface UserAccount {
  id: string;
  email: string;
  passwordHash: string;
  username: string;
  avatar: string;
  bio?: string;
  createdAt: number;
  optedOutStats?: boolean;
}

export interface FriendRelationship {
  id: string;
  user1: string;
  user2: string;
  status: string;
  createdAt: number;
}

export interface PlayHistoryEntry {
  id: string;
  username: string;
  trackTitle: string;
  artist: string;
  durationMinutes: number;
  roomName: string;
  timestamp: number;
}
