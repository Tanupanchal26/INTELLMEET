import Joi from 'joi';
import { mongoId, idParam } from './common.schema';

export const createTeam = {
  body: Joi.object({
    name:        Joi.string().trim().min(2).max(80).required(),
    description: Joi.string().max(500).allow('').optional(),
    avatar:      Joi.string().uri().allow('').optional(),
    isPrivate:   Joi.boolean().default(false),
    settings: Joi.object({
      allowGuestInvite: Joi.boolean(),
      notifyOnMessage:  Joi.boolean(),
    }).optional(),
  }),
};

export const updateTeam = {
  params: Joi.object({ id: mongoId.required() }),
  body: Joi.object({
    name:        Joi.string().trim().min(2).max(80),
    description: Joi.string().max(500).allow(''),
    avatar:      Joi.string().uri().allow(''),
    isPrivate:   Joi.boolean(),
    settings: Joi.object({
      allowGuestInvite: Joi.boolean(),
      notifyOnMessage:  Joi.boolean(),
    }),
  }).min(1),
};

export const teamParam = idParam;

export const memberParam = {
  params: Joi.object({ id: mongoId.required(), userId: mongoId.required() }),
};

export const inviteMember = {
  params: Joi.object({ id: mongoId.required() }),
  body: Joi.object({
    userId: mongoId.required(),
    role:   Joi.string().valid('admin', 'member', 'guest').default('member'),
  }),
};

export const inviteByEmail = {
  params: Joi.object({ id: mongoId.required() }),
  body: Joi.object({
    email: Joi.string().email().required(),
    role:  Joi.string().valid('admin', 'member', 'guest').default('member'),
  }),
};

export const updateMemberRole = {
  params: Joi.object({ id: mongoId.required(), userId: mongoId.required() }),
  body: Joi.object({
    role: Joi.string().valid('admin', 'member', 'guest').required(),
  }),
};
