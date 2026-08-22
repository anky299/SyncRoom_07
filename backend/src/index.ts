import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { roomManager } from './roomManager';
import { Track, UserAccount } from './types';
import { db } from './db';
import { prisma } from './prisma';

const app = express();
const PORT = process.env.PORT || 4000;

const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID || '';
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET || '';
const SPOTIFY_REDIRECT_URI = process.env.SPOTIFY_REDIRECT_URI || 'http://localhost:3000/api/auth/spotify/callback';
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY || '';

app.use(cors({ origin: '*', credentials: true }));
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
    return;
  }
  next();
});
app.use(express.json());

// Ensure uploads folder exists
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Serve uploaded files statically with explicit CORS header
app.use('/uploads', cors({ origin: '*' }), express.static(uploadsDir));

// Multer storage configuration
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `${uniqueSuffix}${ext}`);
  },
});

// Multer file filter (allow audio and .lrc/txt lyrics files)
const fileFilter = (_req: express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedExtensions = /\.(mp3|wav|ogg|m4a|lrc|txt)$/i;
  if (file.originalname.match(allowedExtensions)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Supported: MP3, WAV, OGG, M4A, and LRC/TXT lyrics.'));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 20 * 1024 * 1024, // 20MB limit
  },
});

// Password hashing helper (self-contained SHA-256)
function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}



// --- HTTP REST ENDPOINTS ---

// Auth Register
app.post('/api/auth/register', async (req, res) => {
  try {
    const email = (req.body.email || '').trim();
    const password = (req.body.password || '').trim();
    const username = (req.body.username || '').trim();
    const avatar = req.body.avatar;

    if (!email || !password || !username) {
      return res.status(400).json({ error: 'Email, password, and username are required' });
    }

    const existingEmail = await db.findUserByEmail(email);
    if (existingEmail) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    const existingUsername = await db.findUserByUsername(username);
    if (existingUsername) {
      return res.status(400).json({ error: 'Username already taken' });
    }

    const newUser: UserAccount = {
      id: Math.random().toString(36).substring(2, 9),
      email: email.toLowerCase(),
      passwordHash: hashPassword(password),
      username: username,
      avatar: avatar || '#00F0FF',
      createdAt: Date.now(),
    };

    await db.saveUser(newUser);

    // Omit password hash on response
    const { passwordHash, ...userRes } = newUser;
    return res.status(200).json(userRes);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Registration failed' });
  }
});

// Auth Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const email = (req.body.email || '').trim();
    const password = (req.body.password || '').trim();

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await db.findUserByEmail(email);
    if (!user || user.passwordHash !== hashPassword(password)) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const { passwordHash, ...userRes } = user;
    return res.status(200).json(userRes);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Login failed' });
  }
});

// SPOTIFY OAUTH AUTHENTICATION ENDPOINTS
app.get('/api/auth/spotify/login', (_req, res) => {
  const scope = 'user-read-private user-read-email streaming user-modify-playback-state user-read-playback-state';
  const queryParams = new URLSearchParams({
    response_type: 'code',
    client_id: SPOTIFY_CLIENT_ID || 'demo_client_id',
    scope: scope,
    redirect_uri: SPOTIFY_REDIRECT_URI,
  });
  res.redirect(`https://accounts.spotify.com/authorize?${queryParams.toString()}`);
});

app.get('/api/auth/spotify/callback', async (req, res) => {
  const code = req.query.code as string;
  if (!code) {
    return res.redirect('/?spotify_error=no_code');
  }

  try {
    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64')}`,
      },
      body: new URLSearchParams({
        code,
        redirect_uri: SPOTIFY_REDIRECT_URI,
        grant_type: 'authorization_code',
      }),
    });

    const data = (await response.json()) as any;
    if (data.access_token) {
      return res.redirect(`/?spotify_access_token=${encodeURIComponent(data.access_token)}`);
    }
    return res.redirect('/?spotify_error=auth_failed');
  } catch (err) {
    return res.redirect('/?spotify_error=server_error');
  }
});

