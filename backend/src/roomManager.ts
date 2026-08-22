import { Room, Participant, RoomSettings } from './types';
import { prisma } from './prisma';

class RoomManager {
  private rooms: Map<string, Room> = new Map();

  constructor() {
    this.hydrateOnStartup();
  }

  // Hydrate active rooms from database on server startup
  public async hydrateOnStartup() {
    try {
      const dbRooms = await prisma.room.findMany({
        include: {
          queue: true,
          participants: true,
          chatHistory: {
            take: 100,
            orderBy: { createdAt: 'asc' },
          },
        },
      });

      for (const r of dbRooms) {
        const room: Room = {
          roomId: r.roomCode,
          roomName: r.roomName,
          hostId: r.hostId || '',
          settings: {
            isPrivate: r.isPrivate,
            password: r.passwordHash || undefined,
            maxParticipants: r.maxParticipants,
            collaborativeMode: r.collaborativeMode,
            enableChat: r.enableChat,
            enableReactions: r.enableReactions,
            enableVoting: r.enableVoting,
            allowEveryoneToAddSongs: r.allowEveryoneToAddSongs,
            allowEveryoneToSkip: r.allowEveryoneToSkip,
            hostApprovalRequired: r.hostApprovalRequired,
            autoPickNext: r.autoPickNext,
          },
          currentTrack: null,
          playback: {
            isPlaying: r.isPlaying,
            position: r.position,
            serverTimestamp: Number(r.serverTimestamp) || Date.now(),
          },
          queue: r.queue.map((t) => ({
            id: t.id,
            title: t.title,
            artist: t.artist,
            duration: t.duration,
            url: t.url,
            source: (t.source as any) || 'upload',
            spotifyUri: t.spotifyUri || undefined,
            youtubeId: t.youtubeId || undefined,
            thumbnailUrl: t.thumbnailUrl || undefined,
            uploadedBy: t.uploadedBy,
            votes: {},
            voteCount: t.voteCount,
            approved: t.approved,
            lyricsUrl: t.lyricsUrl || undefined,
          })),
          participants: r.participants.map((p) => ({
            id: p.socketId || p.id,
            username: p.username,
            isHost: p.isHost,
            isOnline: false, // reset online status on startup
            avatarUrl: p.avatarUrl || undefined,
          })),
          chatHistory: r.chatHistory.map((c) => ({
            id: c.id,
            username: c.username,
            message: c.message,
            timestamp: Number(c.timestamp),
          })),
          theme: r.theme,
          djs: [],
          currentDjIndex: 0,
          scheduledStartTime: r.scheduledStartTime ? r.scheduledStartTime.getTime() : undefined,
          isStarted: r.isStarted,
        };

        this.rooms.set(room.roomId, room);
      }
      console.log(`✅ Hydrated ${dbRooms.length} room spaces from database.`);
    } catch (e) {
      console.log('⚠️ Hydration warning (database empty or starting fresh):', (e as any).message);
    }
  }

