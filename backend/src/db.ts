import fs from 'fs';
import path from 'path';
import { UserAccount, FriendRelationship, PlayHistoryEntry, Track } from './types';
import { prisma } from './prisma';

export interface ScheduledEvent {
  roomId: string;
  roomName: string;
  hostUsername: string;
  startTime: number;
  isStarted: boolean;
}

export interface UserRoomHistory {
  username: string;
  roomId: string;
  roomName: string;
  hostUsername?: string;
  joinedAt: number;
}

interface Schema {
  users: UserAccount[];
  friends: FriendRelationship[];
  history: PlayHistoryEntry[];
  scheduledEvents: ScheduledEvent[];
  roomHistory: UserRoomHistory[];
  uploadedTracks?: Track[];
}

const dbPath = process.env.VERCEL
  ? path.join('/tmp', 'database.json')
  : path.join(__dirname, '..', 'database.json');

function withTimeout<T>(promise: Promise<T>, ms = 300): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('DB Timeout')), ms)),
  ]);
}

class DatabaseService {
  private fallbackData: Schema = {
    users: [],
    friends: [],
    history: [],
    scheduledEvents: [],
    roomHistory: [],
    uploadedTracks: [],
  };

  constructor() {
    this.loadJsonFallback();
  }

  private loadJsonFallback() {
    try {
      if (fs.existsSync(dbPath)) {
        const fileContent = fs.readFileSync(dbPath, 'utf8');
        this.fallbackData = JSON.parse(fileContent);
        if (!this.fallbackData.roomHistory) this.fallbackData.roomHistory = [];
      } else {
        this.saveJsonFallback();
      }
    } catch (e) {
      console.log('[DB] JSON fallback initialized empty', e);
      this.saveJsonFallback();
    }
  }

  private saveJsonFallback() {
    try {
      fs.writeFileSync(dbPath, JSON.stringify(this.fallbackData, null, 2), 'utf8');
    } catch (e) {
      console.log('[DB] JSON fallback write warning', e);
    }
  }

  // --- Users CRUD ---
  public getUsers(): UserAccount[] {
    return this.fallbackData.users;
  }

  public async saveUser(user: UserAccount): Promise<UserAccount> {
    const index = this.fallbackData.users.findIndex((u) => u.id === user.id);
    if (index !== -1) {
      this.fallbackData.users[index] = user;
    } else {
      this.fallbackData.users.push(user);
    }
    this.saveJsonFallback();

    // Persist to Prisma
    try {
      await prisma.user.upsert({
        where: { email: user.email.toLowerCase() },
        update: {
          username: user.username,
          avatar: user.avatar,
          bio: user.bio,
          optedOutStats: user.optedOutStats ?? false,
        },
        create: {
          id: user.id,
          email: user.email.toLowerCase(),
          passwordHash: user.passwordHash,
          username: user.username,
          avatar: user.avatar,
          bio: user.bio,
          optedOutStats: user.optedOutStats ?? false,
        },
      });
    } catch (err: any) {
      console.log('[PRISMA USER PERSIST NOTICE]', err.message);
    }
    return user;
  }

  public async findUserByEmail(email: string): Promise<UserAccount | undefined> {
    const cleanEmail = (email || '').trim().toLowerCase();
    try {
      const dbUser = await withTimeout(prisma.user.findUnique({
        where: { email: cleanEmail },
      }));
      if (dbUser) {
        return {
          id: dbUser.id,
          email: dbUser.email,
          passwordHash: dbUser.passwordHash,
          username: dbUser.username,
          avatar: dbUser.avatar,
          bio: dbUser.bio || undefined,
          optedOutStats: dbUser.optedOutStats,
          createdAt: dbUser.createdAt.getTime(),
        };
      }
    } catch (e: any) {
      // Gracefully fall back to memory
    }
    return this.fallbackData.users.find((u) => u.email.toLowerCase() === cleanEmail);
  }

