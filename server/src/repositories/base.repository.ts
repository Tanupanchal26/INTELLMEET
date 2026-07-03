import ApiError from '../utils/ApiError';
import { paginate } from '../utils/helpers';
import { Model } from 'mongoose';

type TenantId = unknown;

interface FindAllOptions {
  page?:     number;
  limit?:    number;
  sort?:     Record<string, 1 | -1>;
  populate?: unknown;
}

class BaseRepository {
  protected Model: Model<any>;

  constructor(Model: Model<any>) {
    this.Model = Model;
  }

  private scope(tenantId: TenantId, extra: Record<string, unknown> = {}): Record<string, unknown> {
    return tenantId ? { tenantId, ...extra } : extra;
  }

  async findAll(tenantId: TenantId, filter: Record<string, unknown> = {}, options: FindAllOptions = {}) {
    const { page, limit, sort = { createdAt: -1 as const }, populate } = options;
    const query = this.Model.find(this.scope(tenantId, filter)).sort(sort);
    if (populate) query.populate(populate as Parameters<typeof query.populate>[0]);

    if (page || limit) {
      const { query: paginatedQ, page: p, limit: l } = paginate(query as never, { page, limit });
      const [data, total] = await Promise.all([paginatedQ, this.count(tenantId, filter)]);
      return { data, total, page: p, limit: l };
    }

    return query.lean();
  }

  async findById(id: unknown, tenantId: TenantId, populate?: unknown) {
    const query = this.Model.findOne(this.scope(tenantId, { _id: id }));
    if (populate) query.populate(populate as Parameters<typeof query.populate>[0]);
    const doc = await query;
    if (!doc) throw ApiError.notFound(`${this.Model.modelName} not found`);
    return doc;
  }

  async findOne(filter: Record<string, unknown>, tenantId: TenantId) {
    return this.Model.findOne(this.scope(tenantId, filter));
  }

  async create(data: Record<string, unknown>) {
    return this.Model.create(data);
  }

  async updateById(id: unknown, tenantId: TenantId, update: Record<string, unknown>) {
    const doc = await this.Model.findOneAndUpdate(
      this.scope(tenantId, { _id: id }),
      update,
      { new: true, runValidators: true }
    );
    if (!doc) throw ApiError.notFound(`${this.Model.modelName} not found`);
    return doc;
  }

  async deleteById(id: unknown, tenantId: TenantId) {
    const doc = await this.Model.findOneAndDelete(this.scope(tenantId, { _id: id }));
    if (!doc) throw ApiError.notFound(`${this.Model.modelName} not found`);
    return doc;
  }

  async count(tenantId: TenantId, filter: Record<string, unknown> = {}) {
    return this.Model.countDocuments(this.scope(tenantId, filter));
  }
}

export default BaseRepository;
module.exports = BaseRepository;
module.exports.default = BaseRepository;
