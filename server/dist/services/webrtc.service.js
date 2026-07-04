"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// @ts-nocheck
// WebRTC signaling helpers - actual P2P is handled via socket events
exports.generateIceServers = () => [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
];
