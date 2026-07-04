"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const ApiError_1 = __importDefault(require("../utils/ApiError"));
const helpers_1 = require("../utils/helpers");
class BaseRepository {
    Model;
    constructor(Model) {
        this.Model = Model;
    }
    scope(tenantId, extra = {}) {
        return tenantId ? { tenantId, ...extra } : extra;
    }
    async findAll(tenantId, filter = {}, options = {}) {
        const { page, limit, sort = { createdAt: -1 }, populate } = options;
        const query = this.Model.find(this.scope(tenantId, filter)).sort(sort);
        if (populate)
            query.populate(populate);
        if (page || limit) {
            const { query: paginatedQ, page: p, limit: l } = (0, helpers_1.paginate)(query, { page, limit });
            const [data, total] = await Promise.all([paginatedQ, this.count(tenantId, filter)]);
            return { data, total, page: p, limit: l };
        }
        return query.lean();
    }
    async findById(id, tenantId, populate) {
        const query = this.Model.findOne(this.scope(tenantId, { _id: id }));
        if (populate)
            query.populate(populate);
        const doc = await query;
        if (!doc)
            throw ApiError_1.default.notFound(`${this.Model.modelName} not found`);
        return doc;
    }
    async findOne(filter, tenantId) {
        return this.Model.findOne(this.scope(tenantId, filter));
    }
    async create(data) {
        return this.Model.create(data);
    }
    async updateById(id, tenantId, update) {
        const doc = await this.Model.findOneAndUpdate(this.scope(tenantId, { _id: id }), update, { new: true, runValidators: true });
        if (!doc)
            throw ApiError_1.default.notFound(`${this.Model.modelName} not found`);
        return doc;
    }
    async deleteById(id, tenantId) {
        const doc = await this.Model.findOneAndDelete(this.scope(tenantId, { _id: id }));
        if (!doc)
            throw ApiError_1.default.notFound(`${this.Model.modelName} not found`);
        return doc;
    }
    async count(tenantId, filter = {}) {
        return this.Model.countDocuments(this.scope(tenantId, filter));
    }
}
exports.default = BaseRepository;
module.exports = BaseRepository;
module.exports.default = BaseRepository;
