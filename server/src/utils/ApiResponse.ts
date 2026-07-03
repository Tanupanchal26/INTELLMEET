import { Response } from 'express';

export interface PaginationMeta {
  page:       number;
  limit:      number;
  total:      number;
  totalPages: number;
  hasNext:    boolean;
  hasPrev:    boolean;
}

export class ApiResponse<T = unknown> {
  readonly success:    boolean;
  readonly statusCode: number;
  readonly message:    string;
  readonly data?:      T;
  readonly meta?:      PaginationMeta;
  requestId?: string;

  constructor(statusCode: number, message: string, data?: T, meta?: PaginationMeta) {
    this.success    = statusCode < 400;
    this.statusCode = statusCode;
    this.message    = message;
    if (data  !== undefined) this.data = data;
    if (meta  !== undefined) this.meta = meta;
  }

  send(res: Response): Response {
    if (res.locals?.requestId) this.requestId = res.locals.requestId as string;
    return res.status(this.statusCode).json(this);
  }

  static ok<T>(res: Response, data: T, message = 'Success', meta?: PaginationMeta): Response {
    return new ApiResponse<T>(200, message, data, meta).send(res);
  }

  static created<T>(res: Response, data: T, message = 'Created successfully'): Response {
    return new ApiResponse<T>(201, message, data).send(res);
  }

  static noContent(res: Response): Response {
    return res.status(204).send();
  }

  static paginated<T>(
    res:  Response,
    data: T,
    meta: Pick<PaginationMeta, 'page' | 'limit' | 'total'>
  ): Response {
    const fullMeta: PaginationMeta = {
      ...meta,
      totalPages: Math.ceil(meta.total / meta.limit),
      hasNext:    meta.page * meta.limit < meta.total,
      hasPrev:    meta.page > 1,
    };
    return new ApiResponse<T>(200, 'Success', data, fullMeta).send(res);
  }
}

export default ApiResponse;
