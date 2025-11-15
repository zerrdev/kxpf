#!/usr/bin/env node

import { Command } from 'commander';
import { upCommand } from './commands/up';
import { stopCommand } from './commands/stop';
import { stopAllCommand } from './commands/stop-all';
import { lsCommand } from './commands/ls';
import { configCommand } from './commands/config';
import { findCommand } from './commands/find';

const program = new Command();

program
  .name('kxpf')
  .description('CLI tool for managing Kubernetes service port-forwarding groups')
  .version('1.1.4')
  .helpOption('-h, --help', 'Display help for command');

// Note: Global error handlers removed to avoid interfering with Commander.js
// Individual commands handle their own errors appropriately

// kxpf up <group> [service]
program
  .command('up <group> [service]')
  .description('Start port-forward(s) for a group, optionally filtered by service prefix')
  .argument('<group>', 'Group name from config file')
  .argument('[service]', 'Optional service prefix to filter which services to start')
  .action(async (group: string, service?: string) => {
    // Input validation
    if (!group || typeof group !== 'string') {
      console.error('Error: Group name is required');
      process.exit(1);
    }
    await upCommand(group.trim(), service?.trim());
  });

// kxpf stop <service>
program
  .command('stop <service>')
  .description('Stop port-forward(s) matching the service name prefix')
  .argument('<service>', 'Service name prefix to match')
  .action(async (service: string) => {
    // Input validation
    if (!service || typeof service !== 'string') {
      console.error('Error: Service prefix is required');
      process.exit(1);
    }
    await stopCommand(service.trim());
  });

// kxpf stop-all
program
  .command('stop-all')
  .description('Stop all running port-forwards')
  .alias('stopall')
  .action(async () => {
    await stopAllCommand();
  });

// kxpf ls
program
  .command('ls')
  .description('List all running port-forwards')
  .alias('list')
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

// kxpf find <search-term>
program
  .command('find <search-term>')
  .description('Find services in cluster matching the search term')
  .argument('<search-term>', 'Search term to match against service names')
  .option('-g, --group <group>', 'Filter by group context')
  .action(async (searchTerm: string, options: { group?: string }) => {
    // Input validation
    if (!searchTerm || typeof searchTerm !== 'string') {
      console.error('Error: Search term is required');
      process.exit(1);
    }
    await findCommand(searchTerm.trim(), options.group?.trim());
  });

// Add version option
program
  .addHelpCommand('help [command]', 'Display help for command')
  .showSuggestionAfterError(true);

// Handle unknown commands
program.on('command:*', () => {
  console.error('Invalid command. Use --help for available commands.');
  process.exit(1);
});

// Handle help - exit gracefully on version/help commands
program.exitOverride();

try {
  program.parse();
} catch (error) {
  // Handle Commander.js specific errors gracefully
  if (error && typeof error === 'object' && 'code' in error &&
      (error.code === 'commander.version' || error.code === 'commander.help' || error.code === 'commander.helpDisplayed')) {
    // These are normal exit conditions, just exit cleanly
    process.exit(0);
  }
  // For other errors, re-throw to let Node.js handle them
  throw error;
}
