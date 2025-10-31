# About
A CLI program for managing groups of Kubernetes service port-forwards.

# Installation

```bash
yarn install
yarn build
yarn link
```

After linking, the `kxpf` command will be available globally.

# Commands

## kxpf up <group> [service]
Starts port-forwarding for all services in a group and keeps them running in the background.

**Example:** Start all services in a group
```bash
kxpf up group1
```

For the config:
```
group1: {
    service1,8081,80
    service2,8082,80
    service3,8083,80
}
```

service1 would be exposed on localhost at port 8081, pointing to internal port 80 in the container. The same applies to the other services in the group.

**Example:** Start a specific service by prefix
```bash
kxpf up group1 service1
```

For the config:
```
group1: {
    service1-12312x,8081,80
    ms-service1,8082,80
    mservice1m,8083,80
}
```

Only the service exposed on local port 8081 would be port-forwarded (service1-12312x).

## kxpf stop <service>
Stops port-forwarding for any service whose name starts with the specified parameter.

```bash
kxpf stop service1
```

## kxpf stop-all
Stops all currently running port-forwards.

```bash
kxpf stop-all
```

## kxpf ls
Lists all running port-forwards.

```bash
kxpf ls
```

## kxpf config
Opens VSCode to edit the current configuration file. If VSCode is not found, displays the config file path (`~/.kxpf.config` on Unix, `%userprofile%/.kxpf.config` on Windows).

```bash
kxpf config
```

# Configuration File

The configuration file follows a group-based structure located at `~/.kxpf.config` (Unix) or `%userprofile%/.kxpf.config` (Windows).

## Rules

### Group Definition
- Each group is delimited by curly braces
- Group names can contain letters (ANSI), numbers, and hyphens
- Format: `group-name: { ... }`

```
my-group: {
}
```

### Context (Optional)
- You can specify a Kubernetes context per group to target different clusters
- Format: `context: context-name`

```
production: {
    context: prod-cluster
    api-service,8081,80
}
```

### Service Definition
- Services are defined as: `service-name,local-port,remote-port`
- One service per line
- Semicolons are optional

```
my-group: {
    service-name,8080,80
    another-service,8081,80
}
```

For service "service-name", port 8080 will be exposed on localhost, pointing to internal port 80 in the container.

### Comments
- Lines starting with `#` are comments
- Spaces before `#` are ignored during parsing

```
my-group: {
    service1,8080,80
    # service2,8081,80  (this is commented out)
}
```

### Whitespace Rules
- Spaces between group name and opening brace are ignored
- Spaces between parameters in service definitions are ignored

**Valid group declarations:**
```
group1:{
    service1,8081,80
}
group2:  {
    service2,8081,80
}
group3 : {
    service3,8081,80
}
```

**Valid service definitions:**
```
group1: {
    service1, 8081,80
    service2, 8082 ,80
    service3,8083 ,80
    service4, 8084 , 80
}
```

## Complete Example

```
# Config format: service-name,local-port,remote-port

development: {
    api-service,8080,80
    web-service,8081,3000
    db-admin,8082,5432
}

production: {
    context: prod-cluster
    api-service,9080,80
    web-service,9081,3000
}
```

# How It Works

## General Behavior
- Each port-forward runs in an independent, detached process
- Processes are not tied to the CLI or the program that invoked them
- You can list all port-forwards showing: service name, local port, remote port
- Process management is based on information from `kubectl` for reliability
- Cross-platform support for Windows and Linux

## Technical Details

### Stack
- Node.js 22+
- Yarn
- TypeScript

### Port-Forward Management
- Uses `kubectl port-forward` or `minikube kubectl --` (automatic fallback)
- Spawns detached processes that survive terminal closure
- Queries running kubectl processes to list active port-forwards
- Supports Kubernetes contexts via `--context` flag

### File Initialization
The config file is automatically created in the user's home directory as `.kxpf.config` with an example group and parameter format comment when `kxpf` first runs (if the file doesn't exist).
