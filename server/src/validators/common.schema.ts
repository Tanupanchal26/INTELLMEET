import Joi from 'joi';

export const mongoId = Joi.string().hex().length(24);

export const password = Joi.string()
  .min(8)
  .max(64)
  .messages({
    'string.min': 'Password must be at least 8 characters',
    'string.max': 'Password must not exceed 64 characters',
  })
  .required();

export const email = Joi.string().email().lowercase().required();

export const pagination = Joi.object({
  page:  Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
});

export const idParam = { params: Joi.object({ id: mongoId.required() }) };
