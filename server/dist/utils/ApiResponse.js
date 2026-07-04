"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApiResponse = void 0;
class ApiResponse {
    success;
    statusCode;
    message;
    data;
    meta;
    requestId;
    constructor(statusCode, message, data, meta) {
        this.success = statusCode < 400;
        this.statusCode = statusCode;
        this.message = message;
        if (data !== undefined)
            this.data = data;
        if (meta !== undefined)
            this.meta = meta;
    }
    send(res) {
        if (res.locals?.requestId)
            this.requestId = res.locals.requestId;
        return res.status(this.statusCode).json(this);
    }
    static ok(res, data, message = 'Success', meta) {
        return new ApiResponse(200, message, data, meta).send(res);
    }
    static created(res, data, message = 'Created successfully') {
        return new ApiResponse(201, message, data).send(res);
    }
    static noContent(res) {
        return res.status(204).send();
    }
    static paginated(res, data, meta) {
        const fullMeta = {
            ...meta,
            totalPages: Math.ceil(meta.total / meta.limit),
            hasNext: meta.page * meta.limit < meta.total,
            hasPrev: meta.page > 1,
        };
        return new ApiResponse(200, 'Success', data, fullMeta).send(res);
    }
}
exports.ApiResponse = ApiResponse;
exports.default = ApiResponse;
