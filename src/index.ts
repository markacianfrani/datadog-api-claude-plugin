#!/usr/bin/env node
/**
 * CLI entry point for Datadog API Claude Plugin
 * Routes commands to appropriate API handlers
 */

import { ErrorHandler } from './lib/error-handler';
import { ResponseFormatter } from './lib/formatter';
import { ConfigValidator } from './lib/config';
import { createMetricsApi } from './api/v2/metrics';
import { createMonitorsApi } from './api/v1/monitors';
import { createDashboardsApi } from './api/v1/dashboards';
import { createLogsApi } from './api/v2/logs';
import { createSpansApi } from './api/v2/spans';
import { createSLOsApi } from './api/v1/slos';
import { createIncidentsApi } from './api/v2/incidents';
import { createSyntheticsApi } from './api/v1/synthetics';
import { createRUMApi } from './api/v2/rum';
import { createSecurityMonitoringApi } from './api/v2/security';
import { createHostsApi } from './api/v1/hosts';
import { createUsersApi } from './api/v2/users';
import { generateTypeScriptCode } from './codegen/typescript-templates';
import { generatePythonCode } from './codegen/python-templates';

/**
 * Helper function to parse time parameters
 * Supports Unix timestamps and relative time (e.g., "1h", "30m", "1d", "now")
 */
function parseTimeParam(timeStr: string): number {
  if (timeStr === 'now') {
    return Math.floor(Date.now() / 1000);
  }

  // If it's a number, assume it's a Unix timestamp
  if (/^\d+$/.test(timeStr)) {
    return parseInt(timeStr);
  }

  // Parse relative time (e.g., "1h", "30m", "2d")
  const match = timeStr.match(/^(\d+)([smhd])?$/);
  if (match) {
    const value = parseInt(match[1]);
    const unit = match[2] || 's'; // default to seconds
    const now = Math.floor(Date.now() / 1000);

    switch (unit) {
      case 's':
        return now - value;
      case 'm':
        return now - value * 60;
      case 'h':
        return now - value * 3600;
      case 'd':
        return now - value * 86400;
    }
  }

  // If all else fails, try to parse as ISO date
  const timestamp = Date.parse(timeStr);
  if (!isNaN(timestamp)) {
    return Math.floor(timestamp / 1000);
  }

  throw new Error(`Invalid time format: ${timeStr}`);
}

/**
 * Check if --generate flag is present and return language
 * Returns: 'typescript', 'python', or null if not generating
 */
function getGenerateLanguage(args: string[]): 'typescript' | 'python' | null {
  const generateFlag = args.find((arg) => arg === '--generate' || arg.startsWith('--generate='));

  if (!generateFlag) {
    return null;
  }

  // Check for --language flag
  const languageArg = args.find((arg) => arg.startsWith('--language='));
  if (languageArg) {
    const language = languageArg.split('=')[1].toLowerCase();
    if (language === 'typescript' || language === 'ts') {
      return 'typescript';
    } else if (language === 'python' || language === 'py') {
      return 'python';
    }
  }

  // Check if --generate has a value (e.g., --generate=python)
  if (generateFlag.includes('=')) {
    const language = generateFlag.split('=')[1].toLowerCase();
    if (language === 'typescript' || language === 'ts') {
      return 'typescript';
    } else if (language === 'python' || language === 'py') {
      return 'python';
    }
  }

  // Default to TypeScript
  return 'typescript';
}

/**
 * Generate code for a command
 */
function generateCode(
  language: 'typescript' | 'python',
  domain: string,
  operation: string,
  params: Record<string, any>
): string {
  if (language === 'python') {
    return generatePythonCode({ domain, operation, params });
  } else {
    return generateTypeScriptCode({ domain, operation, params });
  }
}

/**
 * Main CLI function
 */