// SPOTIFY SEARCH ENDPOINT
app.get('/api/spotify/search', async (req, res) => {
  const query = req.query.q as string;
  if (!query) return res.json([]);

  try {
    // Client Credentials Token for search
    let token = req.headers.authorization?.replace('Bearer ', '');
    if (!token && SPOTIFY_CLIENT_ID && SPOTIFY_CLIENT_SECRET) {
      const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64')}`,
        },
        body: new URLSearchParams({ grant_type: 'client_credentials' }),
      });
      const tokenData = (await tokenRes.json()) as any;
      token = tokenData.access_token;
    }

    if (!token) {
      // Fallback mock Spotify search results if API keys aren't set
      return res.json([
        {
          id: 'sp_1',
          title: `${query} (Spotify Remaster)`,
          artist: 'The Weeknd',
          duration: 230,
          url: 'spotify:track:6rqhFgbbK86udmRqvY8OCB',
          source: 'spotify',
          spotifyUri: 'spotify:track:6rqhFgbbK86udmRqvY8OCB',
          thumbnailUrl: 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?auto=format&fit=crop&w=150&q=80',
        },
        {
          id: 'sp_2',
          title: `${query} (Live Studio)`,
          artist: 'Dua Lipa',
          duration: 215,
          url: 'spotify:track:0VjIjW4GlUZAMYd2vXMi3b',
          source: 'spotify',
          spotifyUri: 'spotify:track:0VjIjW4GlUZAMYd2vXMi3b',
          thumbnailUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=150&q=80',
        },
      ]);
    }

    const searchRes = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=10`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const searchData = (await searchRes.json()) as any;

    const tracks = (searchData.tracks?.items || []).map((item: any) => ({
      id: item.id,
      title: item.name,
      artist: item.artists.map((a: any) => a.name).join(', '),
      duration: Math.round(item.duration_ms / 1000),
      url: item.uri,
      source: 'spotify',
      spotifyUri: item.uri,
      thumbnailUrl: item.album?.images?.[0]?.url || '',
    }));

    return res.json(tracks);
  } catch (e) {
    return res.json([]);
  }
});

// YOUTUBE SEARCH ENDPOINT (Production Multi-Tiered Pipeline)
app.get('/api/youtube/search', async (req, res) => {
  const query = (req.query.q as string || '').trim();
  if (!query) return res.json([]);

  // Tier 1: Official YouTube Data API v3 (If YOUTUBE_API_KEY is configured in env)
  try {
    if (YOUTUBE_API_KEY) {
      const searchRes = await fetch(
        `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=10&q=${encodeURIComponent(query)}&key=${YOUTUBE_API_KEY}`
      );
      if (searchRes.ok) {
        const searchData = (await searchRes.json()) as any;
        const results = (searchData.items || []).map((item: any) => ({
          id: item.id.videoId,
          title: item.snippet.title,
          artist: item.snippet.channelTitle,
          duration: 240,
          url: item.id.videoId,
          source: 'youtube',
          youtubeId: item.id.videoId,
          thumbnailUrl: item.snippet.thumbnails?.high?.url || item.snippet.thumbnails?.default?.url,
        }));
        if (results.length > 0) {
          console.log(`[YOUTUBE SEARCH - TIER 1 API] Found ${results.length} results for "${query}"`);
          return res.json(results);
        }
      }
    }
  } catch (err: any) {
    console.log('[YOUTUBE SEARCH - TIER 1 NOTICE]', err.message);
  }

  // Tier 2: Public Piped / Invidious API Mirror (Cloud-friendly JSON endpoint)
  try {
    const pipedRes = await fetch(`https://pipedapi.kavin.rocks/search?q=${encodeURIComponent(query)}&filter=videos`, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    if (pipedRes.ok) {
      const pipedData = (await pipedRes.json()) as any;
      const items = pipedData.items || [];
      const results: any[] = [];
      for (const item of items) {
        const vId = item.url ? item.url.replace('/watch?v=', '') : item.id;
        if (vId) {
          results.push({
            id: vId,
            title: item.title || query,
            artist: item.uploaderName || 'YouTube Artist',
            duration: item.duration || 210,
            url: vId,
            source: 'youtube',
            youtubeId: vId,
            thumbnailUrl: item.thumbnail || `https://i.ytimg.com/vi/${vId}/hqdefault.jpg`,
          });
        }
      }
      if (results.length > 0) {
        console.log(`[YOUTUBE SEARCH - TIER 2 PIPED] Found ${results.length} results for "${query}"`);
        return res.json(results.slice(0, 10));
      }
    }
  } catch (err: any) {
    console.log('[YOUTUBE SEARCH - TIER 2 NOTICE]', err.message);
  }

  // Tier 3: Mobile User-Agent HTML Extraction (Bypasses desktop bot-checks)
  try {
    const ytRes = await fetch(`https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 12; gts7xl) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });
    if (ytRes.ok) {
      const html = await ytRes.text();
      const match = html.match(/var ytInitialData = ({.*?});<\/script>/s) || html.match(/ytInitialData"\s*:\s*({.*?});/s);
      if (match) {
        const data = JSON.parse(match[1]);
        const contents = data.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents?.[0]?.itemSectionRenderer?.contents || [];
        const results: any[] = [];
        for (const item of contents) {
          if (item.videoRenderer && item.videoRenderer.videoId) {
            const v = item.videoRenderer;
            const vId = v.videoId;
            results.push({
              id: vId,
              title: v.title?.runs?.[0]?.text || query,
              artist: v.ownerText?.runs?.[0]?.text || 'YouTube Artist',
              duration: 210,
              url: vId,
              source: 'youtube',
              youtubeId: vId,
              thumbnailUrl: v.thumbnail?.thumbnails?.[0]?.url || `https://i.ytimg.com/vi/${vId}/hqdefault.jpg`,
            });
          }
        }
        if (results.length > 0) {
          console.log(`[YOUTUBE SEARCH - TIER 3 SCRAPER] Found ${results.length} results for "${query}"`);
          return res.json(results.slice(0, 10));
        }
      }
    }
  } catch (err: any) {
    console.log('[YOUTUBE SEARCH - TIER 3 NOTICE]', err.message);
  }

  // Tier 4: Fallback Catalog for High Relevance Popular Matches
  console.log(`[YOUTUBE SEARCH - TIER 4 FALLBACK] Returning verified track catalog for "${query}"`);
  const catalog = [
    { id: '4NRXx6U8ABQ', title: 'Blinding Lights', artist: 'The Weeknd', duration: 200, youtubeId: '4NRXx6U8ABQ' },
    { id: 'TUVcZfQe-Kw', title: 'Levitating', artist: 'Dua Lipa', duration: 203, youtubeId: 'TUVcZfQe-Kw' },
    { id: 'JGwWNGJdvx8', title: 'Shape of You', artist: 'Ed Sheeran', duration: 233, youtubeId: 'JGwWNGJdvx8' },
    { id: 'G7KNmW9a75A', title: 'Flowers', artist: 'Miley Cyrus', duration: 200, youtubeId: 'G7KNmW9a75A' },
    { id: '34Na4j8AVgA', title: 'Starboy', artist: 'The Weeknd ft. Daft Punk', duration: 230, youtubeId: '34Na4j8AVgA' },
    { id: 'kTJczUoc5C0', title: 'Stay', artist: 'The Kid LAROI & Justin Bieber', duration: 141, youtubeId: 'kTJczUoc5C0' },
  ];

  const matched = catalog.filter((item) => item.title.toLowerCase().includes(query.toLowerCase()) || item.artist.toLowerCase().includes(query.toLowerCase()));
  const finalResults = matched.length > 0 ? matched : catalog;

  return res.json(
    finalResults.map((item) => ({
      ...item,
      source: 'youtube',
      url: item.youtubeId,
      thumbnailUrl: `https://i.ytimg.com/vi/${item.youtubeId}/hqdefault.jpg`,
    }))
  );
});

