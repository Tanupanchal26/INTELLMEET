import mongoose, { Document, Schema, Types } from 'mongoose';
import { MEETING_STATUS } from '../constants';

export interface IInvitee {
  user:   Types.ObjectId | null;
  email:  string;
  status: 'pending' | 'accepted' | 'declined';
}

export interface IAgendaItem {
  title:    string;
  duration: number;
  order:    number;
}

export interface IMeetingSettings {
  waitingRoom:      boolean;
  muteOnEntry:      boolean;
  recordingEnabled: boolean;
  chatEnabled:      boolean;
  password?:        string;
}

export interface IMeeting extends Document {
  tenantId:     Types.ObjectId | null;
  team:         Types.ObjectId | null;
  title:        string;
  description:  string;
  host:         Types.ObjectId;
  participants: Types.ObjectId[];
  invitees:     IInvitee[];
  meetingId:    string;
  joinCode:     string;
  roomId:       string;
  status:       string;
  scheduledAt:  Date | null;
  startedAt:    Date | null;
  endedAt:      Date | null;
  duration:     number;
  maxDuration:  number;
  agenda:       IAgendaItem[];
  isRecurring:  boolean;
  recurrence: {
    frequency: string;
    until:     Date | null;
  };
  settings:     IMeetingSettings;
  recordingUrl: string;
  transcript:   string;
  summary:      string;
  actionItems:  { text: string; assignee: string; dueDate: Date }[];
  sentiment:    string;
  createdAt:    Date;
  updatedAt:    Date;
}

const inviteeSchema = new Schema<IInvitee>(
  {
    user:   { type: Schema.Types.ObjectId, ref: 'User', default: null },
    email:  { type: String, default: '' },
    status: { type: String, enum: ['pending', 'accepted', 'declined'], default: 'pending' },
  },
  { _id: false }
);

const meetingSchema = new Schema<IMeeting>(
  {
    tenantId:     { type: Schema.Types.ObjectId, ref: 'Tenant', required: false, default: null, index: true },
    team:         { type: Schema.Types.ObjectId, ref: 'Team', default: null },
    title:        { type: String, required: true, trim: true, minlength: 3, maxlength: 120 },
    description:  { type: String, default: '', maxlength: 1000 },
    host:         { type: Schema.Types.ObjectId, ref: 'User', required: true },
    participants: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    invitees:     { type: [inviteeSchema], default: [] },

    meetingId:    { type: String, required: true, unique: true },
    joinCode:     { type: String, required: true, unique: true },
    roomId:       { type: String, required: true },
    status:       { type: String, enum: Object.values(MEETING_STATUS), default: MEETING_STATUS.SCHEDULED },

    scheduledAt:  { type: Date, default: null },
    startedAt:    { type: Date, default: null },
    endedAt:      { type: Date, default: null },
    duration:     { type: Number, default: 0 },
    maxDuration:  { type: Number, default: 60 },

    agenda: [
      {
        title:    { type: String, maxlength: 200 },
        duration: { type: Number, default: 5 },
        order:    { type: Number, default: 0 },
      },
    ],

    isRecurring: { type: Boolean, default: false },
    recurrence: {
      frequency: { type: String, enum: ['daily', 'weekly', 'biweekly', 'monthly'], default: 'weekly' },
      until:     { type: Date, default: null },
    },

    settings: {
      waitingRoom:      { type: Boolean, default: false },
      muteOnEntry:      { type: Boolean, default: false },
      recordingEnabled: { type: Boolean, default: false },
      chatEnabled:      { type: Boolean, default: true },
      password:         { type: String, default: '', select: false },
    },

    recordingUrl: { type: String, default: '' },
    transcript:   { type: String, default: '' },
    summary:      { type: String, default: '' },
    actionItems:  [{ text: String, assignee: String, dueDate: Date }],
    sentiment:    { type: String, default: '' },
  },
  { timestamps: true }
);

meetingSchema.index({ tenantId: 1, status: 1 });
meetingSchema.index({ tenantId: 1, scheduledAt: 1 });
meetingSchema.index({ tenantId: 1, host: 1 });
meetingSchema.index({ tenantId: 1, createdAt: -1 });
meetingSchema.index({ tenantId: 1, participants: 1 });
meetingSchema.index({ roomId: 1 }, { unique: true });
meetingSchema.index({ meetingId: 1 }, { unique: true });
meetingSchema.index({ joinCode: 1 }, { unique: true });

const Meeting = mongoose.model<IMeeting>('Meeting', meetingSchema);

export default Meeting;
module.exports = Meeting;
module.exports.default = Meeting;