async function main() {
  try {
    // Parse command line arguments
    const args = process.argv.slice(2);

    if (args.length === 0) {
      printUsage();
      process.exit(0);
    }

    const command = args[0];
    const subcommand = args[1];
    const commandArgs = args.slice(2);

    // Route to appropriate command handler
    // Note: Validation happens inside command handlers that need credentials
    switch (command) {
      case 'metrics':
        await handleMetricsCommand(subcommand, commandArgs);
        break;
      case 'monitors':
        await handleMonitorsCommand(subcommand, commandArgs);
        break;
      case 'dashboards':
        await handleDashboardsCommand(subcommand, commandArgs);
        break;
      case 'logs':
        await handleLogsCommand(subcommand, commandArgs);
        break;
      case 'traces':
        await handleTracesCommand(subcommand, commandArgs);
        break;
      case 'slos':
        await handleSlosCommand(subcommand, commandArgs);
        break;
      case 'incidents':
        await handleIncidentsCommand(subcommand, commandArgs);
        break;
      case 'synthetics':
        await handleSyntheticsCommand(subcommand, commandArgs);
        break;
      case 'rum':
        await handleRumCommand(subcommand, commandArgs);
        break;
      case 'security':
        await handleSecurityCommand(subcommand, commandArgs);
        break;
      case 'infrastructure':
        await handleInfrastructureCommand(subcommand, commandArgs);
        break;
      case 'admin':
        await handleAdminCommand(subcommand, commandArgs);
        break;
      case 'test':
        await handleTestCommand();
        break;
      case 'version':
        printVersion();
        break;
      case 'help':
      case '--help':
      case '-h':
        printUsage();
        break;
      default:
        console.error(`Unknown command: ${command}`);
        printUsage();
        process.exit(1);
    }
  } catch (error) {
    console.error(ErrorHandler.format(error as Error));
    process.exit(1);
  }
}

/**
 * Prints usage information
 */
function printUsage() {
  console.log(`
Datadog API Claude Plugin - CLI Tool

Usage: dd-plugin <command> <subcommand> [options]

Commands:
  metrics        Query and submit metrics
  monitors       Manage monitors
  dashboards     Manage dashboards
  logs           Search and analyze logs
  traces         Query APM traces
  slos           Manage Service Level Objectives
  incidents      Manage incidents
  synthetics     Manage synthetic tests
  rum            Query Real User Monitoring data
  security       Query security monitoring data
  infrastructure Manage hosts and integrations
  admin          Manage users, organizations, and API keys
  test           Test connection and credentials
  version        Show version information
  help           Show this help message

Environment Variables:
  DD_API_KEY     Datadog API key (required)
  DD_APP_KEY     Datadog Application key (required)
  DD_SITE        Datadog site (default: datadoghq.com)

Examples:
  dd-plugin metrics list
  dd-plugin monitors list
  dd-plugin dashboards get <dashboard-id>
  dd-plugin test

For detailed command help:
  dd-plugin <command> help
  `);
}

/**
 * Prints version information
 */
function printVersion() {
  const packageJson = require('../package.json');
  console.log(`Datadog API Claude Plugin v${packageJson.version}`);
}

/**
 * Test command - validates connection and credentials
 */
async function handleTestCommand() {
  const config = ConfigValidator.validate();
  console.log(
    ResponseFormatter.formatSuccess('Configuration is valid', {
      site: config.site,
      apiKeyLength: config.apiKey.length,
      appKeyLength: config.appKey.length,
    })
  );

  // TODO: Make a simple API call to verify credentials work
  console.log('\nNote: Full credential verification will be implemented in Phase 2');
}

/**
 * Metrics command handler
 */
