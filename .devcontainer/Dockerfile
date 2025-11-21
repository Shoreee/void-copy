FROM mcr.microsoft.com/devcontainers/typescript-node:20-bookworm

# Use Aliyun mirror to fix network issues
RUN sed -i 's/deb.debian.org/mirrors.aliyun.com/g' /etc/apt/sources.list.d/debian.sources

# Install Rust manually to avoid Feature bugs
ENV RUSTUP_HOME=/usr/local/rustup \
    CARGO_HOME=/usr/local/cargo \
    PATH=/usr/local/cargo/bin:$PATH
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --profile minimal --default-toolchain stable \
    && chmod -R a+w ${RUSTUP_HOME} ${CARGO_HOME}

# Set workspace permissions
RUN mkdir -p /workspaces/void-copy/.build/electron && \
    chown -R node:node /workspaces

ADD install-vscode.sh /root/
RUN /root/install-vscode.sh

RUN git config --system codespaces-theme.hide-status 1

USER node
RUN npm install -g node-gyp
RUN NPM_CACHE="$(npm config get cache)" && rm -rf "$NPM_CACHE" && ln -s /vscode-dev/npm-cache "$NPM_CACHE"
RUN echo 'export DISPLAY="${DISPLAY:-:1}"' | tee -a ~/.bashrc >> ~/.zshrc

USER root
CMD chown node:node /vscode-dev && sudo -u node mkdir -p /vscode-dev/npm-cache && sleep inf
