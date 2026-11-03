export interface MockTrack {
  id: string;
  title: string;
  artist: string;
  album: string;
  duration: number; // in seconds
  durationFormatted: string;
  coverUrl: string;
  audioUrl?: string;
  genre: string;
  isLiked?: boolean;
}

export interface MockRoom {
  id: string;
  code: string;
  name: string;
  description: string;
  hostUsername: string;
  hostAvatar: string;
  listenersCount: number;
  maxListeners: number;
  currentTrack: MockTrack;
  isPrivate: boolean;
  genre: string;
  tags: string[];
}

export interface MockUser {
  id: string;
  username: string;
  displayName: string;
  avatarColor: string;
  status: string;
  isOnline: boolean;
  topGenre: string;
  roomsJoined: number;
}

export const MOCK_TRACKS: MockTrack[] = [
  {
    id: 'track-1',
    title: 'Sweater Weather',
    artist: 'The Neighbourhood',
    album: 'I Love You.',
    duration: 240,
    durationFormatted: '4:00',
    coverUrl: '/sweater_weather.jpg',
    genre: 'Indie Rock',
    isLiked: true,
  },
  {
    id: 'track-2',
    title: 'Blinding Lights',
    artist: 'The Weeknd',
    album: 'After Hours',
    duration: 200,
    durationFormatted: '3:20',
    coverUrl: 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?auto=format&fit=crop&w=300&q=80',
    genre: 'Synthwave',
    isLiked: false,
  },
  {
    id: 'track-3',
    title: 'Levitating',
    artist: 'Dua Lipa',
    album: 'Future Nostalgia',
    duration: 203,
    durationFormatted: '3:23',
    coverUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=300&q=80',
    genre: 'Pop / Disco',
    isLiked: true,
  },
  {
    id: 'track-4',
    title: 'Midnight City',
    artist: 'M83',
    album: 'Hurry Up, We’re Dreaming',
    duration: 243,
    durationFormatted: '4:03',
    coverUrl: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=300&q=80',
    genre: 'Electronic',
    isLiked: false,
  },
  {
    id: 'track-5',
    title: 'Starboy',
    artist: 'The Weeknd ft. Daft Punk',
    album: 'Starboy',
    duration: 230,
    durationFormatted: '3:50',
    coverUrl: 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?auto=format&fit=crop&w=300&q=80',
    genre: 'R&B / Electronic',
    isLiked: false,
  },
  {
    id: 'track-6',
    title: 'Lost in Yesterday',
    artist: 'Tame Impala',
    album: 'The Slow Rush',
    duration: 249,
    durationFormatted: '4:09',
    coverUrl: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&w=300&q=80',
    genre: 'Psychedelic Pop',
    isLiked: true,
  },
];

export const MOCK_ROOMS: MockRoom[] = [
  {
    id: 'rm-1',
    code: 'SUNSET',
    name: 'Sunset Rooftop Chill',
    description: 'Golden hour ambient beats and acoustic indie tracks with friends.',
    hostUsername: 'ElenaVibes',
    hostAvatar: '#FF9F43',
    listenersCount: 14,
    maxListeners: 20,
    currentTrack: MOCK_TRACKS[0],
    isPrivate: false,
    genre: 'Indie / Chill',
    tags: ['Sunset', 'Indie', 'Acoustic'],
  },
  {
    id: 'rm-2',
    code: 'NEON88',
    name: 'Midnight Cyber Lounge',
    description: 'Late night synthwave, retrowave, and deep electronic grooves.',
    hostUsername: 'KaiSynth',
    hostAvatar: '#00F0FF',
    listenersCount: 9,
    maxListeners: 15,
    currentTrack: MOCK_TRACKS[1],
    isPrivate: false,
    genre: 'Synthwave',
    tags: ['Night', 'Synthwave', 'Bass'],
  },
  {
    id: 'rm-3',
    code: 'LOFI42',
    name: 'Coffee & Code Lo-Fi',
    description: 'Relaxing instrumental beats for focus, studying, and deep work.',
    hostUsername: 'SamDev',
    hostAvatar: '#00FF9D',
    listenersCount: 18,
    maxListeners: 25,
    currentTrack: MOCK_TRACKS[3],
    isPrivate: false,
    genre: 'Lo-Fi',
    tags: ['Study', 'Chill', 'Lo-Fi'],
  },
  {
    id: 'rm-4',
    code: 'GROOVE',
    name: 'Future Disco Party',
    description: 'High energy dance, pop, and nu-disco tracks to get moving.',
    hostUsername: 'DJMaya',
    hostAvatar: '#A855F7',
    listenersCount: 22,
    maxListeners: 30,
    currentTrack: MOCK_TRACKS[2],
    isPrivate: false,
    genre: 'Pop / Disco',
    tags: ['Party', 'Dance', 'Upbeat'],
  },
  {
    id: 'rm-5',
    code: 'VIP999',
    name: 'Private Studio Session',
    description: 'Exclusive listening party for new unreleased demo tracks.',
    hostUsername: 'Ankit',
    hostAvatar: '#FF5E7E',
    listenersCount: 4,
    maxListeners: 10,
    currentTrack: MOCK_TRACKS[4],
    isPrivate: true,
    genre: 'R&B',
    tags: ['Private', 'Demos', 'VIP'],
  },
];

export const MOCK_USERS: MockUser[] = [
  {
    id: 'u-1',
    username: 'ElenaVibes',
    displayName: 'Elena Vance',
    avatarColor: '#FF9F43',
    status: 'Listening to Sweater Weather 🌆',
    isOnline: true,
    topGenre: 'Indie Rock',
    roomsJoined: 34,
  },
  {
    id: 'u-2',
    username: 'KaiSynth',
    displayName: 'Kai Morrison',
    avatarColor: '#00F0FF',
    status: 'Producing new synth tracks ⚡',
    isOnline: true,
    topGenre: 'Synthwave',
    roomsJoined: 52,
  },
  {
    id: 'u-3',
    username: 'SamDev',
    displayName: 'Sam Thorne',
    avatarColor: '#00FF9D',
    status: 'Coding with lo-fi beats ☕',
    isOnline: false,
    topGenre: 'Lo-Fi',
    roomsJoined: 19,
  },
  {
    id: 'u-4',
    username: 'DJMaya',
    displayName: 'Maya Lin',
    avatarColor: '#A855F7',
    status: 'Curating the weekend queue 🎧',
    isOnline: true,
    topGenre: 'Future Disco',
    roomsJoined: 88,
  },
];