// Single Track File Upload
app.post('/api/tracks/upload', upload.fields([
  { name: 'audio', maxCount: 1 },
  { name: 'lyrics', maxCount: 1 }
]), (req, res) => {
  try {
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    const audioFile = files['audio']?.[0];
    const lyricsFile = files['lyrics']?.[0];

    if (!audioFile) {
      return res.status(400).json({ error: 'Audio file is required' });
    }

    const audioUrl = `/uploads/${audioFile.filename}`;
    const lyricsUrl = lyricsFile ? `/uploads/${lyricsFile.filename}` : undefined;

    const newTrack: Track = {
      id: Math.random().toString(36).substring(2, 9),
      title: path.parse(audioFile.originalname).name,
      artist: (req.body.uploadedBy as string) || 'Guest',
      duration: 180,
      url: audioUrl,
      source: 'upload',
      uploadedBy: (req.body.uploadedBy as string) || 'Guest',
      votes: {},
      voteCount: 0,
      approved: true,
      lyricsUrl,
    };

    return res.status(200).json(newTrack);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'File upload failed' });
  }
});

// User Profile Stats Endpoint
app.get('/api/stats', (req, res) => {
  const username = req.query.username as string;
  if (!username) return res.status(400).json({ error: 'Username required' });

  const history = db.getHistory().filter((h) => h.username.toLowerCase() === username.toLowerCase());
  const roomHistory = db.getRoomHistory(username);

  return res.json({
    history,
    roomHistory,
    totalMinutes: history.reduce((acc, curr) => acc + curr.durationMinutes, 0),
    topTrack: history.length > 0 ? history[0].trackTitle : 'None',
    favoriteRoom: roomHistory.length > 0 ? roomHistory[0].roomName : 'None',
  });
});

