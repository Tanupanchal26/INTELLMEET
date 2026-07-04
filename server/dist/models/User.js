"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const crypto_1 = __importDefault(require("crypto"));
const constants_1 = require("../constants");
const ROLE_VALUES = Object.values(constants_1.ROLES);
const STATUS_VALUES = Object.values(constants_1.USER_STATUS);
const userSchema = new mongoose_1.default.Schema({
    // ── Identity ───────────────────────────────────────────────────────────────
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 50 },
    email: { type: String, required: true, lowercase: true, trim: true },
    password: { type: String, minlength: 8, select: false },
    avatar: { type: String, default: '' },
    // ── OAuth ──────────────────────────────────────────────────────────────────
    googleId: { type: String, default: null, index: true },
    provider: { type: String, enum: ['local', 'google'], default: 'local' },
    emailVerified: { type: Boolean, default: false },
    // ── Tenant ─────────────────────────────────────────────────────────────────
    tenantId: { type: mongoose_1.default.Schema.Types.ObjectId, ref: 'Tenant', default: null, index: true },
    // ── RBAC ───────────────────────────────────────────────────────────────────
    role: { type: String, enum: ROLE_VALUES, default: constants_1.ROLES.MEMBER },
    // ── Account state ──────────────────────────────────────────────────────────
    status: { type: String, enum: STATUS_VALUES, default: constants_1.USER_STATUS.ACTIVE },
    isVerified: { type: Boolean, default: false },
    lastLogin: { type: Date, default: null },
    // ── Brute-force / lockout ──────────────────────────────────────────────────
    loginAttempts: { type: Number, default: 0, select: false },
    lockUntil: { type: Date, default: null, select: false },
    // ── Email verification ─────────────────────────────────────────────────────
    emailVerifyToken: { type: String, select: false },
    emailVerifyExpires: { type: Date, select: false },
    // ── Password reset ─────────────────────────────────────────────────────────
    passwordResetToken: { type: String, select: false },
    passwordResetExpires: { type: Date, select: false },
    passwordChangedAt: { type: Date, select: false },
}, { timestamps: true });
// ── Indexes ───────────────────────────────────────────────────────────────────
userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ passwordResetToken: 1 });
userSchema.index({ emailVerifyToken: 1 });
// ── Virtual: isLocked ─────────────────────────────────────────────────────────
userSchema.virtual('isLocked').get(function () {
    return this.lockUntil && this.lockUntil.getTime() > Date.now();
});
// ── Pre-save: hash password only when modified ────────────────────────────────
userSchema.pre('save', async function (next) {
    if (!this.isModified('password') || !this.password)
        return next();
    this.password = await bcryptjs_1.default.hash(this.password, constants_1.AUTH.BCRYPT_ROUNDS);
    // Mark passwordChangedAt so existing tokens are invalidated (skip on new user)
    if (!this.isNew) {
        this.passwordChangedAt = new Date(Date.now() - 1000); // 1s back to avoid race with token iat
    }
    next();
});
// ── Instance: compare password ────────────────────────────────────────────────
userSchema.methods.comparePassword = function (candidatePassword) {
    return bcryptjs_1.default.compare(candidatePassword, this.password);
};
// ── Instance: increment login attempts + auto-lock ───────────────────────────
userSchema.methods.incLoginAttempts = async function () {
    // If previous lock has expired, reset
    if (this.lockUntil && this.lockUntil < Date.now()) {
        return this.updateOne({
            $set: { loginAttempts: 1 },
            $unset: { lockUntil: 1 },
        });
    }
    const updates = { $inc: { loginAttempts: 1 } };
    if (this.loginAttempts + 1 >= constants_1.AUTH.MAX_LOGIN_ATTEMPTS && !this.isLocked) {
        updates.$set = { lockUntil: new Date(Date.now() + constants_1.AUTH.LOCK_DURATION_MINUTES * 60 * 1000) };
    }
    return this.updateOne(updates);
};
// ── Instance: reset login attempts after successful login ─────────────────────
userSchema.methods.resetLoginAttempts = function () {
    return this.updateOne({
        $set: { loginAttempts: 0, lastLogin: new Date() },
        $unset: { lockUntil: 1 },
    });
};
// ── Instance: generate a hashed token (email verify / password reset) ─────────
userSchema.methods.createToken = function (type) {
    // Raw token sent to user (never stored)
    const raw = crypto_1.default.randomBytes(32).toString('hex');
    // Hashed token stored in DB
    const hashed = crypto_1.default.createHash('sha256').update(raw).digest('hex');
    if (type === 'emailVerify') {
        this.emailVerifyToken = hashed;
        this.emailVerifyExpires = new Date(Date.now() + constants_1.AUTH.VERIFY_TOKEN_EXPIRES);
    }
    else {
        this.passwordResetToken = hashed;
        this.passwordResetExpires = new Date(Date.now() + constants_1.AUTH.RESET_TOKEN_EXPIRES);
    }
    return raw; // return plain token for URL
};
// ── Serialise: strip sensitive fields from JSON output ───────────────────────
userSchema.methods.toJSON = function () {
    const obj = this.toObject();
    delete obj.password;
    delete obj.loginAttempts;
    delete obj.lockUntil;
    delete obj.emailVerifyToken;
    delete obj.emailVerifyExpires;
    delete obj.passwordResetToken;
    delete obj.passwordResetExpires;
    delete obj.passwordChangedAt;
    delete obj.__v;
    return obj;
};
const UserModel = mongoose_1.default.model('User', userSchema);
exports.default = UserModel;
module.exports = UserModel;
module.exports.default = UserModel;
