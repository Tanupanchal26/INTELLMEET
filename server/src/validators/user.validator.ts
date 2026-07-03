import Joi from 'joi';
import { ROLES } from '../constants';

export const updateProfile = {
  body: Joi.object({
    name: Joi.string().trim().min(2).max(50),
  }).min(1).messages({
    'object.min': 'At least one field is required',
  }),
};

export const updateRole = {
  params: Joi.object({
    userId: Joi.string().required(),
  }),
  body: Joi.object({
    role: Joi.string().valid(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.MEMBER, ROLES.GUEST).required(),
  }),
};
