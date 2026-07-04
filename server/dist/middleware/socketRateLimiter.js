"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// @ts-nocheck
const logger = require('../shared/utils/logger').default;
const WINDOW_MS = 60 * 1000; // 1 minute
const MAX_HITS = 30;
// ip -> array of timestamps within the current window
const hitMap = new Map();
// Prune stale entries every 5 minutes to prevent unbounded memory growth
setInterval(() => {
    const cutoff = Date.now() - WINDOW_MS;
    for (const [ip, hits] of hitMap.entries()) {
        const fresh = hits.filter((t) => t > cutoff);
        if (fresh.length === 0)
            hitMap.delete(ip);
        else
            hitMap.set(ip, fresh);
    }
}, 5 * 60 * 1000).unref();
module.exports = (socket, next) => {
    const rawIp = socket.handshake.address ?? 'unknown';
    // Sanitize IP before logging to prevent log injection
    const ip = String(rawIp).replace(/[\r\n\t\x00-\x1f\x7f]/g, '_').slice(0, 64);
    const now = Date.now();
    const cutoff = now - WINDOW_MS;
    const hits = (hitMap.get(ip) ?? []).filter((t) => t > cutoff);
    hits.push(now);
    hitMap.set(ip, hits);
    if (hits.length > MAX_HITS) {
        logger.warn(`[SOCKET] Rate limit exceeded for IP: ${ip}`);
        return next(new Error('Too many socket connections — rate limit exceeded'));
    }
    next();
};
