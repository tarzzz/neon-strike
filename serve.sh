#!/usr/bin/env bash
# NEON STRIKE — local static server
# Usage: ./serve.sh {start|stop|restart|status|open|deps}
#
# start / open / restart always run dependency install/check first
# (python3 required; curl & lsof installed when possible).

set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
PID_FILE="$ROOT/.server.pid"
LOG_FILE="$ROOT/.server.log"
PORT="${PORT:-8080}"
HOST="${HOST:-127.0.0.1}"
URL="http://${HOST}:${PORT}"
SKIP_DEPS="${SKIP_DEPS:-0}"
DEPS_QUIET="${DEPS_QUIET:-0}"

cd "$ROOT"

# ─── Dependencies ────────────────────────────────────────

have() {
  command -v "$1" >/dev/null 2>&1
}

log() {
  if [[ "$DEPS_QUIET" != "1" ]]; then
    echo "$@"
  fi
}

os_id() {
  case "$(uname -s)" in
    Darwin) echo "macos" ;;
    Linux)  echo "linux" ;;
    *)      echo "other" ;;
  esac
}

refresh_brew_path() {
  if [[ "$(os_id)" != "macos" ]]; then
    return 0
  fi
  if [[ -x /opt/homebrew/bin/brew ]]; then
    eval "$(/opt/homebrew/bin/brew shellenv)"
  elif [[ -x /usr/local/bin/brew ]]; then
    eval "$(/usr/local/bin/brew shellenv)"
  fi
  hash -r 2>/dev/null || true
}

pkg_install() {
  local brew_pkg="$1"
  local apt_pkg="${2:-$1}"
  local dnf_pkg="${3:-$apt_pkg}"
  local os
  os="$(os_id)"

  if [[ "$os" == "macos" ]]; then
    if ! have brew; then
      echo "error: Homebrew is not installed (needed to auto-install $brew_pkg)."
      echo "  Install from https://brew.sh then re-run: $0 deps"
      return 1
    fi
    refresh_brew_path
    echo "→ brew install $brew_pkg"
    # brew install is idempotent if already present
    brew install "$brew_pkg"
    refresh_brew_path
    return $?
  fi

  if [[ "$os" == "linux" ]]; then
    if have apt-get; then
      echo "→ installing $apt_pkg (apt)"
      if have sudo && [[ "$(id -u)" -ne 0 ]]; then
        sudo apt-get update -qq
        sudo DEBIAN_FRONTEND=noninteractive apt-get install -y "$apt_pkg"
      else
        apt-get update -qq
        DEBIAN_FRONTEND=noninteractive apt-get install -y "$apt_pkg"
      fi
      return $?
    fi
    if have dnf; then
      echo "→ installing $dnf_pkg (dnf)"
      if have sudo && [[ "$(id -u)" -ne 0 ]]; then
        sudo dnf install -y "$dnf_pkg"
      else
        dnf install -y "$dnf_pkg"
      fi
      return $?
    fi
    if have pacman; then
      echo "→ installing $apt_pkg (pacman)"
      if have sudo && [[ "$(id -u)" -ne 0 ]]; then
        sudo pacman -Sy --noconfirm "$apt_pkg"
      else
        pacman -Sy --noconfirm "$apt_pkg"
      fi
      return $?
    fi
  fi

  echo "error: no supported package manager found to install '$brew_pkg'."
  return 1
}

ensure_cmd() {
  # ensure_cmd <command> <brew_pkg> <apt_pkg> [required:1|0]
  local cmd="$1"
  local brew_pkg="$2"
  local apt_pkg="$3"
  local required="${4:-1}"

  if have "$cmd"; then
    log "  ✓ $cmd ($(command -v "$cmd"))"
    return 0
  fi

  echo "  ✗ $cmd missing — installing…"
  if pkg_install "$brew_pkg" "$apt_pkg"; then
    refresh_brew_path
    if have "$cmd"; then
      echo "  ✓ $cmd installed ($(command -v "$cmd"))"
      return 0
    fi
  fi

  if [[ "$required" == "1" ]]; then
    echo "error: required dependency '$cmd' is not available."
    echo "  Install it manually, then re-run: $0 deps"
    return 1
  fi
  echo "  ! optional dependency '$cmd' still missing (continuing)"
  return 0
}

ensure_python_http() {
  if ! have python3; then
    return 1
  fi
  if ! python3 -c "import http.server, socketserver" 2>/dev/null; then
    echo "error: python3 is present but http.server failed to import."
    echo "  Try reinstalling Python 3, then: $0 deps"
    return 1
  fi
  local ver
  ver="$(python3 -c 'import sys; print("%d.%d.%d" % sys.version_info[:3])' 2>/dev/null || echo "?")"
  log "  ✓ python3 http.server (Python $ver)"
}

ensure_project_files() {
  local missing=0
  local f
  for f in index.html js/main.js js/game.js js/gfx.js css/style.css; do
    if [[ ! -f "$ROOT/$f" ]]; then
      echo "  ✗ missing project file: $f"
      missing=1
    fi
  done
  if [[ "$missing" -ne 0 ]]; then
    echo "error: project files incomplete — re-clone or restore the repo."
    return 1
  fi
  log "  ✓ project files present"
}

cmd_deps() {
  echo "Checking NEON STRIKE dependencies…"
  echo

  ensure_project_files || return 1

  # Required runtime
  ensure_cmd python3 python python3 1 || return 1
  ensure_python_http || return 1

  # Optional but useful for health checks / port detection
  ensure_cmd curl curl curl 0 || true
  ensure_cmd lsof lsof lsof 0 || true

  echo
  echo "Dependencies OK."
  echo "  No npm/node packages required — pure HTML/CSS/JS."
  echo "  Start with: $0 start   or   $0 open"
}

