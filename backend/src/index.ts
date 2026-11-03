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

const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';
app.use(cors({ origin: CORS_ORIGIN, credentials: true }));
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', typeof CORS_ORIGIN === 'string' ? CORS_ORIGIN : '*');
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
app.use('/audio', cors({ origin: '*' }), express.static(uploadsDir));

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

// Cryptographic token helpers & authentication middleware (HS256 HMAC-SHA256)
const AUTH_SECRET = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || 'syncroom-super-secret-key-12345';

interface AuthPayload {
  userId: string;
  username: string;
  email?: string;
  exp?: number;
}

interface AuthRequest extends express.Request {
  auth?: AuthPayload;
}

function generateAuthToken(payload: { userId: string; username: string; email?: string }): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const exp = Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60); // 30 days
  const body = Buffer.from(JSON.stringify({ ...payload, exp })).toString('base64url');
  const signature = crypto.createHmac('sha256', AUTH_SECRET).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${signature}`;
}

function verifyAuthToken(token: string): AuthPayload | null {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, body, signature] = parts;
  const expectedSig = crypto.createHmac('sha256', AUTH_SECRET).update(`${header}.${body}`).digest('base64url');
  if (signature !== expectedSig) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

const requireAuth = (req: AuthRequest, res: express.Response, next: express.NextFunction): void => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  const token = authHeader.substring(7).trim();
  const payload = verifyAuthToken(token);
  if (!payload || !payload.username) {
    res.status(401).json({ error: 'Invalid or expired authentication token' });
    return;
  }
  req.auth = payload;
  next();
};

const optionalAuth = (req: AuthRequest, _res: express.Response, next: express.NextFunction): void => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7).trim();
    const payload = verifyAuthToken(token);
    if (payload && payload.username) {
      req.auth = payload;
    }
  }
  next();
};

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

    // Generate cryptographic access token
    const token = generateAuthToken({ userId: newUser.id, username: newUser.username, email: newUser.email });

    // Omit password hash on response
    const { passwordHash, ...userRes } = newUser;
    return res.status(200).json({ ...userRes, token });
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

    // Generate cryptographic access token
    const token = generateAuthToken({ userId: user.id, username: user.username, email: user.email });

    const { passwordHash, ...userRes } = user;
    return res.status(200).json({ ...userRes, token });
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
  const query = (req.query.q as string || '').trim();
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

    const searchRes = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=15`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const searchData = (await searchRes.json()) as any;

    const seenIds = new Set<string>();
    const tracks: any[] = [];
    for (const item of searchData.tracks?.items || []) {
      if (!item.id || seenIds.has(item.id)) continue;
      seenIds.add(item.id);
      tracks.push({
        id: item.id,
        title: item.name,
        artist: item.artists.map((a: any) => a.name).join(', '),
        duration: Math.round(item.duration_ms / 1000),
        url: item.uri,
        source: 'spotify',
        spotifyUri: item.uri,
        thumbnailUrl: item.album?.images?.[0]?.url || '',
      });
    }

    return res.json(tracks.slice(0, 10));
  } catch (e) {
    return res.json([]);
  }
});

// Helper for parsing YouTube duration text like "3:45" or "1:15:30"
function parseYouTubeDuration(lengthText?: string): number {
  if (!lengthText) return 210;
  const parts = lengthText.split(':').map((p) => parseInt(p, 10));
  if (parts.some((p) => isNaN(p))) return 210;
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return 210;
}

