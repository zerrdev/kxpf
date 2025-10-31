# kxpf

> **K**ubernetes **P**ort-**F**orward Manager - A CLI tool for managing groups of Kubernetes service port-forwards

[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](https://opensource.org/licenses/ISC)
[![Node Version](https://img.shields.io/badge/node-%3E%3D22.0.0-brightgreen)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue)](https://www.typescriptlang.org/)

## Features

- 🚀 **Group Management** - Organize services into logical groups for easy bulk operations
- 🎯 **Context Support** - Target different Kubernetes clusters per group
- 🔄 **Background Processes** - Port-forwards run as detached processes that survive terminal closure
- 🔍 **Smart Listing** - View all active port-forwards with deduplication
- 🎨 **Prefix Matching** - Start/stop services by name prefix for flexible control
- 🌐 **Cross-Platform** - Works on Windows and Linux
- ⚡ **Auto-Fallback** - Automatically detects and uses `kubectl` or `minikube kubectl`

## Installation

### Prerequisites
- Node.js 22 or higher
- Yarn package manager
- kubectl or minikube configured and accessible

### Install

```bash
# Clone the repository
git clone https://github.com/yourusername/kxpf.git
cd kxpf

# Install dependencies
yarn install

# Build the project
yarn build

# Link globally
yarn link
```

After linking, the `kxpf` command will be available globally in your terminal.

## Quick Start

1. **Create your config** (auto-generated on first run at `~/.kxpf.config`):
```
development: {
    api-service,8080,80
    web-service,8081,3000
}
```

2. **Start port-forwards**:
```bash
kxpf up development
```

3. **List running port-forwards**:
```bash
kxpf ls
```

4. **Stop all port-forwards**:
```bash
kxpf stop-all
```

## Usage

### Commands

#### Start Port-Forwards

```bash
# Start all services in a group
kxpf up <group>

# Start specific service(s) by prefix
kxpf up <group> <service-prefix>
```

**Examples:**
```bash
kxpf up development                    # Start all services in 'development' group
kxpf up production api                 # Start services starting with 'api' in 'production'
```

#### Stop Port-Forwards

```bash
# Stop service(s) by prefix
kxpf stop <service-prefix>

# Stop all running port-forwards
kxpf stop-all
```

**Examples:**
```bash
kxpf stop api                          # Stop all services starting with 'api'
kxpf stop-all                          # Stop all active port-forwards
```

#### List Port-Forwards

```bash
kxpf ls
```

**Output:**
```
Running port-forwards:
──────────────────────────────────────────────────────────────────────
Service Name                  Local Port     Remote Port
──────────────────────────────────────────────────────────────────────
api-service                   8080           80
web-service                   8081           3000
──────────────────────────────────────────────────────────────────────
Total: 2 port-forward(s)
```

#### Edit Configuration

```bash
kxpf config
```

Opens the config file in VSCode (or displays the path if VSCode is not available).

## Configuration

The configuration file is located at:
- **Unix/Linux/macOS**: `~/.kxpf.config`
- **Windows**: `%USERPROFILE%/.kxpf.config`

### Syntax

```
# Comments start with #

group-name: {
    service-name,local-port,remote-port
    another-service,local-port,remote-port
}
```

### Context Support

Target different Kubernetes clusters by specifying a context per group:

```
production: {
    context: prod-cluster
    api-service,8080,80
    web-service,8081,3000
}

staging: {
    context: staging-cluster
    api-service,9080,80
    web-service,9081,3000
}
```

### Complete Example

```
# Development environment
development: {
    api-gateway,8080,80
    auth-service,8081,8000
    user-service,8082,8000
    db-admin,8083,5432
}

# Production environment with specific context
production: {
    context: prod-us-west
    api-gateway,9080,80
    auth-service,9081,8000
}

# Staging with minikube
staging: {
    context: minikube
    api-gateway,7080,80
}
```

### Configuration Rules

- **Group names**: Can contain letters, numbers, and hyphens
- **Service format**: `service-name,local-port,remote-port`
- **Whitespace**: Flexible - spaces around commas and colons are ignored
- **Comments**: Lines starting with `#` are ignored
- **Semicolons**: Optional at the end of service lines
- **Context**: Optional per group - omit to use default kubectl context

## How It Works

- **Detached Processes**: Each port-forward runs independently using `kubectl port-forward`
- **Process Discovery**: Lists active port-forwards by querying running kubectl processes
- **Auto-Fallback**: Tries `kubectl` first, falls back to `minikube kubectl --` automatically
- **Cross-Platform**: Uses platform-specific process management (bash on Unix, cmd on Windows)
- **Deduplication**: Smart listing that shows one entry per service (minikube creates multiple processes)

## Development

### Project Structure

```
kxpf/
├── src/
│   ├── index.ts              # CLI entry point
│   ├── commands/             # Command implementations
│   │   ├── up.ts
│   │   ├── stop.ts
│   │   ├── stop-all.ts
│   │   ├── ls.ts
│   │   └── config.ts
│   ├── manager/              # Port-forward process management
│   │   └── port-forward.ts
│   ├── parser/               # Config file parser
│   │   └── config-parser.ts
│   └── utils/                # Utilities
│       └── config-path.ts
├── package.json
├── tsconfig.json
└── README.md
```

### Build

```bash
yarn build          # Compile TypeScript
yarn dev            # Run in development mode with tsx
```

### Tech Stack

- **Runtime**: Node.js 22+
- **Language**: TypeScript 5.7
- **CLI Framework**: Commander.js
- **Package Manager**: Yarn

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

ISC

## Acknowledgments

Built with ❤️ for Kubernetes developers who manage multiple port-forwards.

---

**Note**: This tool manages kubectl processes. Ensure you have proper access to your Kubernetes clusters before use.