  public async findUserByUsername(username: string): Promise<UserAccount | undefined> {
    const cleanUsername = (username || '').trim().toLowerCase();
    try {
      const dbUser = await withTimeout(prisma.user.findFirst({
        where: { username: { equals: cleanUsername, mode: 'insensitive' } },
      }));
      if (dbUser) {
        return {
          id: dbUser.id,
          email: dbUser.email,
          passwordHash: dbUser.passwordHash,
          username: dbUser.username,
          avatar: dbUser.avatar,
          bio: dbUser.bio || undefined,
          optedOutStats: dbUser.optedOutStats,
          createdAt: dbUser.createdAt.getTime(),
        };
      }
    } catch (e: any) {
      // Gracefully fall back to memory
    }
    return this.fallbackData.users.find((u) => u.username.toLowerCase() === cleanUsername);
  }

  // --- Friends CRUD ---
  public getFriendsForUser(username: string): FriendRelationship[] {
    return this.fallbackData.friends.filter(
      (f) => f.user1 === username || f.user2 === username
    );
  }

  public sendFriendRequest(user1: string, user2: string) {
    const existing = this.fallbackData.friends.find(
      (f) =>
        (f.user1 === user1 && f.user2 === user2) ||
        (f.user1 === user2 && f.user2 === user1)
    );
    if (existing) {
      throw new Error('Friend request or relationship already exists');
    }

    const relationship: FriendRelationship = {
      id: Math.random().toString(36).substring(2, 9),
      user1,
      user2,
      status: 'accepted',
      createdAt: Date.now(),
    };

    this.fallbackData.friends.push(relationship);
    this.saveJsonFallback();
    return relationship;
  }

  // --- Play History & Stats ---
  public getHistory(): PlayHistoryEntry[] {
    return this.fallbackData.history;
  }

  public addPlayHistory(entry: Omit<PlayHistoryEntry, 'id'>) {
    const id = Math.random().toString(36).substring(2, 9);
    const newEntry: PlayHistoryEntry = {
      id,
      ...entry,
    };
    this.fallbackData.history.push(newEntry);
    this.saveJsonFallback();

    // Async Prisma persist
    prisma.playHistory.create({
      data: {
        username: entry.username,
        trackTitle: entry.trackTitle,
        artist: entry.artist,
        durationMinutes: entry.durationMinutes,
        roomName: entry.roomName,
        timestamp: BigInt(entry.timestamp),
      },
    }).catch((err) => console.log('[PRISMA PLAY HISTORY ERROR]', err.message));

    return newEntry;
  }

  // --- Room History ---
  public getRoomHistory(username: string): UserRoomHistory[] {
    return this.fallbackData.roomHistory.filter(
      (r) => r.username.toLowerCase() === username.toLowerCase()
    );
  }

  public addRoomHistory(username: string, roomId: string, roomName: string, hostUsername?: string) {
    this.fallbackData.roomHistory = this.fallbackData.roomHistory.filter(
      (r) => !(r.username.toLowerCase() === username.toLowerCase() && r.roomId === roomId)
    );

    this.fallbackData.roomHistory.push({
      username,
      roomId,
      roomName,
      hostUsername: hostUsername || username,
      joinedAt: Date.now(),
    });

    if (this.fallbackData.roomHistory.length > 15) {
      this.fallbackData.roomHistory.shift();
    }

    this.saveJsonFallback();
  }

  public removeRoomHistory(roomId: string) {
    this.fallbackData.roomHistory = this.fallbackData.roomHistory.filter(
      (r) => r.roomId.toLowerCase() !== roomId.toLowerCase()
    );
    this.saveJsonFallback();
  }

  // --- Uploaded Tracks CRUD ---
  public getUploadedTracks(username: string): Track[] {
    if (!this.fallbackData.uploadedTracks) this.fallbackData.uploadedTracks = [];
    return this.fallbackData.uploadedTracks.filter(
      (t) => t.uploadedBy.toLowerCase() === username.toLowerCase() && t.source === 'upload'
    );
  }

  public saveUploadedTrack(track: Track): Track {
    if (!this.fallbackData.uploadedTracks) this.fallbackData.uploadedTracks = [];
    this.fallbackData.uploadedTracks.unshift(track);
    this.saveJsonFallback();
    return track;
  }
}

export const db = new DatabaseService();

