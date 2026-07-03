import Joi from 'joi';
import { mongoId, idParam, pagination } from './common.schema';

export const listNotifications = {
  query: pagination.keys({
    unreadOnly: Joi.boolean().default(false),
  }),
};

export const notifParam = idParam;