// YOUTUBE SEARCH ENDPOINT (Production Multi-Tiered Pipeline)
app.get('/api/youtube/search', async (req, res) => {
  const query = (req.query.q as string || '').trim();
  if (!query) return res.json([]);

  const seenIds = new Set<string>();
  const deduplicate = (items: any[]) => {
    const unique: any[] = [];
    for (const item of items) {
      const vId = item.youtubeId || item.id;
      if (vId && !seenIds.has(vId)) {
        seenIds.add(vId);
        unique.push({
          id: vId,
          title: item.title || query,
          artist: item.artist || 'YouTube Artist',
          duration: typeof item.duration === 'number' && !isNaN(item.duration) ? item.duration : 210,
          url: vId,
          source: 'youtube',
          youtubeId: vId,
          thumbnailUrl: item.thumbnailUrl || `https://i.ytimg.com/vi/${vId}/hqdefault.jpg`,
        });
      }
    }
    return unique;
  };

  // Tier 1: Official YouTube Data API v3 (If YOUTUBE_API_KEY is configured in env)
  if (YOUTUBE_API_KEY) {
    try {
      const searchRes = await fetch(
        `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=15&q=${encodeURIComponent(query)}&key=${YOUTUBE_API_KEY}`
      );
      if (searchRes.ok) {
        const searchData = (await searchRes.json()) as any;
        const results = deduplicate(
          (searchData.items || []).map((item: any) => ({
            id: item.id?.videoId,
            title: item.snippet?.title,
            artist: item.snippet?.channelTitle,
            duration: 210,
            url: item.id?.videoId,
            source: 'youtube',
            youtubeId: item.id?.videoId,
            thumbnailUrl: item.snippet?.thumbnails?.high?.url || item.snippet?.thumbnails?.default?.url,
          }))
        );
        if (results.length > 0) {
          console.log(`[YOUTUBE SEARCH - TIER 1 API] Found ${results.length} results for "${query}"`);
          return res.json(results.slice(0, 10));
        }
      }
    } catch (err: any) {
      console.log('[YOUTUBE SEARCH - TIER 1 NOTICE]', err.message);
    }
  }

  // Tier 2: Primary Web Scraper with Desktop Browser Headers (with 1 quick retry on socket reset)
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const ytRes = await fetch(`https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        signal: AbortSignal.timeout(10000),
      });

      if (ytRes.ok) {
        const html = await ytRes.text();
        const match =
          html.match(/var ytInitialData = ({.*?});<\/script>/s) ||
          html.match(/ytInitialData"\s*:\s*({.*?});/s) ||
          html.match(/(?:window\["ytInitialData"\]|ytInitialData)\s*=\s*({.+?});/s);

        let data: any = null;
        if (match) {
          try {
            data = JSON.parse(match[1]);
          } catch {}
        }

        if (data) {
          const contents =
            data.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents ||
            data.contents?.sectionListRenderer?.contents ||
            [];

          const extracted: any[] = [];
          for (const section of contents) {
            const items = section.itemSectionRenderer?.contents || [];
            for (const item of items) {
              const v = item.videoRenderer || item.compactVideoRenderer;
              if (v && v.videoId) {
                const title =
                  v.title?.runs?.map((r: any) => r.text).join('') ||
                  v.title?.simpleText ||
                  query;
                const artist =
                  v.ownerText?.runs?.map((r: any) => r.text).join('') ||
                  v.shortBylineText?.runs?.map((r: any) => r.text).join('') ||
                  'YouTube Artist';
                const lengthText = v.lengthText?.simpleText || '';
                const duration = parseYouTubeDuration(lengthText);
                const thumb =
                  v.thumbnail?.thumbnails?.slice(-1)[0]?.url ||
                  `https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg`;

                extracted.push({
                  id: v.videoId,
                  title,
                  artist,
                  duration,
                  url: v.videoId,
                  source: 'youtube',
                  youtubeId: v.videoId,
                  thumbnailUrl: thumb,
                });
              }
            }
          }

          const results = deduplicate(extracted);
          if (results.length > 0) {
            console.log(`[YOUTUBE SEARCH - TIER 2 SCRAPER] Found ${results.length} results for "${query}" (attempt ${attempt + 1})`);
            return res.json(results.slice(0, 10));
          }
        }
      }
    } catch (err: any) {
      console.log(`[YOUTUBE SEARCH - TIER 2 NOTICE (attempt ${attempt + 1})]`, err.message);
      if (attempt === 0) {
        await new Promise((r) => setTimeout(r, 250));
      }
    }
  }

  // Tier 3: Fallback Catalog for High Relevance Popular Matches
  // CRITICAL: NEVER return the full catalog if no items match!
  // Return ONLY genuine matches, or empty array [] if no matches.
  console.log(`[YOUTUBE SEARCH - TIER 3 FALLBACK] Checking verified track catalog for "${query}"`);
  const catalog = [
    { id: 'fJ9rUzIMcZQ', title: 'Bohemian Rhapsody', artist: 'Queen', duration: 355, youtubeId: 'fJ9rUzIMcZQ' },
    { id: '4NRXx6U8ABQ', title: 'Blinding Lights', artist: 'The Weeknd', duration: 200, youtubeId: '4NRXx6U8ABQ' },
    { id: 'TUVcZfQe-Kw', title: 'Levitating', artist: 'Dua Lipa', duration: 203, youtubeId: 'TUVcZfQe-Kw' },
    { id: 'JGwWNGJdvx8', title: 'Shape of You', artist: 'Ed Sheeran', duration: 233, youtubeId: 'JGwWNGJdvx8' },
    { id: 'G7KNmW9a75A', title: 'Flowers', artist: 'Miley Cyrus', duration: 200, youtubeId: 'G7KNmW9a75A' },
    { id: '34Na4j8AVgA', title: 'Starboy', artist: 'The Weeknd ft. Daft Punk', duration: 230, youtubeId: '34Na4j8AVgA' },
    { id: 'kTJczUoc5C0', title: 'Stay', artist: 'The Kid LAROI & Justin Bieber', duration: 141, youtubeId: 'kTJczUoc5C0' },
  ];

  const qLower = query.toLowerCase();
  const matched = catalog.filter(
    (item) => item.title.toLowerCase().includes(qLower) || item.artist.toLowerCase().includes(qLower)
  );

  return res.json(
    deduplicate(
      matched.map((item) => ({
        ...item,
        source: 'youtube',
        url: item.youtubeId,
        thumbnailUrl: `https://i.ytimg.com/vi/${item.youtubeId}/hqdefault.jpg`,
      }))
    )
  );
});

