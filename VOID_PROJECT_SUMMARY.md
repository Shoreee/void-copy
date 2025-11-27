# Void Project Summary

## Overview
**Void** is an open-source AI-powered code editor that serves as an alternative to Cursor. It's built as a fork of Microsoft's VSCode repository, enhanced with advanced AI capabilities for code generation, editing, and analysis.

## Key Features

### 🧠 **AI-Powered Development**
- **Multi-Model Support**: Integration with various AI providers (OpenAI, Anthropic, Ollama, Mistral, Groq, Google)
- **Smart Code Generation**: AI-assisted code completion and generation
- **Fast Apply System**: Search/replace-based code application for efficient edits
- **Chat Interface**: Interactive AI conversations with context gathering

### 🔧 **Core Capabilities**
- **Real-time Code Editing**: AI-powered code modifications with diff visualization
- **Context-Aware Tools**: File system awareness and codebase understanding
- **Multi-threaded Chat**: Support for multiple conversation threads
- **Model Context Protocol (MCP)**: Integration with external tools and services

### 🛡️ **Privacy & Security**
- **Direct Provider Communication**: Messages sent directly to AI providers without data retention
- **Local Model Support**: Full compatibility with locally hosted models (Ollama)
- **Privacy-First Architecture**: No data storage or processing intermediaries

## Architecture

### Process Structure
Void follows VSCode's Electron-based architecture:
- **Main Process** (`electron-main/`): Handles system-level operations and AI provider communication
- **Browser Process** (`browser/`): Manages UI components and user interactions
- **Common Modules** (`common/`): Shared utilities and type definitions

### Key Services
- **EditCodeService**: Core service for AI-powered code editing
- **SendLLMMessageService**: Handles communication with AI providers
- **VoidSettingsService**: Manages user preferences and model configurations
- **ChatThreadService**: Manages multiple conversation threads
- **ToolsService**: Provides AI tools for code analysis and manipulation

### LLM Pipeline
Messages flow through a structured pipeline:
1. User input → Context gathering → Message conversion → Main process → AI provider
2. Response → Main process → Browser process → UI rendering

## Code Organization

### Main Directory Structure
```
src/vs/workbench/contrib/void/
├── browser/          # UI components and browser-side logic
├── common/           # Shared types, services, and utilities  
└── electron-main/    # Main process services and AI integration
```

### Key Components
- **React UI Components**: Modern React-based interface in `browser/react/`
- **Service Architecture**: Singleton-based service registration pattern
- **TypeScript Foundation**: Fully typed codebase with strict type checking

## Development Setup

### Prerequisites
- **Node.js**: Version 20.18.2 (specified in `.nvmrc`)
- **Platform-Specific Tools**: 
  - Mac: Python and XCode
  - Windows: Visual Studio 2022 with C++ tools
  - Linux: Development tools and libraries

### Development Workflow
1. **Clone & Install**: `git clone` + `npm install`
2. **Developer Mode**: Press `Ctrl+Shift+B` (Windows/Linux) or `Cmd+Shift+B` (Mac)
3. **Run Development Build**: Use platform-specific scripts (`./scripts/code.sh` or `./scripts/code.bat`)
4. **Reload Changes**: `Ctrl+R` to see updates

### Build System
- **Incremental Compilation**: `npm run watch` for continuous building
- **React Components**: Separate build process with `npm run buildreact`
- **Production Builds**: Platform-specific executables via `npm run gulp`

## Technology Stack

### Core Technologies
- **Electron**: Cross-platform desktop application framework
- **TypeScript**: Primary programming language
- **React**: UI component library
- **Tailwind CSS**: Styling framework

### AI Integration
- **Multiple Providers**: OpenAI, Anthropic, Ollama, Mistral, Groq, Google AI
- **Model Context Protocol**: Standardized tool integration
- **Custom Prompts**: Domain-specific prompt engineering

### Development Tools
- **Gulp**: Build system and task runner
- **ESLint**: Code linting and style enforcement
- **Mocha**: Testing framework
- **Playwright**: End-to-end testing

## Project Status

### Current State
- **Active Development**: Core functionality implemented and stable
- **Experimental Phase**: Exploring novel AI coding ideas
- **Community Driven**: Open to contributions and feature suggestions

### Distribution
- **Build Pipeline**: Fork of VSCodium with GitHub Actions
- **Auto-updating**: Built-in update mechanisms
- **Cross-platform**: Support for Windows, macOS, and Linux

## Community & Contribution

### Getting Involved
- **Discord Community**: Active development discussions
- **Project Board**: Public roadmap and task tracking
- **Weekly Meetings**: Casual developer gatherings

### Contribution Guidelines
- **Focus Area**: Most code lives in `src/vs/workbench/contrib/void/`
- **PR Process**: Direct pull requests for changes
- **Documentation**: Comprehensive codebase guide available

## Unique Value Proposition

Void distinguishes itself by:
- **Privacy-First AI**: Direct provider communication without data retention
- **Open Source**: Full transparency and community-driven development
- **Multi-Model Flexibility**: Support for both cloud and local AI models
- **VSCode Foundation**: Leverages mature editor infrastructure with AI enhancements

## Contact & Resources
- **Website**: https://voideditor.com
- **Discord**: https://discord.gg/RSNjgaugJs
- **Email**: hello@voideditor.com
- **Project Board**: https://github.com/orgs/voideditor/projects/2

---

*Last Updated: November 27, 2025*

The project represents a significant evolution of code editors, blending the robustness of VSCode with cutting-edge AI capabilities while maintaining user privacy and control.