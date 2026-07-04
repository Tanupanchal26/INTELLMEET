"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const ApiError_1 = __importDefault(require("../utils/ApiError"));
const VALIDATION_TARGETS = ['body', 'params', 'query'];
const validate = (schemas) => (req, _res, next) => {
    for (const target of VALIDATION_TARGETS) {
        const schema = schemas[target];
        if (!schema)
            continue;
        const { error } = schema.validate(req[target], {
            abortEarly: false,
            stripUnknown: true,
            convert: true,
        });
        if (error) {
            const fieldErrors = error.details.map((d) => ({
                field: d.path.join('.'),
                message: d.message.replace(/['"]/g, ''),
            }));
            const apiErr = ApiError_1.default.badRequest(fieldErrors[0].message, fieldErrors);
            apiErr.field = fieldErrors[0].field;
            return next(apiErr);
        }
    }
    next();
};
exports.default = validate;
module.exports = validate;
module.exports.default = validate;