  private generateRoomCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    do {
      code = '';
      for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }
    } while (this.rooms.has(code));
    return code;
  }

  public createRoom(
    roomName: string,
    hostUsername: string,
    socketId: string,
    settings: RoomSettings,
    scheduledStartTime?: number
  ): Room {
    const roomId = this.generateRoomCode();
    const host: Participant = {
      id: socketId,
      username: hostUsername.trim(),
      isHost: true,
      isOnline: true,
    };

    const room: Room = {
      roomId,
      roomName: roomName.trim() || `${hostUsername}'s Room`,
      hostId: socketId,
      settings: {
        isPrivate: settings.isPrivate,
        password: settings.password,
        maxParticipants: settings.maxParticipants,
        collaborativeMode: settings.collaborativeMode,
        enableChat: settings.enableChat ?? true,
        enableReactions: settings.enableReactions ?? true,
        enableVoting: settings.enableVoting ?? true,
        allowEveryoneToAddSongs: settings.allowEveryoneToAddSongs ?? true,
        allowEveryoneToSkip: settings.allowEveryoneToSkip ?? false,
        hostApprovalRequired: settings.hostApprovalRequired ?? false,
        autoPickNext: settings.autoPickNext ?? true,
        djBoothMode: settings.djBoothMode ?? false,
      },
      currentTrack: null,
      playback: {
        isPlaying: false,
        position: 0,
        serverTimestamp: Date.now(),
      },
      queue: [],
      participants: [host],
      chatHistory: [],
      theme: 'Ocean',
      djs: [],
      currentDjIndex: 0,
      scheduledStartTime,
      isStarted: scheduledStartTime ? false : true,
    };

    this.rooms.set(roomId, room);

    // Asynchronously persist to Prisma / PostgreSQL
    prisma.room.create({
      data: {
        roomCode: roomId,
        roomName: room.roomName,
        hostId: null,
        isPrivate: settings.isPrivate,
        passwordHash: settings.password || null,
        maxParticipants: settings.maxParticipants,
        collaborativeMode: settings.collaborativeMode,
        participants: {
          create: {
            socketId,
            username: hostUsername.trim(),
            isHost: true,
            isOnline: true,
          },
        },
      },
    }).catch((err) => console.log('[DB PERSIST] Error persisting room creation:', err.message));

    return room;
  }

  public getRoom(roomId: string): Room | undefined {
    return this.rooms.get(roomId.toUpperCase());
  }

  public joinRoom(
    roomId: string,
    username: string,
    socketId: string,
    password?: string
  ): { room: Room; participant: Participant } {
    const room = this.getRoom(roomId);
    if (!room) {
      throw new Error('Room not found');
    }

    if (room.settings.isPrivate && room.settings.password !== password) {
      throw new Error('Incorrect password');
    }

    const onlineCount = room.participants.filter((p) => p.isOnline).length;
    if (onlineCount >= room.settings.maxParticipants) {
      throw new Error('Room is full');
    }

    let participant = room.participants.find(
      (p) => p.username.toLowerCase() === username.trim().toLowerCase()
    );

    if (participant) {
      if (participant.isOnline) {
        throw new Error('Username is already taken in this room');
      }
      participant.id = socketId;
      participant.isOnline = true;
    } else {
      participant = {
        id: socketId,
        username: username.trim(),
        isHost: room.participants.length === 0,
        isOnline: true,
      };
      room.participants.push(participant);

      // Persist new participant asynchronously
      prisma.room.findUnique({ where: { roomCode: room.roomId } })
        .then((dbRoom) => {
          if (dbRoom) {
            return prisma.participant.create({
              data: {
                roomId: dbRoom.id,
                socketId,
                username: username.trim(),
                isHost: participant!.isHost,
                isOnline: true,
              },
            });
          }
          return null;
        })
        .catch((err) => console.log('[DB PERSIST] Error persisting participant join:', err.message));
    }

    if (!room.participants.some((p) => p.isHost && p.isOnline)) {
      room.hostId = participant.id;
      participant.isHost = true;
    }

    return { room, participant };
  }

  public leaveRoom(roomId: string, socketId: string): { room: Room | null; kickedParticipant?: Participant } {
    const room = this.getRoom(roomId);
    if (!room) return { room: null };

    const participant = room.participants.find((p) => p.id === socketId);
    if (participant) {
      participant.isOnline = false;
    }

    if (room.djs && participant) {
      room.djs = room.djs.filter((name) => name !== participant.username);
    }

    if (participant?.isHost) {
      const nextOnline = room.participants.find((p) => p.isOnline && p.id !== socketId);
      if (nextOnline) {
        participant.isHost = false;
        nextOnline.isHost = true;
        room.hostId = nextOnline.id;
      }
    }

    return { room };
  }

  public deleteRoom(roomId: string): boolean {
    const key = roomId.toUpperCase();
    if (this.rooms.has(key)) {
      this.rooms.delete(key);
      return true;
    }
    return false;
  }

  public joinDjBooth(roomId: string, username: string): Room | null {
    const room = this.getRoom(roomId);
    if (!room) return null;
    if (!room.djs) room.djs = [];
    if (!room.djs.includes(username)) {
      room.djs.push(username);
    }
    return room;
  }

  public leaveDjBooth(roomId: string, username: string): Room | null {
    const room = this.getRoom(roomId);
    if (!room) return null;
    if (room.djs) {
      room.djs = room.djs.filter((u) => u.toLowerCase() !== username.toLowerCase());
      const curIdx = room.currentDjIndex || 0;
      if (room.djs.length === 0 || curIdx >= room.djs.length) {
        room.currentDjIndex = 0;
      }
    }
    return room;
  }

  public advanceDjRotation(roomId: string): Room | null {
    const room = this.getRoom(roomId);
    if (!room || !room.djs || room.djs.length === 0) return room || null;
    const curIdx = room.currentDjIndex || 0;
    room.currentDjIndex = (curIdx + 1) % room.djs.length;
    return room;
  }

  public handleDisconnect(socketId: string): { roomId: string; room: Room }[] {
    const affectedRooms: { roomId: string; room: Room }[] = [];

    for (const [roomId, room] of this.rooms.entries()) {
      const participant = room.participants.find((p) => p.id === socketId);
      if (participant) {
        participant.isOnline = false;
        
        if (participant.isHost) {
          const nextOnline = room.participants.find((p) => p.isOnline && p.id !== socketId);
          if (nextOnline) {
            participant.isHost = false;
            nextOnline.isHost = true;
            room.hostId = nextOnline.id;
          }
        }
        
        affectedRooms.push({ roomId, room });
      }
    }

    return affectedRooms;
  }
}

export const roomManager = new RoomManager();
