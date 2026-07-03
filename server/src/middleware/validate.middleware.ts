import { Request, Response, NextFunction, RequestHandler } from 'express';
import Joi from 'joi';
import ApiError from '../utils/ApiError';

type ValidationTarget = 'body' | 'params' | 'query';

interface ValidationSchemas {
  body?:   Joi.ObjectSchema;
  params?: Joi.ObjectSchema;
  query?:  Joi.ObjectSchema;
}

const VALIDATION_TARGETS: ValidationTarget[] = ['body', 'params', 'query'];

const validate = (schemas: ValidationSchemas): RequestHandler =>
  (req: Request, _res: Response, next: NextFunction) => {
    for (const target of VALIDATION_TARGETS) {
      const schema = schemas[target];
      if (!schema) continue;

      const { error } = schema.validate(req[target], {
        abortEarly:   false,
        stripUnknown: true,
        convert:      true,
      });

      if (error) {
        const fieldErrors = error.details.map((d) => ({
          field:   d.path.join('.'),
          message: d.message.replace(/['"]/g, ''),
        }));
        const apiErr = ApiError.badRequest(fieldErrors[0].message, fieldErrors);
        apiErr.field = fieldErrors[0].field;
        return next(apiErr);
      }
    }
    next();
  };

export default validate;
module.exports = validate;
module.exports.default = validate;