async function handleMetricsCommand(subcommand: string, args: string[]) {
  // Handle help without requiring credentials
  if (subcommand === 'help') {
    console.log(`
Metrics Commands:
  list [--filter=<pattern>] [--limit=<n>]   List available metrics
  query --query=<metric> [--from=<time>] [--to=<time>]   Query metric data
  submit                                    Submit custom metrics (use agent)

Code Generation:
  Add --generate or --generate=python to generate code instead of executing
  Add --language=typescript or --language=python to specify language

Time format: Unix timestamp or relative (e.g., 1h, 30m, 1d ago)

Examples:
  dd-plugin metrics list
  dd-plugin metrics list --filter="system.*"
  dd-plugin metrics query --query="avg:system.cpu.user{*}" --from="1h" --to="now"
  dd-plugin metrics query --query="avg:system.cpu.user{*}" --generate=python
    `);
    return;
  }

  // Check if we're generating code instead of executing
  const generateLanguage = getGenerateLanguage(args);

  switch (subcommand) {
    case 'list':
      const filter = args.find((arg) => arg.startsWith('--filter='))?.split('=')[1];
      const limit = args.find((arg) => arg.startsWith('--limit='))?.split('=')[1];

      if (generateLanguage) {
        const code = generateCode(generateLanguage, 'metrics', 'list', { filter, limit });
        console.log(code);
        return;
      }

      const api = createMetricsApi();
      const result = await api.listMetrics({
        filter,
        limit: limit ? parseInt(limit) : undefined,
      });
      console.log(result);
      break;

    case 'query':
      const query = args.find((arg) => arg.startsWith('--query='))?.split('=')[1];
      const from = args.find((arg) => arg.startsWith('--from='))?.split('=')[1];
      const to = args.find((arg) => arg.startsWith('--to='))?.split('=')[1];

      if (!query) {
        console.error(ResponseFormatter.formatError('--query is required'));
        process.exit(1);
      }

      if (generateLanguage) {
        const code = generateCode(generateLanguage, 'metrics', 'query', { query, from, to });
        console.log(code);
        return;
      }

      // Parse time parameters (default to last hour)
      const now = Math.floor(Date.now() / 1000);
      const fromTimestamp = from ? parseTimeParam(from) : now - 3600;
      const toTimestamp = to ? parseTimeParam(to) : now;

      const metricsApi = createMetricsApi();
      const queryResult = await metricsApi.queryMetrics({
        query,
        from: fromTimestamp,
        to: toTimestamp,
      });
      console.log(queryResult);
      break;

    case 'submit':
      const metric = args.find((arg) => arg.startsWith('--metric='))?.split('=')[1];
      const value = args.find((arg) => arg.startsWith('--value='))?.split('=')[1];
      const tags = args.find((arg) => arg.startsWith('--tags='))?.split('=')[1]?.split(',');

      if (generateLanguage) {
        const code = generateCode(generateLanguage, 'metrics', 'submit', { metric, value, tags });
        console.log(code);
        return;
      }

      console.log(
        ResponseFormatter.formatError(
          'Metric submission requires structured data',
          { note: 'Use the agent for interactive metric submission, or use --generate to create code' }
        )
      );
      break;

    default:
      console.error(ResponseFormatter.formatError('Unknown subcommand', { subcommand }));
      process.exit(1);
  }
}

/**
 * Monitors command handler
 */