// Single Track File Upload
app.post('/api/tracks/upload', optionalAuth, upload.fields([
  { name: 'audio', maxCount: 1 },
  { name: 'lyrics', maxCount: 1 }
]), (req: AuthRequest, res) => {
  try {
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    const audioFile = files['audio']?.[0];
    const lyricsFile = files['lyrics']?.[0];

    if (!audioFile) {
      return res.status(400).json({ error: 'Audio file is required' });
    }

    const audioUrl = `/uploads/${audioFile.filename}`;
    const lyricsUrl = lyricsFile ? `/uploads/${lyricsFile.filename}` : undefined;

    // Security Fix: uploadedBy MUST come from verified req.auth.username. Never trust req.body.uploadedBy.
    const uploadedBy = req.auth?.username || 'Guest';

    const newTrack: Track = {
      id: Math.random().toString(36).substring(2, 9),
      title: path.parse(audioFile.originalname).name,
      artist: uploadedBy,
      duration: 180,
      url: audioUrl,
      source: 'upload',
      uploadedBy,
      votes: {},
      voteCount: 0,
      approved: true,
      lyricsUrl,
    };

    // Save to in-memory JSON fallback
    db.saveUploadedTrack(newTrack);

    // Asynchronously persist uploaded track to database
    prisma.track.create({
      data: {
        id: newTrack.id,
        title: newTrack.title,
        artist: newTrack.artist,
        duration: newTrack.duration,
        url: newTrack.url,
        source: newTrack.source,
        lyricsUrl: newTrack.lyricsUrl,
        uploadedBy: newTrack.uploadedBy,
      },
    }).catch((e) => console.log('[PRISMA TRACK UPLOAD NOTICE]', e.message));

    return res.status(200).json(newTrack);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'File upload failed' });
  }
});

// Active Public Rooms Endpoint (Explore Rooms)
app.get('/api/rooms', (_req, res) => {
  try {
    const activeRooms = roomManager.getActiveRooms();
    return res.json(activeRooms);
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to fetch active rooms: ' + err.message });
  }
});

