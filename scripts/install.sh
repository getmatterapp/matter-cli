#!/bin/sh
set -e

REPO="getmatterapp/matter-cli"
INSTALL_DIR="$HOME/.matter/bin"
BINARY_NAME="matter"

# Detect OS
OS=$(uname -s)
case "$OS" in
  Darwin) OS_NAME="darwin" ;;
  Linux)  OS_NAME="linux" ;;
  *)
    echo "Error: Unsupported operating system: $OS"
    exit 1
    ;;
esac

# Detect architecture
ARCH=$(uname -m)
case "$ARCH" in
  x86_64)  ARCH_NAME="x64" ;;
  aarch64) ARCH_NAME="arm64" ;;
  arm64)   ARCH_NAME="arm64" ;;
  *)
    echo "Error: Unsupported architecture: $ARCH"
    exit 1
    ;;
esac

BINARY="matter-${OS_NAME}-${ARCH_NAME}"
echo "Detected platform: ${OS_NAME}-${ARCH_NAME}"

# Get latest release URL
LATEST_URL="https://api.github.com/repos/${REPO}/releases/latest"
echo "Fetching latest release..."
DOWNLOAD_URL=$(curl -fsSL "$LATEST_URL" | grep "browser_download_url.*${BINARY}\"" | head -1 | cut -d '"' -f 4)

if [ -z "$DOWNLOAD_URL" ]; then
  echo "Error: Could not find binary for ${BINARY}"
  exit 1
fi

# Download
echo "Downloading ${BINARY}..."
mkdir -p "$INSTALL_DIR"
curl -fsSL "$DOWNLOAD_URL" -o "${INSTALL_DIR}/${BINARY_NAME}"
chmod +x "${INSTALL_DIR}/${BINARY_NAME}"

echo "Installed to ${INSTALL_DIR}/${BINARY_NAME}"

# Add to PATH if needed
case ":$PATH:" in
  *":${INSTALL_DIR}:"*)
    # Already on PATH
    ;;
  *)
    SHELL_NAME=$(basename "$SHELL")
    case "$SHELL_NAME" in
      bash)
        # Prefer .bashrc; fall back to .bash_profile on macOS where .bashrc isn't sourced by default
        if [ -f "$HOME/.bashrc" ]; then
          RC_FILE="$HOME/.bashrc"
        else
          RC_FILE="$HOME/.bash_profile"
        fi
        ;;
      zsh)  RC_FILE="$HOME/.zshrc" ;;
      fish) RC_FILE="$HOME/.config/fish/config.fish" ;;
      *)    RC_FILE="" ;;
    esac

    if [ -n "$RC_FILE" ]; then
      if [ "$SHELL_NAME" = "fish" ]; then
        LINE="fish_add_path ${INSTALL_DIR}"
      else
        LINE="export PATH=\"${INSTALL_DIR}:\$PATH\""
      fi

      # Append only if not already present
      if ! grep -qF "$INSTALL_DIR" "$RC_FILE" 2>/dev/null; then
        echo "" >> "$RC_FILE"
        echo "# Matter CLI" >> "$RC_FILE"
        echo "$LINE" >> "$RC_FILE"
        echo "Added ${INSTALL_DIR} to PATH in ${RC_FILE}"
        echo "Run 'source ${RC_FILE}' or open a new terminal to use matter."
      fi
    else
      echo ""
      echo "${INSTALL_DIR} is not in your PATH."
      echo "Add ${INSTALL_DIR} to your PATH manually."
    fi
    ;;
esac

echo ""
echo "Run 'matter --help' to get started."
echo "Run 'matter login' to authenticate."