// Platform Room Stats Endpoint
app.get('/api/rooms/stats', (_req, res) => {
  const users = db.getUsers();
  const totalHistory = db.getHistory();
  return res.json({
    totalRoomsCreated: totalHistory.length,
    totalUsers: users.length,
  });
});

// Friends list Endpoint
app.get('/api/friends/list', (req, res) => {
  const username = req.query.username as string;
  if (!username) return res.status(400).json({ error: 'Username required' });
  return res.json(db.getFriendsForUser(username));
});

// Send Friend Request
app.post('/api/friends/add', (req, res) => {
  const { username, friendUsername } = req.body;
  if (!username || !friendUsername) return res.status(400).json({ error: 'Both usernames required' });
  if (username === friendUsername) return res.status(400).json({ error: 'Cannot add yourself' });

  try {
    const result = db.sendFriendRequest(username, friendUsername);
    return res.json({ success: true, relationship: result });
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Failed to send request' });
  }
});

// Delete Room Endpoint (Host Only)
app.delete('/api/rooms/:code', async (req, res) => {
  const code = (req.params.code || '').toUpperCase();
  const username = ((req.query.username || req.body?.username || '') as string).trim();

  if (!code || !username) {
    return res.status(400).json({ error: 'Room code and username are required' });
  }

  try {
    const roomInMemory = roomManager.getRoom(code);
    let dbRoom: any = null;

    // Safely query Prisma DB (bypasses gracefully if database server is offline)
    try {
      dbRoom = await prisma.room.findUnique({
        where: { roomCode: code },
        include: { host: true, participants: true },
      });
    } catch (dbErr: any) {
      console.log('[DB DELETE NOTICE] Database offline or unreachable, proceeding with in-memory room deletion:', dbErr.message);
    }

    if (!roomInMemory && !dbRoom) {
      return res.status(404).json({ error: 'Room not found' });
    }

    // Verify host authorization
    let isHost = false;
    if (roomInMemory) {
      const hostP = roomInMemory.participants.find((p) => p.isHost);
      if (hostP && hostP.username.toLowerCase() === username.toLowerCase()) {
        isHost = true;
      }
    }
    if (!isHost && dbRoom) {
      if (dbRoom.host?.username.toLowerCase() === username.toLowerCase()) {
        isHost = true;
      }
      const hostPart = dbRoom.participants.find((p: any) => p.isHost);
      if (hostPart && hostPart.username.toLowerCase() === username.toLowerCase()) {
        isHost = true;
      }
    }

    if (!isHost) {
      return res.status(403).json({ error: 'Only the room host can delete this room' });
    }

    // 1. Notify connected participants via Socket.IO
    io.to(code).emit('room-deleted', {
      roomId: code,
      message: 'This room has been deleted by the host.',
    });

    // 2. Remove room from memory map
    roomManager.deleteRoom(code);

    // 3. Remove room from JSON history fallback
    db.removeRoomHistory(code);

    // 4. Delete from PostgreSQL via Prisma ORM if DB is online
    if (dbRoom) {
      try {
        await prisma.room.delete({
          where: { id: dbRoom.id },
        });
      } catch (prismaDelErr: any) {
        console.log('[PRISMA DELETE NOTICE]', prismaDelErr.message);
      }
    }

    console.log(`🗑️ Room ${code} permanently deleted by host @${username}`);
    return res.json({ success: true, message: `Room ${code} deleted successfully` });
  } catch (err: any) {
    console.error('[ROOM DELETE ERROR]', err.message);
    return res.status(500).json({ error: 'Failed to delete room: ' + err.message });
  }
});

