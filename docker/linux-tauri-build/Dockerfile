FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    wget \
    git \
    file \
    build-essential \
    pkg-config \
    xdg-utils \
    patchelf \
    libunwind-dev \
    libwebkit2gtk-4.1-dev \
    libgtk-3-dev \
    libayatana-appindicator3-dev \
    librsvg2-dev \
    libssl-dev \
    libasound2-dev \
    libxdo-dev \
    libxrandr-dev \
    libdbus-1-dev \
    libgstreamer1.0-dev \
    libgstreamer-plugins-base1.0-dev \
    libgstreamer-plugins-bad1.0-dev \
    gstreamer1.0-plugins-base \
    gstreamer1.0-plugins-good \
    gstreamer1.0-plugins-bad \
    gstreamer1.0-plugins-ugly \
    && rm -rf /var/lib/apt/lists/*

# Create a user that can be overridden at runtime
ARG USER_ID=1000
ARG GROUP_ID=1000
ARG USERNAME=builduser

# Create group and user
RUN groupadd -g ${GROUP_ID} ${USERNAME} && \
    useradd -u ${USER_ID} -g ${GROUP_ID} -m -s /bin/bash ${USERNAME}

# Install Rust as root first, then copy to user
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
ENV PATH="/root/.cargo/bin:${PATH}"

# Install Tauri CLI
RUN cargo install tauri-cli --version "^2.0.0"

# Install Node.js 22
RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y nodejs

# Verify installations
RUN node --version && npm --version && rustc --version && cargo --version

# Set working directory
WORKDIR /app

# Create simplified build script
RUN echo '#!/bin/bash\n\
set -e\n\
echo "=== Installing Node.js dependencies ==="\n\
npm ci\n\
echo "=== Building Tauri packages ==="\n\
cargo tauri build --config src-tauri/tauri.beta.conf.json -v\n\
' > /build.sh && chmod +x /build.sh

# Execute build script by default
CMD ["/build.sh"]