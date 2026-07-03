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
};

// Validate a roomId/meetingId is a non-empty string (basic guard)
const isValidId = (v: unknown): v is string =>
  typeof v === 'string' && v.trim().length > 0;

module.exports = (io: Server, socket: MeetingSocket): void => {
  const getUser = (): MeetingUser => {
    if (!socket.user?.id) throw new Error('Unauthenticated socket');
    return socket.user;
  };

  // ── Join ──────────────────────────────────────────────────────────────────
  socket.on('meeting:join', async (roomId: unknown) => {
    if (!isValidId(roomId)) return;
    try {
      const user = getUser();

      // Block joining an ended meeting
      const existingMeeting = await Meeting.findOne({ roomId });
      if (existingMeeting?.status === 'ended') {
        socket.emit('meeting:ended-by-host', { roomId });
        return;
      }

      socket.join(`meeting:${roomId}`);
      socket.join(`chat:${roomId}`);

      socket.to(`meeting:${roomId}`).emit('meeting:user-joined', {
        socketId: socket.id,
        user: { id: user.id, name: user.name, avatar: user.avatar },
      });

      // Find the meeting host id (reuse existingMeeting already fetched above)
      const hostIdStr = existingMeeting?.host?.toString();

      const room = io.sockets.adapter.rooms.get(`meeting:${roomId}`);
      const participants: object[] = [];
      if (room) {
        for (const sid of room) {
          const s = io.sockets.sockets.get(sid) as MeetingSocket | undefined;
          if (s?.user) {
            participants.push({
              id:         s.user.id,
              name:       s.user.name,
              avatar:     s.user.avatar,
              socketId:   sid,
              isHost:     hostIdStr ? s.user.id === hostIdStr : false,
              isMuted:    s.isMuted ?? false,
              isVideoOff: s.isVideoOff ?? true,
              isScreenSharing: s.isScreenSharing ?? false,
            });
          }
        }
      }
      io.to(`meeting:${roomId}`).emit('meeting:participant-count', room?.size ?? 0);
      io.to(`meeting:${roomId}`).emit('meeting:participants-list', participants);
    } catch (err) {
      logger.error(`[SOCKET] meeting:join error: ${(err as Error).message}`);
    }
  });

  // ── WebRTC signal relay ───────────────────────────────────────────────────
  socket.on('meeting:signal', ({ roomId, signal, to }: { roomId: unknown; signal: unknown; to: unknown }) => {
    if (!isValidId(to as string) || !isValidId(roomId as string)) return;
    // Security: only relay to sockets that are in the same meeting room
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
      socket.to(`meeting:${roomId}`).emit('meeting:user-left', {
        socketId: socket.id,
        userId:   user.id,
      });
      const room = io.sockets.adapter.rooms.get(`meeting:${roomId}`);
      io.to(`meeting:${roomId}`).emit('meeting:participant-count', room?.size ?? 0);
      // Broadcast updated participants list so all clients stay in sync
      const participants: object[] = [];
      if (room) {
        for (const sid of room) {
          const s = io.sockets.sockets.get(sid) as MeetingSocket | undefined;
          if (s?.user) {
            participants.push({
              id: s.user.id, name: s.user.name, avatar: s.user.avatar,
              socketId: sid, isMuted: s.isMuted ?? false,
              isVideoOff: s.isVideoOff ?? true, isScreenSharing: s.isScreenSharing ?? false,
            });
          }
        }
      }
      io.to(`meeting:${roomId}`).emit('meeting:participants-list', participants);
    } catch (err) {
      logger.error(`[SOCKET] meeting:leave error: ${(err as Error).message}`);
    }
  });

  // ── Media state ───────────────────────────────────────────────────────────
  socket.on('meeting:media-state', ({ roomId, isMuted, isVideoOff, isScreenSharing }: {
    roomId: unknown; isMuted: boolean; isVideoOff: boolean; isScreenSharing: boolean;
  }) => {
    if (!isValidId(roomId) || !socket.user?.id) return;
    socket.isMuted = isMuted;
    socket.isVideoOff = isVideoOff;
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
    try {
      await MeetingNote.findOneAndUpdate(
        { meeting: meetingId },
        {
          $set:         { content, lastEditedBy: socket.user.id },
          $setOnInsert: { meeting: meetingId, tenantId: socket.user.tenantId, createdBy: socket.user.id },
        },
        { upsert: true, new: true }
      );
      socket.to(`notes:${meetingId}`).emit('notes:update', {
        content,
        editedBy: { id: socket.user.id, name: socket.user.name },
      });
    } catch (err) {
      logger.error(`[SOCKET] notes:update error: ${(err as Error).message}`);
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
    // Sanitize: strip control characters and cap length to prevent log injection / oversized payloads
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

  // ── End Meeting (host only) ──────────────────────────────────────────────
  socket.on('meeting:end', async ({ roomId }: { roomId: unknown }) => {
    if (!isValidId(roomId)) return;
    try {
      const user = getUser();
      const meeting = await Meeting.findOne({ roomId });
      if (!meeting) return;
      if (meeting.host.toString() !== user.id) {
        socket.emit('meeting:error', { message: 'Only the host can end the meeting' });
        return;
      }
      if (meeting.status === 'ended') return;

      await Meeting.findOneAndUpdate(
        { roomId },
        { $set: { status: 'ended', endedAt: new Date() } }
      );

      const meetingId = meeting._id.toString();

      // Notify AI processing BEFORE disconnecting participants so they receive it
      io.to(`meeting:${roomId}`).emit('ai:processing', { step: 'summary' });

      // Notify all participants the meeting ended
      io.to(`meeting:${roomId}`).emit('meeting:ended-by-host', { roomId });

      // Disconnect all sockets from the room
      const room = io.sockets.adapter.rooms.get(`meeting:${roomId}`);
      if (room) {
        for (const sid of [...room]) {
          const s = io.sockets.sockets.get(sid);
          if (s) {
            s.leave(`meeting:${roomId}`);
            s.leave(`chat:${roomId}`);
          }
        }
      }

      // Trigger AI pipeline (fire-and-forget — clients already received ai:processing)
      try {
        const [summary, actionItems] = await Promise.all([
          aiService.summarize(meetingId),
          aiService.getActionItems(meetingId),
        ]);
        // Emit to meetingId room (notes subscribers may still be connected)
        io.to(`meeting:${meetingId}`).emit('ai:summary-ready', { summary, actionItems });
      } catch (aiErr) {
        logger.error(`[SOCKET] meeting:end AI pipeline error: ${(aiErr as Error).message}`);
      }
    } catch (err) {
      logger.error(`[SOCKET] meeting:end error: ${(err as Error).message}`);
    }
  });

  // ── Meeting ended — AI pipeline (fire-and-forget, never blocks) ───────────
  socket.on('meeting:ended', async ({ meetingId }: { meetingId: unknown }) => {
    if (!isValidId(meetingId)) return;
    try {
      // Only update status if not already ended (idempotent)
      await Meeting.findOneAndUpdate(
        { _id: meetingId, status: { $ne: 'ended' } },
        { $set: { status: 'ended', endedAt: new Date() } }
      );

      // Force disconnect all participants
      io.to(`meeting:${meetingId}`).emit('meeting:force-end');
      
      // We don't remove them from the room immediately so they can receive the force-end event
      setTimeout(() => {
        io.in(`meeting:${meetingId}`).socketsLeave(`meeting:${meetingId}`);
        io.in(`meeting:${meetingId}`).socketsLeave(`chat:${meetingId}`);
      }, 1000);

      const [summary, actionItems] = await Promise.all([
        aiService.summarize(meetingId),
        aiService.getActionItems(meetingId),
      ]);

      // If any clients are still listening (e.g. host on a summary page), they get this
      io.to(`meeting:${meetingId}`).emit('ai:summary-ready', { summary, actionItems });
    } catch (err) {
      logger.error(`[SOCKET] meeting:ended AI error: ${(err as Error).message}`);
      io.to(`meeting:${meetingId as string}`).emit('ai:error', { message: 'Failed to generate summary' });
    }
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
