# kxpf - Project Documentation

## Project Overview

**kxpf** (Kubernetes Port-Forward Manager) is a CLI tool designed to simplify the management of multiple Kubernetes port-forwards through a group-based configuration system.

### Problem Statement

Developers working with Kubernetes often need to:
- Manage multiple port-forwards simultaneously
- Remember complex port mappings
- Restart port-forwards after terminal closure
- Switch between different cluster contexts
- Track which services are currently forwarded

Manual `kubectl port-forward` commands become cumbersome when dealing with multiple services across different environments.

### Solution

kxpf provides a declarative configuration file where developers can:
- Define service groups (e.g., development, production, staging)
- Set Kubernetes contexts per group
- Start/stop entire groups or individual services with simple commands
- List all active port-forwards
- Run port-forwards as detached background processes

## Architecture

### Components

```
┌─────────────────────────────────────────────────────────────┐
│                        CLI Layer                             │
│  (Commander.js - Command parsing and routing)                │
└─────────────────────┬───────────────────────────────────────┘
                      │
          ┌───────────┼───────────┐
          │           │           │
┌─────────▼────┐ ┌───▼─────┐ ┌──▼──────────┐
│   Commands   │ │ Parser  │ │   Utils     │
│              │ │         │ │             │
│ - up         │ │ Config  │ │ Config Path │
│ - stop       │ │ Parser  │ │             │
│ - stop-all   │ │         │ │             │
│ - ls         │ │         │ │             │
│ - config     │ │         │ │             │
│ - find       │ │         │ │             │
└──────┬───────┘ └─────────┘ └─────────────┘
       │
       │
┌──────▼──────────────────────────────────────────────────────┐
│            Port-Forward Manager                              │
│                                                              │
│  - Spawn detached kubectl processes                          │
│  - List running port-forwards                                │
│  - Kill processes by PID                                     │
│  - Handle kubectl/minikube fallback                          │
└──────────────────────────────────────────────────────────────┘
       │
       │
┌──────▼──────────────────────────────────────────────────────┐
│                   System Layer                               │
│                                                              │
│  - kubectl / minikube kubectl --                             │
│  - Process management (spawn, ps, kill)                      │
│  - Cross-platform support (bash, cmd)                        │
└──────────────────────────────────────────────────────────────┘
```

### Key Design Decisions

#### 1. Detached Process Management
- **Decision**: Spawn port-forwards as detached processes
- **Rationale**: Port-forwards should survive terminal closure
- **Implementation**: Use Node.js `spawn()` with `detached: true` and `unref()`

#### 2. Process Discovery via ps/wmic
- **Decision**: Query system processes instead of maintaining state file
- **Rationale**: More reliable - no state synchronization issues if processes crash
- **Implementation**: Parse `ps aux` (Unix) or `wmic` (Windows) output

#### 3. Config File Format
- **Decision**: Custom simple format instead of JSON/YAML
- **Rationale**: Easy to read and edit, minimal syntax
- **Format**: `group: { service,local,remote }`

#### 4. Context Per Group
- **Decision**: Allow optional context specification per group
- **Rationale**: Different groups often target different clusters
- **Implementation**: Add `--context` flag to kubectl commands

#### 5. Auto-Fallback to Minikube
- **Decision**: Try kubectl, fallback to minikube kubectl
- **Rationale**: Support both native kubectl and minikube environments
- **Implementation**: Shell command with `||` operator

## Implementation Details

### Config Parser

**File**: `src/parser/config-parser.ts`

The parser uses a simple state machine:
1. **Outside group**: Look for group declaration `name: {`
2. **Inside group**: Parse context or service definitions
3. **Group end**: Store group and reset state

**Supported patterns**:
- Group: `/^([a-zA-Z0-9-]+)\s*:\s*\{/`
- Context: `/^context\s*:\s*(.+)$/`
- Service: Split by comma, trim whitespace

### Port-Forward Manager

**File**: `src/manager/port-forward.ts`

#### Starting Port-Forwards

**Unix/Linux**:
```bash
(kubectl port-forward service/name port:port --context ctx 2>/dev/null ||
 minikube kubectl -- port-forward service/name port:port --context ctx) &
```

**Windows**:
```cmd
kubectl port-forward service/name port:port --context ctx
```

#### Listing Port-Forwards

**Strategy**: Parse process list for kubectl port-forward commands

**Unix**:
```bash
ps aux | grep "port-forward" | grep -E "(kubectl|minikube)"
```

**Deduplication**: Minikube creates 2 processes (wrapper + actual kubectl), so we deduplicate by `service:localPort:remotePort` key.