async function handleMonitorsCommand(subcommand: string, args: string[]) {
  // Handle help without requiring credentials
  if (subcommand === 'help') {
    console.log(`
Monitors Commands:
  list [--name=<name>] [--tags=<tag1,tag2>]   List monitors
  get <monitor-id>                             Get monitor details
  search <query>                               Search monitors by name
  create                                       Create monitor (use agent)
  delete <monitor-id>                          Delete monitor

Examples:
  dd-plugin monitors list
  dd-plugin monitors list --name="CPU"
  dd-plugin monitors get 12345
  dd-plugin monitors search "production"
  dd-plugin monitors delete 12345
    `);
    return;
  }

  const api = createMonitorsApi();

  switch (subcommand) {
    case 'list':
      const name = args.find((arg) => arg.startsWith('--name='))?.split('=')[1];
      const tags = args.find((arg) => arg.startsWith('--tags='))?.split('=')[1]?.split(',');
      const result = await api.listMonitors({ name, tags });
      console.log(result);
      break;

    case 'get':
      const monitorId = args[0];
      if (!monitorId) {
        console.error(ResponseFormatter.formatError('Monitor ID is required'));
        process.exit(1);
      }
      const monitor = await api.getMonitor(parseInt(monitorId));
      console.log(monitor);
      break;

    case 'create':
      console.log(
        ResponseFormatter.formatError(
          'Monitor creation requires structured data',
          { note: 'Use the agent for interactive monitor creation' }
        )
      );
      break;

    case 'delete':
      const deleteId = args[0];
      if (!deleteId) {
        console.error(ResponseFormatter.formatError('Monitor ID is required'));
        process.exit(1);
      }
      const deleteResult = await api.deleteMonitor(parseInt(deleteId));
      console.log(deleteResult);
      break;

    case 'search':
      const searchQuery = args.join(' ');
      if (!searchQuery) {
        console.error(ResponseFormatter.formatError('Search query is required'));
        process.exit(1);
      }
      const searchResult = await api.searchMonitors(searchQuery);
      console.log(searchResult);
      break;

    default:
      console.error(ResponseFormatter.formatError('Unknown subcommand', { subcommand }));
      process.exit(1);
  }
}

/**
 * Dashboards command handler
 */
async function handleDashboardsCommand(subcommand: string, args: string[]) {
  // Handle help without requiring credentials
  if (subcommand === 'help') {
    console.log(`
Dashboards Commands:
  list                           List all dashboards
  get <dashboard-id>             Get dashboard details
  url <dashboard-id>             Get dashboard URL
  create                         Create dashboard (use agent)
  delete <dashboard-id>          Delete dashboard

Examples:
  dd-plugin dashboards list
  dd-plugin dashboards get abc-123-def
  dd-plugin dashboards url abc-123-def
  dd-plugin dashboards delete abc-123-def
    `);
    return;
  }

  const api = createDashboardsApi();

  switch (subcommand) {
    case 'list':
      const result = await api.listDashboards();
      console.log(result);
      break;

    case 'get':
      const dashboardId = args[0];
      if (!dashboardId) {
        console.error(ResponseFormatter.formatError('Dashboard ID is required'));
        process.exit(1);
      }
      const dashboard = await api.getDashboard(dashboardId);
      console.log(dashboard);
      break;

    case 'create':
      console.log(
        ResponseFormatter.formatError(
          'Dashboard creation requires structured data',
          { note: 'Use the agent for interactive dashboard creation' }
        )
      );
      break;

    case 'delete':
      const deleteId = args[0];
      if (!deleteId) {
        console.error(ResponseFormatter.formatError('Dashboard ID is required'));
        process.exit(1);
      }
      const deleteResult = await api.deleteDashboard(deleteId);
      console.log(deleteResult);
      break;

    case 'url':
      const urlId = args[0];
      if (!urlId) {
        console.error(ResponseFormatter.formatError('Dashboard ID is required'));
        process.exit(1);
      }
      const urlResult = await api.getDashboardPublicUrl(urlId);
      console.log(urlResult);
      break;

    default:
      console.error(ResponseFormatter.formatError('Unknown subcommand', { subcommand }));
      process.exit(1);
  }
}

/**
 * Logs command handler
 */
