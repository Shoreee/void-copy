#!/bin/sh

# Fix permissions for the workspace directory
sudo chown -R node:node .

# Manual installation of desktop-lite dependencies (if needed)
# Run this manually if you need GUI support:
sudo apt-get update && sudo apt-get install -y fluxbox tigervnc-standalone-server tigervnc-common x11-utils x11-xserver-utils xdg-utils

npm i
npm run electron