#### Stopping Port-Forwards

**Process**:
1. Get all processes (not deduplicated) via `listAll()`
2. Filter by service name prefix
3. Kill each process by PID
4. Show deduplicated count to user

### Cross-Platform Support

| Feature | Unix/Linux | Windows |
|---------|-----------|---------|
| Shell | bash -c | cmd /c (via shell: true) |
| Process List | ps aux | wmic process |
| Kill Process | kill PID | taskkill /F /PID |
| Config Path | ~/.kxpf.config | %USERPROFILE%/.kxpf.config |

## Development Timeline

### Initial Implementation
1. ✅ Project setup (TypeScript, package.json, tsconfig)
2. ✅ Config parser with group support
3. ✅ Port-forward manager (start, stop, list)
4. ✅ CLI commands (up, stop, stop-all, ls, config)
5. ✅ Cross-platform process management

### Enhancements
1. ✅ Support for kubectl aliases (bash alias expansion)
2. ✅ Minikube kubectl auto-fallback
3. ✅ Deduplication in ls output
4. ✅ Context support per group
5. ✅ Fix: Numbers in group names
6. ✅ Fix: Kill all processes on stop (not just deduplicated)
7. ✅ Service discovery with find command

## Testing

### Manual Testing Checklist

- [x] `kxpf up <group>` - Start all services
- [x] `kxpf up <group> <prefix>` - Start specific service
- [x] `kxpf ls` - List shows correct services
- [x] `kxpf stop <prefix>` - Stop by prefix
- [x] `kxpf stop-all` - Stop all services
- [x] `kxpf config` - Open config in editor
- [x] `kxpf find <search>` - Find services in cluster
- [x] `kxpf find <search> -g <group>` - Find services by context
- [x] Config with context works
- [x] Config without context works
- [x] All processes killed on stop
- [x] Port-forwards survive terminal closure

### Edge Cases Handled

- ✅ kubectl not found → Clear error message
- ✅ Group not found → Error message
- ✅ Service not found → Error message
- ✅ Empty service list → Error message
- ✅ Minikube double processes → Deduplication
- ✅ Config file doesn't exist → Auto-create with example
- ✅ Comments in config → Ignored
- ✅ Whitespace in config → Trimmed
- ✅ Numbers in group names → Supported

## Recent Features

### Find Command (2025-10-31)

**Feature**: Service discovery in Kubernetes cluster

**Implementation**:
- Command: `kxpf find <search-term> [-g <group>]`
- Uses `kubectl get services --all-namespaces` to query cluster
- Optional group context filtering via `-g` flag
- Displays service name, namespace, type, cluster IP, and ports

**Use Cases**:
- Discover available services before configuring port-forwards
- Verify service names when setting up config
- Explore services in different contexts

**File**: `src/commands/find.ts`

## Future Enhancements

### Potential Features

1. **Namespace Support**
   - Allow specifying namespace per service or group
   - Syntax: `service-name,8080,80,namespace`

2. **Pod Support**
   - Currently only supports services
   - Add support for direct pod port-forwarding

3. **Health Checks**
   - Ping local ports to verify connectivity
   - Auto-restart failed port-forwards

4. **Status Persistence**
   - Optional state file for faster startup
   - Remember which groups were active on shutdown

5. **Interactive Mode**
   - TUI for selecting services
   - Real-time status updates

6. **Log Viewing**
   - Capture kubectl output
   - Show connection status and errors

7. **Config Validation**
   - Lint config file for errors
   - Warn about port conflicts

8. **Multiple Configs**
   - Support for project-local .kxpf.config
   - Config file path override via CLI flag

## Known Limitations

1. **Process Tracking**: Relies on process name parsing - could fail if kubectl changes output format
2. **Windows Testing**: Limited testing on Windows platform
3. **No Error Recovery**: If kubectl process crashes, it doesn't auto-restart
4. **Port Conflicts**: Doesn't check if local port is already in use
5. **No Validation**: Doesn't verify service exists before starting port-forward

## Contributing Guidelines

### Code Style
- Use TypeScript strict mode
- Follow existing naming conventions
- Keep functions focused and small
- Add JSDoc comments for public APIs

### Commit Messages
- Use imperative mood ("Add feature" not "Added feature")
- Keep under 140 characters
- Include AI attribution footer

### Pull Request Process
1. Update README.md if adding features
2. Test on both Unix and Windows (if possible)
3. Ensure `yarn build` succeeds without errors
4. Update project.md with design decisions

## License

ISC - See LICENSE file for details

## Maintainers

- Created with Claude Code
- Community contributions welcome

---

**Last Updated**: 2025-10-31
