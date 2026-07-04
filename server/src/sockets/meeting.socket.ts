import type { Server, Socket } from 'socket.io';

const MeetingNote = require('../models/MeetingNote');
const Meeting     = require('../models/Meeting');
const AIResult    = require('../models/AIResult');
const aiService   = require('../services/ai.service');
const logger      = require('../shared/utils/logger').default;

type MeetingUser = {
  id:       string;
  name:     string;
  avatar?:  string;
  tenantId?: string;
};

type MeetingSocket = Socket & {
  user?: MeetingUser;
  isMuted?: boolean;
  isVideoOff?: boolean;
  isScreenSharing?: boolean;
  // Track which meeting rooms this socket is in for disconnect cleanup
  meetingRooms?: Set<string>;
};

const isValidId = (v: unknown): v is string =>
  typeof v === 'string' && v.trim().length > 0;

// ── Shared helper: build participants list for a room ─────────────────────────
const buildParticipantsList = (
  io: Server,
  roomId: string,
  hostIdStr: string | undefined
): object[] => {
  const room = io.sockets.adapter.rooms.get(`meeting:${roomId}`);
  const participants: object[] = [];
  if (!room) return participants;
  for (const sid of room) {
    const s = io.sockets.sockets.get(sid) as MeetingSocket | undefined;
    if (s?.user) {
      participants.push({
        id:              s.user.id,
        name:            s.user.name,
        avatar:          s.user.avatar,
        socketId:        sid,
        isHost:          hostIdStr ? s.user.id === hostIdStr : false,
        isMuted:         s.isMuted         ?? false,
        isVideoOff:      s.isVideoOff      ?? true,
        isScreenSharing: s.isScreenSharing ?? false,
      });
    }
  }
  return participants;
};