// User Library Data Endpoint (Uploads & Listening History)
app.get('/api/library', requireAuth, async (req: AuthRequest, res) => {
  // Security Fix: Derive username strictly from verified cryptographic session (req.auth.username).
  // Any query parameter ?username=... is completely ignored to prevent IDOR / unauthorized data exposure.
  const username = req.auth!.username;

  try {
    // 1. Fetch User Uploads from Prisma / Fallback
    let uploads: any[] = [];
    try {
      const dbTracks = await prisma.track.findMany({
        where: {
          uploadedBy: { equals: username, mode: 'insensitive' },
          source: 'upload',
        },
        orderBy: { createdAt: 'desc' },
      });
      uploads = dbTracks.map((t) => ({
        id: t.id,
        title: t.title,
        artist: t.artist,
        duration: t.duration,
        url: t.url,
        source: t.source,
        thumbnailUrl: t.thumbnailUrl,
        lyricsUrl: t.lyricsUrl,
        uploadedBy: t.uploadedBy,
        createdAt: t.createdAt.getTime(),
      }));
    } catch (e: any) {
      console.log('[LIBRARY UPLOADS PRISMA NOTICE]', e.message);
    }

    if (uploads.length === 0) {
      uploads = db.getUploadedTracks(username).map((t) => ({
        id: t.id,
        title: t.title,
        artist: t.artist,
        duration: t.duration,
        url: t.url,
        source: t.source,
        thumbnailUrl: t.thumbnailUrl,
        lyricsUrl: t.lyricsUrl,
        uploadedBy: t.uploadedBy,
        createdAt: Date.now(),
      }));
    }

    // 2. Fetch User Recent Listening History from Prisma / Fallback
    let recent: any[] = [];
    try {
      const dbHistory = await prisma.playHistory.findMany({
        where: {
          username: { equals: username, mode: 'insensitive' },
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });
      recent = dbHistory.map((h) => ({
        id: h.id,
        trackTitle: h.trackTitle,
        artist: h.artist,
        durationMinutes: h.durationMinutes,
        roomName: h.roomName,
        timestamp: Number(h.timestamp),
        createdAt: h.createdAt.getTime(),
      }));
    } catch (e: any) {
      console.log('[LIBRARY HISTORY PRISMA NOTICE]', e.message);
    }

    if (recent.length === 0) {
      // Fallback to in-memory JSON db history
      recent = db.getHistory()
        .filter((h) => h.username.toLowerCase() === username.toLowerCase())
        .slice()
        .reverse()
        .slice(0, 50);
    }

    return res.json({
      uploads,
      recent,
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to fetch library data: ' + err.message });
  }
});

// User Profile Stats Endpoint (Private to authenticated user)
app.get('/api/stats', requireAuth, (req: AuthRequest, res) => {
  const username = req.auth!.username;

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

// Platform Room Stats Endpoint (Public aggregate data)
app.get('/api/rooms/stats', (_req, res) => {
  const users = db.getUsers();
  const totalHistory = db.getHistory();
  return res.json({
    totalRoomsCreated: totalHistory.length,
    totalUsers: users.length,
  });
});

// Friends list Endpoint (Private to authenticated user)
app.get('/api/friends/list', requireAuth, (req: AuthRequest, res) => {
  const username = req.auth!.username;
  return res.json(db.getFriendsForUser(username));
});

// Send Friend Request (Authenticated)
app.post('/api/friends/add', requireAuth, (req: AuthRequest, res) => {
  const username = req.auth!.username;
  const friendUsername = (req.body.friendUsername || '').trim();
  if (!friendUsername) return res.status(400).json({ error: 'friendUsername required' });
  if (username.toLowerCase() === friendUsername.toLowerCase()) return res.status(400).json({ error: 'Cannot add yourself' });

  try {
    const result = db.sendFriendRequest(username, friendUsername);
    return res.json({ success: true, relationship: result });
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Failed to send request' });
  }
});

// Delete Room Endpoint (Host Only - Cryptographically Verified via requireAuth)
app.delete('/api/rooms/:code', requireAuth, async (req: AuthRequest, res) => {
  const code = (req.params.code || '').toUpperCase();
  const username = req.auth!.username;

  if (!code) {
    return res.status(400).json({ error: 'Room code is required' });
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
      if (roomInMemory.creatorUsername && roomInMemory.creatorUsername.toLowerCase() === username.toLowerCase()) {
        isHost = true;
      }
      const hostP = roomInMemory.participants.find((p) => p.isHost);
      if (hostP && hostP.username.toLowerCase() === username.toLowerCase()) {
        isHost = true;
      }
      if (roomInMemory.participants[0] && roomInMemory.participants[0].username.toLowerCase() === username.toLowerCase()) {
        isHost = true;
      }
    }
    if (!isHost && dbRoom) {
      if (dbRoom.host?.username && dbRoom.host.username.toLowerCase() === username.toLowerCase()) {
        isHost = true;
      }
      const hostPart = dbRoom.participants?.find((p: any) => p.isHost);
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

  // Helper: Verify authorization for socket actions
  const checkRoomAuth = (roomId: string) => {
    const room = roomManager.getRoom(roomId);
    if (!room) return { room: null, participant: null, isHost: false, isCollab: false, canControlPlayback: false };
    const participant = room.participants.find((p) => p.id === socket.id);
    const isHost = participant ? participant.isHost : (room.hostId === socket.id);
    const isCollab = !!room.settings.collaborativeMode;
    const canControlPlayback = isHost || isCollab;
    return { room, participant, isHost, isCollab, canControlPlayback };
  };

  // Playback Control Update (Supports both playback-state-change and playback-update)
  const handlePlaybackState = (roomId: string, isPlaying: boolean, position: number, callback?: Function) => {
    const { room, canControlPlayback } = checkRoomAuth(roomId);
    if (!room) {
      if (typeof callback === 'function') callback({ success: false, error: 'Room not found' });
      return;
    }
    if (!canControlPlayback) {
      if (typeof callback === 'function') callback({ success: false, error: 'Unauthorized: Only the host can alter playback in non-collaborative mode.' });
      return;
    }

    room.playback = {
      isPlaying,
      position,
      serverTimestamp: Date.now(),
      loopCurrentTrack: room.playback.loopCurrentTrack,
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
  };

  socket.on('playback-state-change', ({ roomId, isPlaying, position }: any = {}, callback?: Function) => {
    handlePlaybackState(roomId, isPlaying, position, callback);
  });

  socket.on('playback-update', ({ roomId, state }: any = {}, callback?: Function) => {
    if (state) handlePlaybackState(roomId, state.isPlaying, state.position, callback);
  });

  // Queue Next / Skip (Supports both playback-next and queue-next)
  const handleNextTrack = (roomId: string, isAutoEnd?: boolean, callback?: Function, shuffle?: boolean) => {
    const { room, canControlPlayback } = checkRoomAuth(roomId);
    if (!room) {
      if (typeof callback === 'function') callback({ success: false, error: 'Room not found' });
      return;
    }

    // If manual skip (not auto-end), enforce permission check
    if (!isAutoEnd && !canControlPlayback) {
      if (typeof callback === 'function') callback({ success: false, error: 'Unauthorized: Only the host can skip tracks in non-collaborative mode.' });
      return;
    }

    // Check if loop is active for current track
    const isLooping = !!(room.playback.loopCurrentTrack || room.currentTrack?.loop);
    if (isAutoEnd && isLooping && room.currentTrack) {
      // Loop current track from position 0
      room.playback = {
        ...room.playback,
        isPlaying: true,
        position: 0,
        serverTimestamp: Date.now(),
      };
      io.to(roomId).emit('playback-updated', room.playback);
      io.to(roomId).emit('playback-sync', { playback: room.playback, updatedBy: socket.id });
      io.to(roomId).emit('room-updated', room);
      if (typeof callback === 'function') callback({ success: true, looped: true });
      return;
    }

    // Record previous track in history
    if (room.currentTrack) {
      if (!room.playedTracks) room.playedTracks = [];
      room.playedTracks.push(room.currentTrack);
      if (room.playedTracks.length > 50) room.playedTracks.shift();
    }

    if (room.settings.djBoothMode && room.djs && room.djs.length > 0) {
      roomManager.advanceDjRotation(roomId);
    }

    // Pick track from queue (random if shuffle is requested, otherwise first approved)
    const approvedIndices = room.queue
      .map((t, idx) => (t.approved ? idx : -1))
      .filter((idx) => idx !== -1);

    if (approvedIndices.length > 0) {
      const chosenIndex = shuffle
        ? approvedIndices[Math.floor(Math.random() * approvedIndices.length)]
        : approvedIndices[0];
      const [nextTrack] = room.queue.splice(chosenIndex, 1);
      room.currentTrack = nextTrack;
      room.playback = {
        isPlaying: true,
        position: 0,
        serverTimestamp: Date.now(),
        loopCurrentTrack: !!nextTrack.loop,
      };
    } else {
      room.currentTrack = null;
      room.playback = {
        isPlaying: false,
        position: 0,
        serverTimestamp: Date.now(),
        loopCurrentTrack: false,
      };
    }

    io.to(roomId).emit('playback-updated', room.playback);
    io.to(roomId).emit('playback-sync', { playback: room.playback, updatedBy: socket.id });
    io.to(roomId).emit('room-updated', room);
    if (typeof callback === 'function') callback({ success: true });
  };

  socket.on('playback-next', ({ roomId, isAutoEnd, shuffle }: any = {}, callback?: Function) => handleNextTrack(roomId, isAutoEnd, callback, shuffle));
  socket.on('queue-next', ({ roomId, isAutoEnd, shuffle }: any = {}, callback?: Function) => handleNextTrack(roomId, isAutoEnd, callback, shuffle));

  // Previous Track
  const handlePreviousTrack = (roomId: string, currentPosition?: number, callback?: Function) => {
    const { room, canControlPlayback } = checkRoomAuth(roomId);
    if (!room) {
      if (typeof callback === 'function') callback({ success: false, error: 'Room not found' });
      return;
    }
    if (!canControlPlayback) {
      if (typeof callback === 'function') callback({ success: false, error: 'Unauthorized: Only the host can navigate tracks in non-collaborative mode.' });
      return;
    }

    const serverTimeNow = Date.now();
    const elapsedSecs = room.playback.isPlaying
      ? Math.max(0, (serverTimeNow - room.playback.serverTimestamp) / 1000)
      : 0;
    const effectivePos = typeof currentPosition === 'number'
      ? currentPosition
      : (room.playback.position || 0) + elapsedSecs;

    // If current position > 3s or no history, restart current track from position 0
    if (effectivePos > 3 || !room.playedTracks || room.playedTracks.length === 0) {
      room.playback = {
        ...room.playback,
        isPlaying: true,
        position: 0,
        serverTimestamp: Date.now(),
      };
    } else {
      // Move to previous track
      const prevTrack = room.playedTracks.pop()!;
      if (room.currentTrack) {
        room.queue.unshift(room.currentTrack);
      }
      room.currentTrack = prevTrack;
      room.playback = {
        isPlaying: true,
        position: 0,
        serverTimestamp: Date.now(),
        loopCurrentTrack: !!prevTrack.loop,
      };
    }

    io.to(roomId).emit('playback-updated', room.playback);
    io.to(roomId).emit('playback-sync', { playback: room.playback, updatedBy: socket.id });
    io.to(roomId).emit('room-updated', room);
    if (typeof callback === 'function') callback({ success: true });
  };

  socket.on('playback-prev', ({ roomId, currentPosition }: any = {}, callback?: Function) => handlePreviousTrack(roomId, currentPosition, callback));
  socket.on('queue-prev', ({ roomId, currentPosition }: any = {}, callback?: Function) => handlePreviousTrack(roomId, currentPosition, callback));

  // Playback Loop Toggle (Current Track)
  socket.on('playback-loop', ({ roomId, loop }: any = {}, callback?: Function) => {
    const { room, canControlPlayback } = checkRoomAuth(roomId);
    if (!room) {
      if (typeof callback === 'function') callback({ success: false, error: 'Room not found' });
      return;
    }
    if (!canControlPlayback) {
      if (typeof callback === 'function') callback({ success: false, error: 'Unauthorized: Only the host can toggle loop in non-collaborative mode.' });
      return;
    }

    const newLoop = typeof loop === 'boolean' ? loop : !room.playback.loopCurrentTrack;
    room.playback.loopCurrentTrack = newLoop;
    if (room.currentTrack) {
      room.currentTrack.loop = newLoop;
    }

    io.to(roomId).emit('playback-updated', room.playback);
    io.to(roomId).emit('room-updated', room);
    if (typeof callback === 'function') callback({ success: true, loopCurrentTrack: newLoop });
  });

  // Queue Item Loop Toggle
  socket.on('queue-loop-toggle', ({ roomId, trackId }: any = {}, callback?: Function) => {
    const { room, canControlPlayback } = checkRoomAuth(roomId);
    if (!room) {
      if (typeof callback === 'function') callback({ success: false, error: 'Room not found' });
      return;
    }
    if (!canControlPlayback) {
      if (typeof callback === 'function') callback({ success: false, error: 'Unauthorized: Only authorized members can toggle loop on queue items.' });
      return;
    }

    let updatedLoop: boolean | undefined;
    const queueTrack = room.queue.find((t) => t.id === trackId);
    if (queueTrack) {
      queueTrack.loop = !queueTrack.loop;
      updatedLoop = queueTrack.loop;
    } else if (room.currentTrack && room.currentTrack.id === trackId) {
      room.currentTrack.loop = !room.currentTrack.loop;
      room.playback.loopCurrentTrack = room.currentTrack.loop;
      updatedLoop = room.currentTrack.loop;
      io.to(roomId).emit('playback-updated', room.playback);
    }

    if (updatedLoop !== undefined) {
      io.to(roomId).emit('room-updated', room);
      if (typeof callback === 'function') callback({ success: true, loop: updatedLoop });
    } else {
      if (typeof callback === 'function') callback({ success: false, error: 'Track not found' });
    }
  });

  // Queue Add
  socket.on('queue-add', ({ roomId, track }: any = {}, callback?: Function) => {
    const { room, isHost, isCollab } = checkRoomAuth(roomId);
    if (!room) {
      if (typeof callback === 'function') callback({ success: false, error: 'Room not found' });
      return;
    }

    // Direct add vs Request:
    // In collaborative mode, tracks are approved directly unless hostApprovalRequired is set.
    // In non-collaborative mode, only the host can add directly; non-host submissions are song requests (approved: false).
    const isDirectAdd = isHost || (isCollab && !room.settings.hostApprovalRequired);
    track.approved = isDirectAdd;

    if (isDirectAdd && !room.currentTrack) {
      room.currentTrack = track;
      room.playback = {
        isPlaying: true,
        position: 0,
        serverTimestamp: Date.now(),
        loopCurrentTrack: !!track.loop,
      };
      io.to(roomId).emit('playback-updated', room.playback);
      io.to(roomId).emit('playback-sync', { playback: room.playback, updatedBy: socket.id });
    } else {
      room.queue.push(track);
    }

    io.to(roomId).emit('room-updated', room);
    if (typeof callback === 'function') callback({ success: true, approved: track.approved });
  });

  // Queue Update
  socket.on('queue-update', ({ roomId, queue }: any = {}, callback?: Function) => {
    const { room, isHost } = checkRoomAuth(roomId);
    if (room && isHost) {
      room.queue = queue;
      io.to(roomId).emit('room-updated', room);
      if (typeof callback === 'function') callback({ success: true });
    } else if (typeof callback === 'function') {
      callback({ success: false, error: 'Unauthorized or room not found' });
    }
  });

  // Queue Remove
  socket.on('queue-remove', ({ roomId, trackId }: any = {}, callback?: Function) => {
    const { room, isHost, isCollab, participant } = checkRoomAuth(roomId);
    if (!room) {
      if (typeof callback === 'function') callback({ success: false, error: 'Room not found' });
      return;
    }

    const track = room.queue.find((t) => t.id === trackId);
    const isOwner = track && participant && track.uploadedBy?.toLowerCase() === participant.username?.toLowerCase();

    // Host can remove anything; in collaborative mode members can remove; or track owner can remove own track
    if (!isHost && !isCollab && !isOwner) {
      if (typeof callback === 'function') callback({ success: false, error: 'Unauthorized: Only the host can remove tracks from queue in non-collaborative mode.' });
      return;
    }

    room.queue = room.queue.filter((t) => t.id !== trackId);
    io.to(roomId).emit('room-updated', room);
    if (typeof callback === 'function') callback({ success: true });
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

  socket.on('queue-vote', ({ roomId, trackId, voteType, username }: any = {}) => handleVote(roomId, trackId, voteType, username));
  socket.on('vote-track', ({ roomId, trackId, voteType, username }: any = {}) => handleVote(roomId, trackId, voteType, username));

  // Track Approve (Host only)
  socket.on('track-approve', ({ roomId, trackId }: any = {}, callback?: Function) => {
    const { room, isHost } = checkRoomAuth(roomId);
    if (!room) {
      if (typeof callback === 'function') callback({ success: false, error: 'Room not found' });
      return;
    }
    if (!isHost) {
      if (typeof callback === 'function') callback({ success: false, error: 'Unauthorized: Only the host can approve song requests.' });
      return;
    }

    const track = room.queue.find((t) => t.id === trackId);
    if (track) {
      track.approved = true;
      if (!room.currentTrack) {
        room.queue = room.queue.filter((t) => t.id !== trackId);
        room.currentTrack = track;
        room.playback = {
          isPlaying: true,
          position: 0,
          serverTimestamp: Date.now(),
          loopCurrentTrack: !!track.loop,
        };
        io.to(roomId).emit('playback-updated', room.playback);
        io.to(roomId).emit('playback-sync', { playback: room.playback, updatedBy: socket.id });
      }
      io.to(roomId).emit('room-updated', room);
      if (typeof callback === 'function') callback({ success: true });
    } else {
      if (typeof callback === 'function') callback({ success: false, error: 'Track not found in queue' });
    }
  });

  // Host Kick Member (Supports room-kick and participant-kick)
  const handleKick = (roomId: string, targetId: string, targetUsername?: string, callback?: Function) => {
    const { room, isHost } = checkRoomAuth(roomId);
    if (!room) {
      if (typeof callback === 'function') callback({ success: false, error: 'Room not found' });
      return;
    }
    if (!isHost) {
      if (typeof callback === 'function') callback({ success: false, error: 'Unauthorized: Only the host can kick participants.' });
      return;
    }

    const target = room.participants.find(
      (p) =>
        p.id === targetId ||
        (targetUsername && p.username.toLowerCase() === targetUsername.toLowerCase()) ||
        p.username.toLowerCase() === targetId?.toLowerCase()
    );

    if (!target) {
      if (typeof callback === 'function') callback({ success: false, error: 'Participant not found.' });
      return;
    }

    if (target.id === socket.id || target.isHost) {
      if (typeof callback === 'function') callback({ success: false, error: 'Host cannot kick themselves.' });
      return;
    }

    // Disconnect target socket
    const targetSocket = io.sockets.sockets.get(target.id);
    if (targetSocket) {
      targetSocket.emit('room-kicked', { message: 'You were removed from this room by the host.' });
      targetSocket.emit('kicked', { message: 'You were removed from this room by the host.' });
      targetSocket.leave(roomId);
    }

    // Remove from room participant list
    roomManager.kickParticipant(roomId, target.id);

    io.to(roomId).emit('room-updated', room);
    io.to(roomId).emit('activity-log', {
      id: Math.random().toString(36).substring(2, 9),
      text: `@${target.username} was removed from the room by the host`,
      timestamp: Date.now(),
    });

    if (typeof callback === 'function') callback({ success: true });
  };

  socket.on('room-kick', ({ roomId, targetId, targetSocketId, targetUsername }: any = {}, callback?: Function) => {
    handleKick(roomId, targetId || targetSocketId, targetUsername, callback);
  });
  socket.on('participant-kick', ({ roomId, targetId }: any = {}, callback?: Function) => {
    handleKick(roomId, targetId, undefined, callback);
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

export default app;
export { app, server, io };
