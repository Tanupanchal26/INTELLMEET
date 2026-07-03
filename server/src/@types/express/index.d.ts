import { Types } from 'mongoose';

export interface AuthUser {
  _id: Types.ObjectId | string;
  name: string;
  email: string;
  role: string;
  status: string;
  tenantId?: Types.ObjectId | string | null;
  isVerified: boolean;
  passwordChangedAt?: Date;
  [key: string]: unknown;
}

declare global {
  namespace Express {
    interface User extends AuthUser {}
    interface Request {
      user?: AuthUser;
      tenantId?: Types.ObjectId | string | null;
      tenantFilter?: Record<string, unknown>;
    }
  }
}