module.exports = (io: Server, socket: MeetingSocket): void => {
  // Track meeting rooms for disconnect cleanup
  socket.meetingRooms = new Set<string>();

  const getUser = (): MeetingUser => {
    if (!socket.user?.id) throw new Error('Unauthenticated socket');
    return socket.user;
  };

  // ── Join ──────────────────────────────────────────────────────────────────
  socket.on('meeting:join', async (roomId: unknown) => {
    if (!isValidId(roomId)) return;
    try {
      const user = getUser();

      const existingMeeting = await Meeting.findOne({ roomId });

      // Block joining an ended meeting
      if (existingMeeting?.status === 'ended') {
        socket.emit('meeting:ended-by-host', { roomId });
        socket.emit('meeting:error', { message: 'This meeting has already ended and cannot be rejoined.' });
        return;
      }

      socket.join(`meeting:${roomId}`);
      socket.join(`chat:${roomId}`);
      socket.meetingRooms!.add(roomId);

      socket.to(`meeting:${roomId}`).emit('meeting:user-joined', {
        socketId: socket.id,
        user: { id: user.id, name: user.name, avatar: user.avatar },
      });

      const hostIdStr = existingMeeting?.host?.toString();
      const participants = buildParticipantsList(io, roomId, hostIdStr);
      const room = io.sockets.adapter.rooms.get(`meeting:${roomId}`);

      io.to(`meeting:${roomId}`).emit('meeting:participant-count', room?.size ?? 0);
      io.to(`meeting:${roomId}`).emit('meeting:participants-list', participants);
    } catch (err) {
      logger.error(`[SOCKET] meeting:join error: ${(err as Error).message}`);
      socket.emit('meeting:error', { message: 'Failed to join meeting. Please try again.' });
    }
  });

  // ── WebRTC signal relay ───────────────────────────────────────────────────
  socket.on('meeting:signal', ({ roomId, signal, to }: { roomId: unknown; signal: unknown; to: unknown }) => {
    if (!isValidId(to as string) || !isValidId(roomId as string)) return;
    const room = io.sockets.adapter.rooms.get(`meeting:${roomId}`);
    if (!room?.has(to as string)) return;
    io.to(to as string).emit('meeting:signal', { signal, from: socket.id });
  });

  // ── Leave ─────────────────────────────────────────────────────────────────
  socket.on('meeting:leave', (roomId: unknown) => {
    if (!isValidId(roomId)) return;
    try {
      const user = getUser();
      socket.leave(`meeting:${roomId}`);
      socket.leave(`chat:${roomId}`);
      socket.meetingRooms?.delete(roomId);

      socket.to(`meeting:${roomId}`).emit('meeting:user-left', {
        socketId: socket.id,
        userId:   user.id,
      });

      const room = io.sockets.adapter.rooms.get(`meeting:${roomId}`);
      io.to(`meeting:${roomId}`).emit('meeting:participant-count', room?.size ?? 0);

      Meeting.findOne({ roomId }).then((mtg: any) => {
        const hostIdStr = mtg?.host?.toString();
        const participants = buildParticipantsList(io, roomId, hostIdStr);
        io.to(`meeting:${roomId}`).emit('meeting:participants-list', participants);
      }).catch(() => {});
    } catch (err) {
      logger.error(`[SOCKET] meeting:leave error: ${(err as Error).message}`);
    }
  });

  // ── Media state ───────────────────────────────────────────────────────────
  socket.on('meeting:media-state', ({ roomId, isMuted, isVideoOff, isScreenSharing }: {
    roomId: unknown; isMuted: boolean; isVideoOff: boolean; isScreenSharing: boolean;
  }) => {
    if (!isValidId(roomId) || !socket.user?.id) return;
    socket.isMuted         = isMuted;
    socket.isVideoOff      = isVideoOff;
    socket.isScreenSharing = isScreenSharing;
    socket.to(`meeting:${roomId}`).emit('meeting:media-state', {
      userId: socket.user.id,
      socketId: socket.id,
      isMuted,
      isVideoOff,
      isScreenSharing,
    });
  });

  // ── Screen share ──────────────────────────────────────────────────────────
  socket.on('meeting:screen-share', ({ roomId, isSharing }: { roomId: unknown; isSharing: boolean }) => {
    if (!isValidId(roomId) || !socket.user?.id) return;
    socket.isScreenSharing = isSharing;
    io.to(`meeting:${roomId}`).emit('meeting:screen-share', {
      userId:   socket.user.id,
      socketId: socket.id,
      name:     socket.user.name,
      isSharing,
    });
  });

  // ── Recording state ───────────────────────────────────────────────────────
  socket.on('recording:started', ({ roomId }: { roomId: unknown }) => {
    if (!isValidId(roomId) || !socket.user?.id) return;
    io.to(`meeting:${roomId}`).emit('recording:started', {
      userId: socket.user.id,
      name:   socket.user.name,
    });
  });

  socket.on('recording:stopped', ({ roomId }: { roomId: unknown }) => {
    if (!isValidId(roomId) || !socket.user?.id) return;
    io.to(`meeting:${roomId}`).emit('recording:stopped', {
      userId: socket.user.id,
      name:   socket.user.name,
    });
  });

  // ── Raise hand ────────────────────────────────────────────────────────────
  socket.on('meeting:raise-hand', ({ roomId, raised }: { roomId: unknown; raised: boolean }) => {
    if (!isValidId(roomId) || !socket.user?.id) return;
    io.to(`meeting:${roomId}`).emit('meeting:raise-hand', {
      userId: socket.user.id,
      name:   socket.user.name,
      raised,
    });
  });

  // ── Live Notes ────────────────────────────────────────────────────────────
  socket.on('notes:join',  (meetingId: unknown) => { if (isValidId(meetingId)) socket.join(`notes:${meetingId}`); });
  socket.on('notes:leave', (meetingId: unknown) => { if (isValidId(meetingId)) socket.leave(`notes:${meetingId}`); });

  socket.on('notes:update', async ({ meetingId, content }: { meetingId: unknown; content: unknown }) => {
    if (!isValidId(meetingId) || !socket.user?.id || content == null) return;
    if (typeof content !== 'string') return;
    if (content.length > 50000) {
      socket.emit('meeting:error', { message: 'Notes content exceeds the 50,000 character limit.' });
      return;
    }
    try {
      await MeetingNote.findOneAndUpdate(
        { meeting: meetingId },
        {
          $set:         { content, lastEditedBy: socket.user.id },
          $setOnInsert: { meeting: meetingId, tenantId: socket.user.tenantId, createdBy: socket.user.id },
        },
        { upsert: true, new: true }
      );
      // Broadcast to other collaborators in the notes room (not back to sender)
      socket.to(`notes:${meetingId}`).emit('notes:update', {
        content,
        editedBy: { id: socket.user.id, name: socket.user.name },
      });
    } catch (err) {
      logger.error(`[SOCKET] notes:update error: ${(err as Error).message}`);
      socket.emit('meeting:error', { message: 'Failed to save notes. Please try again.' });
    }
  });

  socket.on('notes:cursor', ({ meetingId, position }: { meetingId: unknown; position: unknown }) => {
    if (!isValidId(meetingId) || !socket.user?.id) return;
    socket.to(`notes:${meetingId}`).emit('notes:cursor', {
      userId:   socket.user.id,
      name:     socket.user.name,
      position,
    });
  });

  // ── Transcript chunk ──────────────────────────────────────────────────────
  const MAX_CHUNK_LENGTH = 2000;
  socket.on('meeting:transcript-chunk', async ({ meetingId, chunk }: { meetingId: unknown; chunk: unknown }) => {
    if (!isValidId(meetingId) || !socket.user?.id || typeof chunk !== 'string' || !chunk.trim()) return;
    const safeChunk = chunk.replace(/[\r\n\t\x00-\x1F\x7F]/g, ' ').slice(0, MAX_CHUNK_LENGTH).trim();
    if (!safeChunk) return;
    try {
      await AIResult.findOneAndUpdate(
        { meeting: meetingId },
        {
          $setOnInsert: { meeting: meetingId },
          $push: { transcriptChunks: { text: safeChunk, speaker: socket.user.name, ts: Date.now() } },
        },
        { upsert: true }
      );
      io.to(`meeting:${meetingId}`).emit('meeting:transcript-chunk', {
        chunk:   safeChunk,
        speaker: socket.user.name,
        userId:  socket.user.id,
      });
    } catch (err) {
      logger.error(`[SOCKET] transcript-chunk error: ${(err as Error).message.replace(/[\r\n]/g, ' ')}`);
    }
  });

  // ── End Meeting (host only) ───────────────────────────────────────────────
  socket.on('meeting:end', async ({ roomId }: { roomId: unknown }) => {
    if (!isValidId(roomId)) return;
    try {
      const user = getUser();
      const meeting = await Meeting.findOne({ roomId });

      if (!meeting) {
        socket.emit('meeting:error', { message: 'Meeting not found.' });
        return;
      }
      if (meeting.host.toString() !== user.id) {
        socket.emit('meeting:error', { message: 'Only the host can end the meeting.' });
        return;
      }
      if (meeting.status === 'ended') {
        socket.emit('meeting:error', { message: 'This meeting has already ended.' });
        return;
      }

      const meetingDbId = meeting._id.toString();

      // Mark ended + invalidate joinCode and meetingId so nobody can rejoin.
      // Prefix with 'ENDED_' to make them non-matchable without losing audit trail.
      await Meeting.findOneAndUpdate(
        { roomId },
        {
          $set: {
            status:    'ended',
            endedAt:   new Date(),
            joinCode:  `ENDED_${meeting.joinCode}`,
            meetingId: `ENDED_${meeting.meetingId}`,
          },
        }
      );

      // Notify all participants BEFORE removing them so they receive the event
      io.to(`meeting:${roomId}`).emit('meeting:ended-by-host', { roomId });

      // Kick every socket out of the meeting and chat rooms
      const room = io.sockets.adapter.rooms.get(`meeting:${roomId}`);
      if (room) {
        for (const sid of [...room]) {
          const s = io.sockets.sockets.get(sid) as MeetingSocket | undefined;
          if (s) {
            s.leave(`meeting:${roomId}`);
            s.leave(`chat:${roomId}`);
            s.meetingRooms?.delete(roomId);
          }
        }
      }

      // Fire-and-forget AI pipeline — never blocks the response
      Promise.all([
        aiService.summarize(meetingDbId),
        aiService.getActionItems(meetingDbId),
      ]).then(([summary, actionItems]: [unknown, unknown]) => {
        io.to(`meeting:${meetingDbId}`).emit('ai:summary-ready', { summary, actionItems });
      }).catch((aiErr: Error) => {
        logger.error(`[SOCKET] meeting:end AI pipeline error: ${aiErr.message}`);
      });

    } catch (err) {
      logger.error(`[SOCKET] meeting:end error: ${(err as Error).message}`);
      socket.emit('meeting:error', { message: 'Failed to end meeting. Please try again.' });
    }
  });

  // ── Meeting ended — secondary AI pipeline event (kept for back-compat) ────
  socket.on('meeting:ended', async ({ meetingId }: { meetingId: unknown }) => {
    if (!isValidId(meetingId)) return;
    try {
      await Meeting.findOneAndUpdate(
        { _id: meetingId, status: { $ne: 'ended' } },
        { $set: { status: 'ended', endedAt: new Date() } }
      );

      io.to(`meeting:${meetingId}`).emit('meeting:force-end');

      setTimeout(() => {
        io.in(`meeting:${meetingId}`).socketsLeave(`meeting:${meetingId}`);
        io.in(`meeting:${meetingId}`).socketsLeave(`chat:${meetingId}`);
      }, 1000);

      const [summary, actionItems] = await Promise.all([
        aiService.summarize(meetingId),
        aiService.getActionItems(meetingId),
      ]);
      io.to(`meeting:${meetingId}`).emit('ai:summary-ready', { summary, actionItems });
    } catch (err) {
      logger.error(`[SOCKET] meeting:ended AI error: ${(err as Error).message}`);
      io.to(`meeting:${meetingId as string}`).emit('ai:error', { message: 'Failed to generate summary' });
    }
  });

  // ── Disconnect cleanup — remove from stale rooms, notify peers ───────────
  socket.on('disconnect', () => {
    if (!socket.meetingRooms?.size || !socket.user?.id) return;

    for (const roomId of socket.meetingRooms) {
      // Notify remaining participants
      socket.to(`meeting:${roomId}`).emit('meeting:user-left', {
        socketId: socket.id,
        userId:   socket.user.id,
      });

      const room = io.sockets.adapter.rooms.get(`meeting:${roomId}`);
      io.to(`meeting:${roomId}`).emit('meeting:participant-count', room?.size ?? 0);

      // Broadcast updated list after a tick so the socket is fully removed
      setImmediate(() => {
        Meeting.findOne({ roomId }).then((mtg: any) => {
          const hostIdStr = mtg?.host?.toString();
          const participants = buildParticipantsList(io, roomId, hostIdStr);
          io.to(`meeting:${roomId}`).emit('meeting:participants-list', participants);
        }).catch(() => {});
      });
    }

    socket.meetingRooms.clear();
  });

  // ── AI assistant ──────────────────────────────────────────────────────────
  socket.on('ai:assistant-message', async ({ meetingId, message, history }: {
    meetingId: unknown; message: unknown; history?: unknown[];
  }) => {
    if (!isValidId(meetingId) || typeof message !== 'string' || !message.trim()) return;
    try {
      const reply = await aiService.assistantChat(meetingId, message, history ?? []);
      socket.emit('ai:assistant-reply', { reply });
    } catch (err) {
      logger.error(`[SOCKET] ai:assistant error: ${(err as Error).message}`);
      socket.emit('ai:assistant-reply', { reply: 'Sorry, I encountered an error. Please try again.' });
    }
  });

  // ── AI minutes ────────────────────────────────────────────────────────────
  socket.on('ai:generate-minutes', async ({ meetingId }: { meetingId: unknown }) => {
    if (!isValidId(meetingId)) return;
    try {
      const minutes = await aiService.generateMeetingMinutes(meetingId);
      socket.emit('ai:minutes-ready', { minutes });
    } catch (err) {
      logger.error(`[SOCKET] ai:generate-minutes error: ${(err as Error).message}`);
      socket.emit('ai:error', { message: 'Failed to generate meeting minutes' });
    }
  });
};

export {};
