#!/usr/bin/env node

import { Command } from 'commander';
import { upCommand } from './commands/up';
import { stopCommand } from './commands/stop';
import { stopAllCommand } from './commands/stop-all';
import { lsCommand } from './commands/ls';
import { configCommand } from './commands/config';

const program = new Command();

program
  .name('kxpf')
  .description('CLI tool for managing Kubernetes service port-forwarding groups')
  .version('1.0.0');

// kxpf up <group> [service]
program
  .command('up <group> [service]')
  .description('Start port-forward(s) for a group, optionally filtered by service prefix')
  .action(async (group: string, service?: string) => {
    await upCommand(group, service);
  });

// kxpf stop <service>
program
  .command('stop <service>')
  .description('Stop port-forward(s) matching the service name prefix')
  .action(async (service: string) => {
    await stopCommand(service);
  });

// kxpf stop-all
program
  .command('stop-all')
  .description('Stop all running port-forwards')
  .action(async () => {
    await stopAllCommand();
  });

// kxpf ls
program
  .command('ls')
  .description('List all running port-forwards')
  .action(async () => {
    await lsCommand();
  });

// kxpf config
program
  .command('config')
  .description('Open config file in VSCode or show file path')
  .action(async () => {
    await configCommand();
  });

program.parse();