async function handleLogsCommand(subcommand: string, args: string[]) {
  // Handle help without requiring credentials
  if (subcommand === 'help') {
    console.log(`
Logs Commands:
  search --query=<query> [--from=<time>] [--to=<time>] [--limit=<n>]   Search logs

Time format: Unix timestamp or relative (e.g., 1h, 30m, 1d ago)

Examples:
  dd-plugin logs search --query="status:error" --from="1h" --to="now"
  dd-plugin logs search --query="service:api" --limit=100
    `);
    return;
  }

  const api = createLogsApi();

  switch (subcommand) {
    case 'search':
      const query = args.find((arg) => arg.startsWith('--query='))?.split('=')[1];
      const from = args.find((arg) => arg.startsWith('--from='))?.split('=')[1];
      const to = args.find((arg) => arg.startsWith('--to='))?.split('=')[1];
      const limit = args.find((arg) => arg.startsWith('--limit='))?.split('=')[1];

      if (!query) {
        console.error(ResponseFormatter.formatError('--query is required'));
        process.exit(1);
      }

      const now = Math.floor(Date.now() / 1000);
      const fromTimestamp = from ? parseTimeParam(from) : now - 3600;
      const toTimestamp = to ? parseTimeParam(to) : now;

      const result = await api.searchLogs({
        query,
        from: fromTimestamp,
        to: toTimestamp,
        limit: limit ? parseInt(limit) : undefined,
      });
      console.log(result);
      break;

    default:
      console.error(ResponseFormatter.formatError('Unknown subcommand', { subcommand }));
      process.exit(1);
  }
}

/**
 * Traces command handler
 */
async function handleTracesCommand(subcommand: string, args: string[]) {
  if (subcommand === 'help') {
    console.log(`
Traces Commands:
  search --query=<query> [--from=<time>] [--to=<time>] [--limit=<n>]   Search spans

Examples:
  dd-plugin traces search --query="service:api" --from="1h"
    `);
    return;
  }

  const api = createSpansApi();
  const query = args.find((arg) => arg.startsWith('--query='))?.split('=')[1] || '*';
  const from = args.find((arg) => arg.startsWith('--from='))?.split('=')[1];
  const to = args.find((arg) => arg.startsWith('--to='))?.split('=')[1];
  const now = Math.floor(Date.now() / 1000);
  const result = await api.searchSpans({
    query,
    from: from ? parseTimeParam(from) : now - 3600,
    to: to ? parseTimeParam(to) : now,
  });
  console.log(result);
}

/**
 * SLOs command handler
 */
async function handleSlosCommand(subcommand: string, args: string[]) {
  if (subcommand === 'help') {
    console.log(`
SLOs Commands:
  list                  List all SLOs
  get <slo-id>          Get SLO details
  delete <slo-id>       Delete SLO

Examples:
  dd-plugin slos list
  dd-plugin slos get abc-123
    `);
    return;
  }

  const api = createSLOsApi();
  switch (subcommand) {
    case 'list':
      console.log(await api.listSLOs());
      break;
    case 'get':
      console.log(await api.getSLO(args[0]));
      break;
    case 'delete':
      console.log(await api.deleteSLO(args[0]));
      break;
    default:
      console.error(ResponseFormatter.formatError('Unknown subcommand', { subcommand }));
  }
}

/**
 * Incidents command handler
 */
async function handleIncidentsCommand(subcommand: string, args: string[]) {
  if (subcommand === 'help') {
    console.log(`
Incidents Commands:
  list                  List all incidents
  get <incident-id>     Get incident details

Examples:
  dd-plugin incidents list
  dd-plugin incidents get abc-123
    `);
    return;
  }

  const api = createIncidentsApi();
  switch (subcommand) {
    case 'list':
      console.log(await api.listIncidents());
      break;
    case 'get':
      console.log(await api.getIncident(args[0]));
      break;
    default:
      console.error(ResponseFormatter.formatError('Unknown subcommand', { subcommand }));
  }
}

/**
 * Synthetics command handler
 */
async function handleSyntheticsCommand(subcommand: string, args: string[]) {
  if (subcommand === 'help') {
    console.log(`
Synthetics Commands:
  list                  List all synthetic tests
  get <test-id>         Get test details

Examples:
  dd-plugin synthetics list
  dd-plugin synthetics get abc-123
    `);
    return;
  }

  const api = createSyntheticsApi();
  switch (subcommand) {
    case 'list':
      console.log(await api.listTests());
      break;
    case 'get':
      console.log(await api.getTest(args[0]));
      break;
    default:
      console.error(ResponseFormatter.formatError('Unknown subcommand', { subcommand }));
  }
}

