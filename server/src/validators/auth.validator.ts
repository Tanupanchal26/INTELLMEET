import Joi from 'joi';
import { mongoId, password, email, idParam } from './common.schema';
import { ROLES } from '../constants';

export const signup = {
  body: Joi.object({
    name:     Joi.string().trim().min(2).max(50).required()
              .messages({ 'string.min': 'Name must be at least 2 characters' }),
    email,
    password,
    role:     Joi.string().valid(ROLES.MEMBER).default(ROLES.MEMBER),
  }),
};

export const login = {
  body: Joi.object({
    email,
    password: Joi.string().required(),
  }),
};

export const refreshToken = {
  body: Joi.object({
    refreshToken: Joi.string().optional(),
  }),
};

export const forgotPassword = {
  body: Joi.object({ email }),
};

export const resetPassword = {
  params: Joi.object({ token: Joi.string().required() }),
  body: Joi.object({
    password,
    confirmPassword: Joi.string()
      .valid(Joi.ref('password')).required()
      .messages({ 'any.only': 'Passwords do not match' }),
  }),
};

export const verifyEmail = {
  params: Joi.object({ token: Joi.string().required() }),
};

export const changePassword = {
  body: Joi.object({
    currentPassword: Joi.string().required(),
    newPassword:     password,
    confirmPassword: Joi.string()
      .valid(Joi.ref('newPassword')).required()
      .messages({ 'any.only': 'Passwords do not match' }),
  }),
};