ensure_deps() {
  if [[ "$SKIP_DEPS" == "1" ]]; then
    echo "Skipping dependency install (SKIP_DEPS=1)."
    ensure_project_files || return 1
    if ! have python3; then
      echo "error: python3 is still required even with SKIP_DEPS=1."
      return 1
    fi
    ensure_python_http || return 1
    return 0
  fi
  cmd_deps
}

# ─── Process helpers ─────────────────────────────────────

is_running() {
  if [[ -f "$PID_FILE" ]]; then
    local pid
    pid="$(cat "$PID_FILE" 2>/dev/null || true)"
    if [[ -n "${pid:-}" ]] && kill -0 "$pid" 2>/dev/null; then
      return 0
    fi
  fi
  return 1
}

port_in_use() {
  if have lsof; then
    lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1
    return $?
  fi
  if have nc; then
    nc -z "$HOST" "$PORT" >/dev/null 2>&1
    return $?
  fi
  return 1
}

http_ready() {
  if have curl; then
    curl -fsS --max-time 0.5 "$URL/" >/dev/null 2>&1
    return $?
  fi
  port_in_use
}

# ─── Commands ────────────────────────────────────────────

cmd_start() {
  # Always install/check deps before serving
  ensure_deps || return 1
  echo

  if is_running; then
    echo "Already running (pid $(cat "$PID_FILE")) → $URL"
    return 0
  fi

  rm -f "$PID_FILE"

  if port_in_use; then
    echo "Port $PORT is already in use."
    echo "Stop the other process, or start with a different port:"
    echo "  PORT=8090 $0 start"
    return 1
  fi

  python3 -m http.server "$PORT" --bind "$HOST" >"$LOG_FILE" 2>&1 &
  local pid=$!
  echo "$pid" >"$PID_FILE"
  disown "$pid" 2>/dev/null || true

  local i
  for i in $(seq 1 40); do
    if ! kill -0 "$pid" 2>/dev/null; then
      echo "Server process exited. Last log lines:"
      tail -n 20 "$LOG_FILE" 2>/dev/null || true
      rm -f "$PID_FILE"
      return 1
    fi
    if http_ready; then
      echo "NEON STRIKE started"
      echo "  URL  $URL"
      echo "  pid  $pid"
      echo "  log  $LOG_FILE"
      echo
      echo "Open the URL in your browser, or run: $0 open"
      return 0
    fi
    sleep 0.1
  done

  echo "Server failed to become ready. Stopping pid $pid."
  kill "$pid" 2>/dev/null || true
  sleep 0.2
  kill -9 "$pid" 2>/dev/null || true
  rm -f "$PID_FILE"
  echo "Last log lines:"
  tail -n 20 "$LOG_FILE" 2>/dev/null || true
  return 1
}

cmd_stop() {
  if ! is_running; then
    if [[ -f "$PID_FILE" ]]; then
      rm -f "$PID_FILE"
      echo "Not running (cleared stale pid file)."
    else
      echo "Not running."
    fi
    return 0
  fi

  local pid
  pid="$(cat "$PID_FILE")"
  kill "$pid" 2>/dev/null || true

  local i
  for i in $(seq 1 20); do
    if ! kill -0 "$pid" 2>/dev/null; then
      break
    fi
    sleep 0.1
  done

  if kill -0 "$pid" 2>/dev/null; then
    kill -9 "$pid" 2>/dev/null || true
  fi

  rm -f "$PID_FILE"
  echo "NEON STRIKE stopped (was pid $pid)."
}

cmd_status() {
  if is_running; then
    echo "Running (pid $(cat "$PID_FILE")) → $URL"
    return 0
  fi
  echo "Stopped."
  return 1
}

cmd_open() {
  # open always goes through start → deps install
  if ! is_running; then
    echo "Server is not running. Starting it…"
    cmd_start || return 1
  fi
  if have open; then
    open "$URL"
  elif have xdg-open; then
    xdg-open "$URL"
  else
    echo "Open this URL in your browser: $URL"
  fi
}

cmd_restart() {
  cmd_stop || true
  sleep 0.2
  cmd_start
}

usage() {
  cat <<USAGE
NEON STRIKE server

Usage:
  $0 start      Install deps if needed, then start server (port ${PORT})
  $0 stop       Stop the server
  $0 restart    Restart the server (re-checks deps)
  $0 status     Show running state
  $0 open       Start (if needed) and open in browser
  $0 deps       Only check / install dependencies

Dependencies (auto-installed when missing on start/open/restart/deps):
  python3       Required — serves the game (stdlib http.server)
  curl          Optional — health check after start
  lsof          Optional — port-in-use detection

Environment:
  PORT=8080       HTTP port (default 8080)
  HOST=127.0.0.1  Bind address (default localhost)
  SKIP_DEPS=1     Skip install attempts (still requires python3)

Examples:
  $0 deps
  $0 start
  $0 open
  PORT=9090 $0 start
  SKIP_DEPS=1 $0 start
  $0 stop
USAGE
}

main() {
  local action="${1:-}"
  case "$action" in
    start)   cmd_start ;;
    stop)    cmd_stop ;;
    restart) cmd_restart ;;
    status)  cmd_status ;;
    open)    cmd_open ;;
    deps|install) cmd_deps ;;
    -h|--help|help|"") usage ;;
    *)
      echo "Unknown command: $action"
      echo
      usage
      exit 1
      ;;
  esac
}

main "$@"