/**
 * RUM command handler
 */
async function handleRumCommand(subcommand: string, args: string[]) {
  if (subcommand === 'help') {
    console.log(`
RUM Commands:
  search --query=<query> [--from=<time>] [--to=<time>]   Search RUM events

Examples:
  dd-plugin rum search --query="@type:view" --from="1h"
    `);
    return;
  }

  const api = createRUMApi();
  const query = args.find((arg) => arg.startsWith('--query='))?.split('=')[1] || '*';
  const from = args.find((arg) => arg.startsWith('--from='))?.split('=')[1];
  const to = args.find((arg) => arg.startsWith('--to='))?.split('=')[1];
  const now = Math.floor(Date.now() / 1000);
  const result = await api.searchRUMEvents({
    query,
    from: from ? parseTimeParam(from) : now - 3600,
    to: to ? parseTimeParam(to) : now,
  });
  console.log(result);
}

/**
 * Security command handler
 */
async function handleSecurityCommand(subcommand: string, args: string[]) {
  if (subcommand === 'help') {
    console.log(`
Security Commands:
  signals [--from=<time>] [--to=<time>]   List security signals
  rules                                    List security rules

Examples:
  dd-plugin security signals --from="24h"
  dd-plugin security rules
    `);
    return;
  }

  const api = createSecurityMonitoringApi();
  switch (subcommand) {
    case 'signals':
      const from = args.find((arg) => arg.startsWith('--from='))?.split('=')[1];
      const to = args.find((arg) => arg.startsWith('--to='))?.split('=')[1];
      const now = Math.floor(Date.now() / 1000);
      console.log(await api.listSecuritySignals({
        from: from ? parseTimeParam(from) : now - 86400,
        to: to ? parseTimeParam(to) : now,
      }));
      break;
    case 'rules':
      console.log(await api.listSecurityRules());
      break;
    default:
      console.error(ResponseFormatter.formatError('Unknown subcommand', { subcommand }));
  }
}

/**
 * Infrastructure command handler
 */
async function handleInfrastructureCommand(subcommand: string, args: string[]) {
  if (subcommand === 'help') {
    console.log(`
Infrastructure Commands:
  hosts [--filter=<filter>]   List all hosts
  totals                       Get host totals

Examples:
  dd-plugin infrastructure hosts
  dd-plugin infrastructure hosts --filter="env:prod"
  dd-plugin infrastructure totals
    `);
    return;
  }

  const api = createHostsApi();
  switch (subcommand) {
    case 'hosts':
      const filter = args.find((arg) => arg.startsWith('--filter='))?.split('=')[1];
      console.log(await api.listHosts(filter));
      break;
    case 'totals':
      console.log(await api.getHostTotals());
      break;
    default:
      console.error(ResponseFormatter.formatError('Unknown subcommand', { subcommand }));
  }
}

/**
 * Admin command handler
 */
async function handleAdminCommand(subcommand: string, args: string[]) {
  if (subcommand === 'help') {
    console.log(`
Admin Commands:
  users                 List all users
  user <user-id>        Get user details

Examples:
  dd-plugin admin users
  dd-plugin admin user abc-123
    `);
    return;
  }

  const api = createUsersApi();
  switch (subcommand) {
    case 'users':
      console.log(await api.listUsers());
      break;
    case 'user':
      console.log(await api.getUser(args[0]));
      break;
    default:
      console.error(ResponseFormatter.formatError('Unknown subcommand', { subcommand }));
  }
}

// Run the CLI
if (require.main === module) {
  main().catch((error) => {
    console.error(ErrorHandler.format(error));
    process.exit(1);
  });
}

export { main };
