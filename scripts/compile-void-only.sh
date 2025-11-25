#!/bin/bash

# Script to compile only void-related code for faster development
# Supports both one-time compilation and watch mode

WATCH_MODE=false
# Check for watch flag
if [ "$1" = "--watch" ] || [ "$1" = "-w" ]; then
    WATCH_MODE=true
    echo "🔄 Starting void watch mode..."
else
    echo "🔨 Starting one-time void compilation..."
fi

# Function to compile void TypeScript files
compile_void_typescript() {
    echo "📦 Compiling void TypeScript files..."

    if [ "$WATCH_MODE" = true ]; then
        # Watch mode: use a simple file watcher
        echo "👀 Watching void TypeScript files for changes..."
        # Use inotifywait if available, otherwise fallback to polling
        if command -v inotifywait >/dev/null 2>&1; then
            echo "Using inotify for efficient file watching..."
            while true; do
                inotifywait -r -e modify,create,delete src/vs/workbench/contrib/void/ --exclude="react/|out/|\.git/" -q
                echo "🔄 Void TypeScript files changed, recompiling..."
                compile_once
            done
        else
            echo "inotifywait not available, using polling mode..."
            LAST_MOD=$(find src/vs/workbench/contrib/void/ -name "*.ts" -not -path "*/react/*" -not -path "*/out/*" -printf '%T@ %p\n' | sort -n | tail -1 | cut -d' ' -f1)
            while true; do
                sleep 2
                CURRENT_MOD=$(find src/vs/workbench/contrib/void/ -name "*.ts" -not -path "*/react/*" -not -path "*/out/*" -printf '%T@ %p\n' | sort -n | tail -1 | cut -d' ' -f1)
                if [ "$CURRENT_MOD" != "$LAST_MOD" ]; then
                    echo "🔄 Void TypeScript files changed, recompiling..."
                    compile_once
                    LAST_MOD=$CURRENT_MOD
                fi
            done
        fi
    else
        # One-time compilation
        compile_once
    fi
}

# Function for one-time compilation
compile_once() {
    echo "🔨 Compiling void TypeScript files only..."

    # Create output directory if it doesn't exist
    mkdir -p out/vs/workbench/contrib/void

    # Find all TypeScript files in void directory (excluding react and out)
    VOID_FILES=$(find src/vs/workbench/contrib/void -name "*.ts" -not -path "*/react/*" -not -path "*/out/*" 2>/dev/null)

    if [ -z "$VOID_FILES" ]; then
        echo "⚠️  No TypeScript files found in void directory"
        return
    fi

    # Count files for progress indication
    FILE_COUNT=$(echo "$VOID_FILES" | wc -l)
    echo "📝 Found $FILE_COUNT TypeScript files to compile"

    # Compile all void files using TypeScript compiler with project config
    # This ensures preserveConstEnums and other VS Code-specific settings are used
    # TypeScript will automatically resolve dependencies from the entire project
    # Using incremental compilation for faster subsequent builds
    echo "$VOID_FILES" | xargs -r npx tsc \
        --project src/tsconfig.json \
        --rootDir src \
        --outDir out/vs \
        --incremental \
        --tsBuildInfoFile out/vs/workbench/contrib/void/.tsbuildinfo \
        --skipLibCheck \
        2>&1 | grep -E "(error TS[0-9]+|Error|Found [0-9]+ error)" || echo "✅ Compilation completed (no errors)"

    echo "✅ Void TypeScript compilation complete!"
}

# Function to compile React components
compile_void_react() {
    if [ "$WATCH_MODE" = true ]; then
        echo "🔄 Starting void React watch mode..."
        npm run watchreact &
        REACT_PID=$!
        echo "React watcher started with PID: $REACT_PID"
    else
        echo "🔨 Building void React components..."
        npm run buildreact
        echo "✅ Void React compilation complete!"
    fi
}

# Main execution
if [ "$WATCH_MODE" = true ]; then
    echo "🚀 Starting comprehensive void watch mode..."
    echo "This will watch both TypeScript and React files"
    echo "Press Ctrl+C to stop all watchers"
    echo ""

    # Start React watcher in background
    compile_void_react

    # Start TypeScript watcher (this will run forever)
    compile_void_typescript

    # Cleanup when script exits
    trap 'echo "Stopping watchers..."; kill $REACT_PID 2>/dev/null; exit 0' INT TERM
else
    # One-time compilation
    compile_void_typescript
    compile_void_react

    echo "✅ Void compilation complete!"
    echo "🎉 Ready to test void changes!"
    echo ""
    echo "💡 Development workflow:"
    echo "   1. Edit void code"
    echo "   2. Run: ./scripts/compile-void-only.sh"
    echo "   3. Test: ./scripts/code.sh"
    echo "   4. For continuous watching: ./scripts/compile-void-only.sh --watch"
fi
