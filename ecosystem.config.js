module.exports = {
    apps: [
        {
            name: 'cc-livekit',
            cwd: '/opt/webrtc/livekit',
            script: './start.sh',
            interpreter: 'bash',
        },
        {
            name: 'cc-server',
            cwd: '/opt/webrtc/server',
            script: 'src/index.js',
        },
        {
            name: 'cc-web',
            cwd: '/opt/webrtc/web',
            script: 'npm',
            args: 'run dev',
        },
    ],
};
