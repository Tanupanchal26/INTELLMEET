"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// @ts-nocheck
const Tenant = require('../models/Tenant');
const Team = require('../models/Team');
const Channel = require('../models/Channel');
const logger = require('../shared/utils/logger').default;
/**
 * Converts a string to a URL-safe slug.
 * Exported so callers don't duplicate this logic.
 */
const toSlug = (str) => str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
/**
 * Ensures a user has a tenant, default team, and default channel.
 * Safe to call multiple times — no-ops if tenantId already set.
 * Used only at account creation (signup + Google OAuth first login).
 */
const ensureUserTenant = async (user) => {
    if (user.tenantId)
        return user;
    const tenantSlug = `${toSlug(user.name ?? 'user')}-${Date.now()}`;
    const tenant = await Tenant.create({
        name: `${user.name ?? 'User'}'s Workspace`,
        slug: tenantSlug,
    });
    user.tenantId = tenant._id;
    await user.save({ validateBeforeSave: false });
    const team = await Team.create({
        tenantId: tenant._id,
        name: 'General',
        slug: 'general',
        createdBy: user._id,
        members: [{ user: user._id, role: 'owner' }],
    });
    await Channel.create({
        tenantId: tenant._id,
        team: team._id,
        name: 'general',
        slug: 'general',
        type: 'public',
        isDefault: true,
        createdBy: user._id,
        members: [user._id],
    });
    logger.info(`[TENANT] Provisioned workspace for user ${user._id}`);
    return user;
};
module.exports = { toSlug, ensureUserTenant };
