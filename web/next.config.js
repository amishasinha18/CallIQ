/** @type {import('next').NextConfig} */
const nextConfig = {
    // Disabled: React 18 Strict Mode double-invokes effects in dev, and
    // @livekit/components-react's LiveKitRoom manages an imperative WebRTC
    // connection that isn't idempotent under that — the mount→cleanup→remount
    // cycle was tearing down the whisper room connection instantly
    // (observed as a 0-second join on the LiveKit server) before any audio
    // could flow, which is what "whisper isn't working" actually was.
    reactStrictMode: false,
};

module.exports = nextConfig;
