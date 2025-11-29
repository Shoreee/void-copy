#!/bin/bash

# =============================================================================
# Void 开发环境一体化脚本
# 功能：VNC 环境设置 + React 编译 + TypeScript 编译 + 启动应用
# =============================================================================

set -e

ROOT=$(dirname "$(dirname "$(readlink -f $0)")")
cd "$ROOT"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[OK]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# =============================================================================
# VNC 环境检测和设置（仅 Codespaces/Docker）
# =============================================================================
setup_vnc() {
    # 检查是否在容器环境中
    if [ ! -f /.dockerenv ] && [ -z "$CODESPACES" ]; then
        log_info "不在容器环境中，跳过 VNC 设置"
        return 0
    fi

    log_info "检测到容器环境，检查 VNC..."

    # 检查是否已有 DISPLAY
    if [ -n "$DISPLAY" ] && xdpyinfo >/dev/null 2>&1; then
        log_success "X 显示服务器已可用 (DISPLAY=$DISPLAY)"
        return 0
    fi

    # 检查 VNC 是否已安装
    if ! command -v vncserver >/dev/null 2>&1; then
        log_warn "VNC 未安装，正在安装..."
        sudo apt-get update -qq
        sudo apt-get install -y -qq xfce4 xfce4-goodies tigervnc-standalone-server dbus-x11 novnc >/dev/null 2>&1
        log_success "VNC + noVNC 安装完成"
    fi

    # 单独检查 noVNC（可能 VNC 已装但 noVNC 没装）
    if [ ! -f /usr/share/novnc/utils/novnc_proxy ] && [ ! -f /usr/share/novnc/utils/launch.sh ]; then
        log_warn "noVNC 未安装，正在安装..."
        sudo apt-get install -y -qq novnc >/dev/null 2>&1
        log_success "noVNC 安装完成"
    fi

    # 检查 VNC 是否已运行
    if pgrep -x "Xtigervnc" >/dev/null 2>&1; then
        log_success "VNC 服务器已在运行"
        export DISPLAY=:1
        return 0
    fi

    # 设置 VNC 密码（如果不存在）
    if [ ! -f ~/.vnc/passwd ]; then
        log_info "设置 VNC 密码..."
        mkdir -p ~/.vnc
        echo "voiddev" | vncpasswd -f > ~/.vnc/passwd
        chmod 600 ~/.vnc/passwd
    fi

    # 启动 VNC
    log_info "启动 VNC 服务器..."
    vncserver :1 -geometry 1920x1080 -depth 24 >/dev/null 2>&1 || true
    export DISPLAY=:1

    # 启动 noVNC（如果可用且未运行）
    if ! pgrep -f "websockify.*6080" >/dev/null 2>&1; then
        if [ -f /usr/share/novnc/utils/novnc_proxy ]; then
            log_info "启动 noVNC Web 访问 (端口 6080)..."
            /usr/share/novnc/utils/novnc_proxy --vnc localhost:5901 --listen 6080 >/dev/null 2>&1 &
            sleep 1
            log_success "noVNC 已启动，通过端口 6080 访问 (密码: voiddev)"
        elif [ -f /usr/share/novnc/utils/launch.sh ]; then
            log_info "启动 noVNC Web 访问 (端口 6080)..."
            /usr/share/novnc/utils/launch.sh --vnc localhost:5901 --listen 6080 >/dev/null 2>&1 &
            sleep 1
            log_success "noVNC 已启动，通过端口 6080 访问 (密码: voiddev)"
        else
            log_warn "noVNC 启动脚本未找到，请手动安装: sudo apt install novnc"
        fi
    else
        log_success "noVNC 已在运行 (端口 6080, 密码: voiddev)"
    fi

    log_success "VNC 环境就绪 (DISPLAY=$DISPLAY)"
}

# =============================================================================
# 编译 React 组件
# =============================================================================
compile_react() {
    log_info "编译 React 组件..."
    npm run buildreact
    log_success "React 编译完成"
}

# =============================================================================
# 编译 TypeScript（仅 Void 目录或全量）
# =============================================================================
compile_typescript() {
    local mode="${1:-void}"  # void 或 full

    if [ "$mode" = "full" ]; then
        log_info "全量编译 TypeScript..."
        npm run compile
    else
        log_info "编译 Void TypeScript..."
        if [ -f src/tsconfig.void.json ]; then
            npx tsc --project src/tsconfig.void.json 2>&1 | grep -E "src/vs/workbench/contrib/void/.*error" || true
        else
            log_warn "tsconfig.void.json 不存在，使用全量编译"
            npm run compile
        fi
    fi
    log_success "TypeScript 编译完成"
}

# =============================================================================
# 启动 Void 应用
# =============================================================================
run_void() {
    log_info "启动 Void..."

    # 检查 Void 是否已在运行
    if pgrep -f "\.build/electron/void" >/dev/null 2>&1; then
        log_warn "Void 已在运行，跳过启动"
        log_info "如需重启，请先关闭现有实例"
        return 0
    fi

    # 根据环境添加必要参数
    local args=""

    # root 用户需要 --no-sandbox
    if [ "$(id -u)" = "0" ]; then
        args="$args --no-sandbox"
    fi

    # 容器环境禁用 GPU 和 dev-shm
    if [ -f /.dockerenv ]; then
        args="$args --disable-gpu --disable-dev-shm-usage"
    fi

    exec ./scripts/code.sh $args "$@"
}

# =============================================================================
# Watch 模式
# =============================================================================
watch_mode() {
    log_info "启动 Watch 模式..."

    # 启动 React watcher
    npm run watchreact &
    REACT_PID=$!

    # 启动 TypeScript watcher（使用 gulp）
    npm run watch &
    TS_PID=$!

    log_success "Watch 模式已启动 (React PID: $REACT_PID, TS PID: $TS_PID)"
    log_info "按 Ctrl+C 停止..."

    trap 'echo "停止 watchers..."; kill $REACT_PID $TS_PID 2>/dev/null; exit 0' INT TERM
    wait
}

# =============================================================================
# 显示帮助
# =============================================================================
show_help() {
    cat << EOF
Void 开发环境一体化脚本

用法: ./scripts/dev.sh [命令] [选项]

命令:
  setup       仅设置 VNC 环境（容器中）
  compile     编译并启动 (默认)
  full        全量编译并启动
  watch       启动 watch 模式（不启动应用）
  run         仅启动应用（跳过编译）
  help        显示此帮助

示例:
  ./scripts/dev.sh              # 编译 React + Void TS，然后启动
  ./scripts/dev.sh full         # 全量编译，然后启动
  ./scripts/dev.sh watch        # 启动 watch 模式
  ./scripts/dev.sh run          # 仅启动（已编译过）
  ./scripts/dev.sh setup        # 仅设置 VNC

EOF
}

# =============================================================================
# 主入口
# =============================================================================
main() {
    local cmd="${1:-compile}"
    shift 2>/dev/null || true

    case "$cmd" in
        setup)
            setup_vnc
            ;;
        compile)
            setup_vnc
            compile_react
            compile_typescript void
            run_void "$@"
            ;;
        full)
            setup_vnc
            compile_react
            compile_typescript full
            run_void "$@"
            ;;
        watch)
            setup_vnc
            watch_mode
            ;;
        run)
            setup_vnc
            run_void "$@"
            ;;
        help|--help|-h)
            show_help
            ;;
        *)
            log_error "未知命令: $cmd"
            show_help
            exit 1
            ;;
    esac
}

main "$@"

