const TURN_USERNAME   = import.meta.env.VITE_TURN_USERNAME   ?? 'openrelayproject';
const TURN_CREDENTIAL = import.meta.env.VITE_TURN_CREDENTIAL ?? 'openrelayproject';
const TURN_URL_1      = import.meta.env.VITE_TURN_URL_1      ?? 'turn:openrelay.metered.ca:80';
const TURN_URL_2      = import.meta.env.VITE_TURN_URL_2      ?? 'turn:openrelay.metered.ca:443';
const TURN_URL_3      = import.meta.env.VITE_TURN_URL_3      ?? 'turn:openrelay.metered.ca:443?transport=tcp';

export const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: TURN_URL_1, username: TURN_USERNAME, credential: TURN_CREDENTIAL },
    { urls: TURN_URL_2, username: TURN_USERNAME, credential: TURN_CREDENTIAL },
    { urls: TURN_URL_3, username: TURN_USERNAME, credential: TURN_CREDENTIAL },
  ],
  iceCandidatePoolSize: 10,
  bundlePolicy: 'max-bundle',
  rtcpMuxPolicy: 'require',
};

export const createPeerConnection = (
  onIceCandidate: (event: RTCPeerConnectionIceEvent) => void,
  onTrack: (event: RTCTrackEvent) => void
): RTCPeerConnection => {
  const pc = new RTCPeerConnection(RTC_CONFIG);
  pc.onicecandidate = onIceCandidate;
  pc.ontrack = onTrack;

  pc.oniceconnectionstatechange = () => {
    if (pc.iceConnectionState === 'failed') {
      pc.restartIce();
    }
    if (pc.iceConnectionState === 'disconnected') {
      setTimeout(() => {
        if (pc.iceConnectionState === 'disconnected') pc.restartIce();
      }, 3000);
    }
  };

  return pc;
};

export const closePeerConnection = (pc: RTCPeerConnection | null) => {
  if (!pc) return;
  pc.onicecandidate = null;
  pc.ontrack = null;
  pc.oniceconnectionstatechange = null;
  pc.getSenders().forEach(s => { try { pc.removeTrack(s); } catch {} });
  pc.close();
};