// Start Server
const server = http.createServer(app);

// Socket.IO Setup
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

io.on('connection', (socket) => {
  console.log(`🔌 Client connected: ${socket.id}`);

  // Create Room
  socket.on('room-create', ({ roomName, username, settings, scheduledStartTime }, callback) => {
    try {
      const room = roomManager.createRoom(roomName, username, socket.id, settings, scheduledStartTime);
      socket.join(room.roomId);
      if (typeof callback === 'function') {
        callback({ success: true, room });
      }
    } catch (err: any) {
      if (typeof callback === 'function') {
        callback({ success: false, error: err.message || 'Failed to create room' });
      }
    }
  });

  // Join Room
  socket.on('room-join', ({ roomId, username, password }, callback) => {
    try {
      const { room, participant } = roomManager.joinRoom(roomId, username, socket.id, password);
      socket.join(room.roomId);
      
      const hostUser = room.participants.find((p) => p.isHost)?.username || username;
      db.addRoomHistory(username, room.roomId, room.roomName, hostUser);

      io.to(room.roomId).emit('room-updated', room);
      io.to(room.roomId).emit('activity-log', {
        id: Math.random().toString(36).substring(2, 9),
        text: `@${username} joined the room space`,
        timestamp: Date.now(),
      });

      if (typeof callback === 'function') {
        callback({ success: true, room, participant });
      }
    } catch (err: any) {
      if (typeof callback === 'function') {
        callback({ success: false, error: err.message || 'Failed to join room' });
      }
    }
  });

  // Leave Room
  socket.on('room-leave', ({ roomId }) => {
    socket.leave(roomId);
    const { room } = roomManager.leaveRoom(roomId, socket.id);
    if (room) {
      io.to(roomId).emit('room-updated', room);
    }
  });

  // NTP Time Sync Ping/Pong
  socket.on('sync-ping', ({ clientTime }) => {
    socket.emit('sync-pong', {
      clientTime,
      serverTime: Date.now(),
    });
  });

  socket.on('sync-time', ({ clientTimestamp }, callback) => {
    if (typeof callback === 'function') {
      callback({
        clientTimestamp,
        serverTimestamp: Date.now(),
      });
    }
  });

  // Playback Control Update (Supports both playback-state-change and playback-update)
  const handlePlaybackState = (roomId: string, isPlaying: boolean, position: number, callback?: Function) => {
    const room = roomManager.getRoom(roomId);
    if (room) {
      room.playback = {
        isPlaying,
        position,
        serverTimestamp: Date.now(),
      };

      if (isPlaying && room.currentTrack) {
        db.addPlayHistory({
          username: room.currentTrack.uploadedBy || 'Guest',
          trackTitle: room.currentTrack.title,
          artist: room.currentTrack.artist,
          durationMinutes: Math.round((room.currentTrack.duration || 180) / 60),
          roomName: room.roomName,
          timestamp: Date.now(),
        });
      }

      io.to(roomId).emit('playback-updated', room.playback);
      io.to(roomId).emit('playback-sync', { playback: room.playback, updatedBy: socket.id });
      io.to(roomId).emit('room-updated', room);
      if (typeof callback === 'function') callback({ success: true });
    } else if (typeof callback === 'function') {
      callback({ success: false, error: 'Room not found' });
    }
  };

  socket.on('playback-state-change', ({ roomId, isPlaying, position }, callback) => {
    handlePlaybackState(roomId, isPlaying, position, callback);
  });

  socket.on('playback-update', ({ roomId, state }, callback) => {
    if (state) handlePlaybackState(roomId, state.isPlaying, state.position, callback);
  });

  // Queue Next / Skip (Supports both playback-next and queue-next)
  const handleNextTrack = (roomId: string, callback?: Function) => {
    const room = roomManager.getRoom(roomId);
    if (room) {
      if (room.settings.djBoothMode && room.djs && room.djs.length > 0) {
        roomManager.advanceDjRotation(roomId);
      }
      if (room.queue.length > 0) {
        room.currentTrack = room.queue.shift() || null;
        room.playback = { isPlaying: true, position: 0, serverTimestamp: Date.now() };
      } else {
        room.currentTrack = null;
        room.playback = { isPlaying: false, position: 0, serverTimestamp: Date.now() };
      }
      io.to(roomId).emit('room-updated', room);
      if (typeof callback === 'function') callback({ success: true });
    } else if (typeof callback === 'function') {
      callback({ success: false, error: 'Room not found' });
    }
  };

  socket.on('playback-next', ({ roomId }, callback) => handleNextTrack(roomId, callback));
  socket.on('queue-next', ({ roomId }, callback) => handleNextTrack(roomId, callback));

  // Queue Add
  socket.on('queue-add', ({ roomId, track }, callback) => {
    const room = roomManager.getRoom(roomId);
    if (room) {
      if (!room.currentTrack) {
        room.currentTrack = track;
        room.playback = { isPlaying: true, position: 0, serverTimestamp: Date.now() };
      } else {
        room.queue.push(track);
      }
      io.to(roomId).emit('room-updated', room);
      if (typeof callback === 'function') callback({ success: true });
    } else if (typeof callback === 'function') {
      callback({ success: false, error: 'Room not found' });
    }
  });

  // Queue Update
  socket.on('queue-update', ({ roomId, queue }) => {
    const room = roomManager.getRoom(roomId);
    if (room) {
      room.queue = queue;
      io.to(roomId).emit('room-updated', room);
    }
  });

  // Queue Remove
  socket.on('queue-remove', ({ roomId, trackId }) => {
    const room = roomManager.getRoom(roomId);
    if (room) {
      room.queue = room.queue.filter((t) => t.id !== trackId);
      io.to(roomId).emit('room-updated', room);
    }
  });

  // Track Vote (Supports queue-vote & vote-track)
  const handleVote = (roomId: string, trackId: string, voteType: 'up' | 'down' | 'none', username: string) => {
    const room = roomManager.getRoom(roomId);
    if (room) {
      const track = room.queue.find((t) => t.id === trackId);
      if (track) {
        if (!track.votes) track.votes = {};
        if (voteType === 'none') {
          delete track.votes[username];
        } else {
          track.votes[username] = voteType;
        }
        let count = 0;
        Object.values(track.votes).forEach((v) => {
          if (v === 'up') count += 1;
          if (v === 'down') count -= 1;
        });
        track.voteCount = count;
        io.to(roomId).emit('room-updated', room);
      }
    }
  };

  socket.on('queue-vote', ({ roomId, trackId, voteType, username }) => handleVote(roomId, trackId, voteType, username));
  socket.on('vote-track', ({ roomId, trackId, voteType, username }) => handleVote(roomId, trackId, voteType, username));

  // Track Approve
  socket.on('track-approve', ({ roomId, trackId }) => {
    const room = roomManager.getRoom(roomId);
    if (room) {
      const track = room.queue.find((t) => t.id === trackId);
      if (track) {
        track.approved = true;
        io.to(roomId).emit('room-updated', room);
      }
    }
  });

  // Chat Message (Emits both chat-message and chat-message-received)
  socket.on('chat-message', ({ roomId, username, message, replyToId, replyToUser }) => {
    const room = roomManager.getRoom(roomId);
    if (room) {
      const msg = {
        id: Math.random().toString(36).substring(2, 9),
        username,
        message,
        timestamp: Date.now(),
        replyToId,
        replyToUser,
      };
      room.chatHistory.push(msg);
      if (room.chatHistory.length > 100) room.chatHistory.shift();
      io.to(roomId).emit('chat-message', msg);
      io.to(roomId).emit('chat-message-received', msg);
      io.to(roomId).emit('room-updated', room);
    }
  });

  // Reaction Send (Emits both room-reaction and reaction-received)
  const handleReaction = (roomId: string, emoji: string, username: string) => {
    const payload = { emoji, username, id: Math.random().toString(36).substring(2, 9) };
    io.to(roomId).emit('room-reaction', payload);
    io.to(roomId).emit('reaction-received', payload);
  };

  socket.on('room-reaction', ({ roomId, emoji, username }) => handleReaction(roomId, emoji, username));
  socket.on('reaction-send', ({ roomId, emoji, username }) => handleReaction(roomId, emoji, username));

  // DJ Booth Join / Leave / Skip
  socket.on('dj-join', ({ roomId, username }) => {
    const room = roomManager.joinDjBooth(roomId, username);
    if (room) io.to(roomId).emit('room-updated', room);
  });

  socket.on('dj-leave', ({ roomId, username }) => {
    const room = roomManager.leaveDjBooth(roomId, username);
    if (room) io.to(roomId).emit('room-updated', room);
  });

  socket.on('dj-skip', ({ roomId }) => {
    const room = roomManager.advanceDjRotation(roomId);
    if (room) io.to(roomId).emit('room-updated', room);
  });

  // Room Settings Update
  socket.on('room-settings-update', ({ roomId, settings }) => {
    const room = roomManager.getRoom(roomId);
    if (room) {
      room.settings = { ...room.settings, ...settings };
      io.to(roomId).emit('room-updated', room);
    }
  });

  // Scheduled Start
  socket.on('scheduled-start', ({ roomId }) => {
    const room = roomManager.getRoom(roomId);
    if (room) {
      room.isStarted = true;
      io.to(roomId).emit('room-updated', room);
    }
  });

  // Theme Update
  socket.on('theme-update', ({ roomId, theme }) => {
    const room = roomManager.getRoom(roomId);
    if (room) {
      room.theme = theme;
      io.to(roomId).emit('room-updated', room);
    }
  });

  // Disconnect
  socket.on('disconnect', () => {
    console.log(`🔌 Client disconnected: ${socket.id}`);
    const affectedRooms = roomManager.handleDisconnect(socket.id);
    affectedRooms.forEach(({ roomId, room }: { roomId: string; room: any }) => {
      io.to(roomId).emit('room-updated', room);
    });
  });
});

server.listen(PORT, () => {
  console.log(`⚡ SyncRoom server running on port ${PORT}`);
});
