export const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    // Free TURN servers for NAT traversal (production should use a dedicated TURN)
    {
      urls: 'turn:openrelay.metered.ca:80',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
    {
      urls: 'turn:openrelay.metered.ca:443',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
    {
      urls: 'turn:openrelay.metered.ca:443?transport=tcp',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
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
