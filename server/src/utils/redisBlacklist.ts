import jwt from 'jsonwebtoken';
import mongoose, { Schema, Document, Model } from 'mongoose';

interface IBlacklistedToken extends Document {
  token: string;
  expiresAt: Date;
}

const BlacklistedTokenSchema = new Schema<IBlacklistedToken>({
  token:     { type: String, required: true, unique: true, index: true },
  expiresAt: { type: Date,   required: true, index: { expireAfterSeconds: 0 } },
});

const BlacklistedToken: Model<IBlacklistedToken> = mongoose.models.BlacklistedToken ||
  mongoose.model<IBlacklistedToken>('BlacklistedToken', BlacklistedTokenSchema);

interface JwtPayload { exp?: number; }

export const addToBlacklist = async (token: string): Promise<void> => {
  const payload = jwt.decode(token) as JwtPayload | null;
  if (!payload?.exp) return;
  const expiresAt = new Date(payload.exp * 1000);
  if (expiresAt <= new Date()) return;
  await BlacklistedToken.updateOne({ token }, { token, expiresAt }, { upsert: true });
};

export const isBlacklisted = async (token: string): Promise<boolean> => {
  const doc = await BlacklistedToken.findOne({ token }).lean();
  return !!doc;
};
