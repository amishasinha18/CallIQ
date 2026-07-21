#!/usr/bin/env bash
# Self-hosted LiveKit SFU for local dev. No Docker/cloud account required.
# API key/secret below are dev-only defaults — must be replaced before any real deployment.
set -e
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec "$DIR/bin/livekit-server" \
  --dev \
  --keys "devkey: secret" \
  --bind 0.0.0.0 \
  --udp-port 50000-50100 \
  --node-ip 62.238.34.202
