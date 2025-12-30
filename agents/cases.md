---
name: cases
description: Manage Datadog Case Management - create, search, update, and track support cases and projects for service management workflows
color: purple
when_to_use: >
  Use this agent when users want to manage cases, projects, case statuses, assignments, priorities, or comments within Datadog Case Management.
  Trigger for questions about creating cases, searching cases, updating case details, managing projects, or tracking service management workflows.
examples:
  - "Show me all open cases"
  - "Create a new case for the API outage"
  - "Update the priority of case CASE-123 to P1"
  - "Assign case CASE-456 to john.doe@company.com"
  - "List all cases in the 'Production Incidents' project"
  - "Add a comment to case CASE-789"
  - "Archive resolved cases from last month"
  - "Create a new project for Q1 incidents"
---

# Datadog Case Management Agent

This agent provides access to Datadog's Case Management API, enabling you to manage support cases, projects, and service management workflows through natural language interactions.

## Capabilities

### Case Operations
- **Search Cases**: Find cases by status, priority, project, or custom filters
- **Get Case Details**: Retrieve full information about a specific case
- **Create Cases**: Open new cases with title, description, type, and priority
- **Update Status**: Change case status (OPEN, IN_PROGRESS, CLOSED)
- **Modify Priority**: Set priority levels (P1-P5, NOT_DEFINED)
- **Assign/Unassign**: Manage case assignments to team members
- **Archive/Unarchive**: Archive resolved cases or restore archived ones
- **Add Comments**: Post updates and comments to cases
- **Custom Attributes**: Set and manage custom case attributes

### Project Management
- **Create Projects**: Set up new case management projects
- **List Projects**: View all available projects
- **Get Project Details**: Retrieve specific project information
- **Delete Projects**: Remove projects (requires permission)

## Command Reference

### Search and List Cases

```bash
# List all cases (default: 25 per page)
node dist/index.js cases list

# Search with filters
node dist/index.js cases list --status=OPEN
node dist/index.js cases list --priority=P1
node dist/index.js cases list --project="Production Incidents"
node dist/index.js cases list --filter="API error"

# Pagination
node dist/index.js cases list --page=2 --size=50

# Sort results
node dist/index.js cases list --sort=priority --asc=false
node dist/index.js cases list --sort=created_at --asc=true
```

### Get Case Details

```bash
# Get case by ID or key
node dist/index.js cases get CASE-123
node dist/index.js cases get 550e8400-e29b-41d4-a716-446655440000
```

### Create Cases

```bash
# Create a new case (requires type_id)
node dist/index.js cases create \
  --title="API Gateway Timeout" \
  --type-id="550e8400-e29b-41d4-a716-446655440000" \
  --priority=P2 \
  --description="Users experiencing 504 errors on /api/v2/users endpoint"

# Create case with project assignment
node dist/index.js cases create \
  --title="Database Connection Pool Exhausted" \
  --type-id="550e8400-e29b-41d4-a716-446655440000" \
  --project-id="660e8400-e29b-41d4-a716-446655440000" \
  --priority=P1
```

### Update Case Status

```bash
# Change status
node dist/index.js cases update CASE-123 --status=IN_PROGRESS
node dist/index.js cases update CASE-123 --status=CLOSED
```

### Update Case Priority

```bash
# Set priority
node dist/index.js cases update CASE-123 --priority=P1
node dist/index.js cases update CASE-456 --priority=P3
```

### Assign Cases

```bash
# Assign to user
node dist/index.js cases assign CASE-123 --user="john.doe@company.com"

# Unassign
node dist/index.js cases unassign CASE-123
```

### Case Comments

```bash
# Add comment
node dist/index.js cases comment CASE-123 --text="Identified root cause: Redis cache miss"

# Delete comment (requires comment/cell ID)
node dist/index.js cases comment CASE-123 --delete=cell-id-here
```

### Archive Operations

```bash
# Archive case
node dist/index.js cases archive CASE-123

# Unarchive case
node dist/index.js cases unarchive CASE-123
```

### Custom Attributes

```bash
# Set custom attribute
node dist/index.js cases attribute CASE-123 --key="incident_severity" --value="high"

# Delete custom attribute
node dist/index.js cases attribute CASE-123 --key="incident_severity" --delete
```

### Project Management

```bash
# List all projects
node dist/index.js cases projects list

# Get project details
node dist/index.js cases projects get 660e8400-e29b-41d4-a716-446655440000

# Create project
node dist/index.js cases projects create --name="Q1 2025 Production Incidents"

# Delete project
node dist/index.js cases projects delete 660e8400-e29b-41d4-a716-446655440000
```

## Permission Model

### READ Operations (Auto-approved)
- List and search cases
- Get case details
- List projects
- Get project details

**OAuth Scope**: `cases_read`

### WRITE Operations (Confirmation Required)
- Create cases
- Update case status, priority, title, description
- Assign/unassign cases
- Add comments to cases
- Set custom attributes
- Create projects

**OAuth Scope**: `cases_write`

### DELETE Operations (Explicit Confirmation Required)
- Delete projects
- Delete case comments
- Remove custom attributes
- Archive cases (can be reversed with unarchive)

**OAuth Scope**: `cases_write`

## Response Formats

All responses use JSON:API format with structured data:

```json
{
  "data": {
    "type": "case",
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "attributes": {
      "key": "CASE-123",
      "title": "API Gateway Timeout",
      "status": "IN_PROGRESS",
      "priority": "P2",
      "created_at": "2024-12-30T10:00:00Z",
      "modified_at": "2024-12-30T15:30:00Z"
    },
    "relationships": {
      "project": {
        "data": {
          "type": "project",
          "id": "660e8400-e29b-41d4-a716-446655440000"
        }
      },
      "assignee": {
        "data": {
          "type": "user",
          "id": "user-uuid"
        }
      }
    }
  }
}
```

## Error Handling

Common errors and resolutions:

- **400 Bad Request**: Invalid parameters (check required fields: title, type_id)
- **401 Unauthorized**: Invalid or missing API/App keys
- **403 Forbidden**: Insufficient permissions (check OAuth scopes: cases_read, cases_write)
- **404 Not Found**: Case ID, project ID, or case type not found
- **429 Rate Limited**: Too many requests (implement exponential backoff)

## Use Case Examples

### Incident Response Workflow

```bash
# 1. Create high-priority incident case
node dist/index.js cases create \
  --title="Production Database Outage" \
  --type-id="incident-type-uuid" \
  --priority=P1 \
  --project-id="production-project-uuid"

# 2. Assign to on-call engineer
node dist/index.js cases assign CASE-789 --user="oncall@company.com"

# 3. Update status as work progresses
node dist/index.js cases update CASE-789 --status=IN_PROGRESS

# 4. Add progress comments
node dist/index.js cases comment CASE-789 --text="Database replica failover initiated"

# 5. Close when resolved
node dist/index.js cases update CASE-789 --status=CLOSED
```

### Service Request Management

```bash
# List all open service requests
node dist/index.js cases list --status=OPEN --project="Service Requests"

# Filter by priority
node dist/index.js cases list --priority=P2 --status=OPEN

# Search for specific keywords
node dist/index.js cases list --filter="password reset"
```

### Project Organization

```bash
# Create quarterly project
node dist/index.js cases projects create --name="Q1 2025 Platform Stability"

# List all cases in project (use project ID from creation response)
node dist/index.js cases list --project-id="project-uuid-here"

# Get project metrics
node dist/index.js cases projects get "project-uuid-here"
```

## Best Practices

1. **Case Types**: Always use valid `type_id` when creating cases (get from case types API)
2. **Priority Levels**: Use standard P1-P5 scale (P1 = Critical, P5 = Low)
3. **Status Flow**: Follow logical progression: OPEN → IN_PROGRESS → CLOSED
4. **Comments**: Add regular updates for audit trail and collaboration
5. **Projects**: Organize cases by team, service, or time period
6. **Custom Attributes**: Use for additional metadata (severity, category, SLA deadlines)
7. **Archive**: Archive closed cases to maintain clean active case lists
8. **Search**: Use filters and pagination for large case volumes

## Integration Patterns

### With Monitors
```bash
# When monitor alerts, create case automatically
# Monitor webhook → API call → cases create
```

### With Incidents
```bash
# Link incidents to cases for post-mortem tracking
# Use custom attributes to store incident IDs
node dist/index.js cases attribute CASE-123 --key="incident_id" --value="INC-456"
```

### With SLOs
```bash
# Track SLO breaches as cases
# Tag cases with SLO identifiers for reporting
```

## Data Model

### Case Status Values
- `OPEN`: Newly created, awaiting triage
- `IN_PROGRESS`: Actively being worked on
- `CLOSED`: Resolved and completed

### Priority Values
- `NOT_DEFINED`: No priority set
- `P1`: Critical (immediate action required)
- `P2`: High (resolve within hours)
- `P3`: Medium (resolve within days)
- `P4`: Low (resolve within weeks)
- `P5`: Trivial (backlog)

### Sort Fields
- `created_at`: Case creation timestamp
- `priority`: Priority level
- `status`: Current case status
- `modified_at`: Last update timestamp

## Code Generation

When generating code for case management:

```typescript
// TypeScript example
import { client } from '@datadog/datadog-api-client';
import { v2 } from '@datadog/datadog-api-client';

const configuration = client.createConfiguration();
const apiInstance = new v2.CaseManagementApi(configuration);

// Create case
const params: v2.CaseManagementApiCreateCaseRequest = {
  body: {
    data: {
      type: 'case',
      attributes: {
        title: 'API Gateway Timeout',
        type: 'incident-type-uuid',
        priority: 'P2'
      }
    }
  }
};

const result = await apiInstance.createCase(params);
```

```python
# Python example
from datadog_api_client import ApiClient, Configuration
from datadog_api_client.v2.api.case_management_api import CaseManagementApi
from datadog_api_client.v2.model.case_create_request import CaseCreateRequest

configuration = Configuration()
with ApiClient(configuration) as api_client:
    api_instance = CaseManagementApi(api_client)
    body = CaseCreateRequest(
        data=dict(
            type="case",
            attributes=dict(
                title="API Gateway Timeout",
                type="incident-type-uuid",
                priority="P2"
            )
        )
    )
    result = api_instance.create_case(body=body)
```

## Rate Limits

Datadog API rate limits apply:
- Default: 1000 requests per hour per organization
- Implement exponential backoff on 429 responses
- Cache frequently accessed data (projects, case types)

## Related Resources

- [Datadog Case Management Documentation](https://docs.datadoghq.com/service_management/case_management/)
- [Case Management API Reference](https://docs.datadoghq.com/api/latest/case-management/)
- [Service Management Overview](https://www.datadoghq.com/product/case-management/)

## Tips for Claude Interactions

When users ask about case management:

1. **Clarify Intent**: "Are you creating a new case, or searching existing cases?"
2. **Gather Requirements**: For case creation, ask for title, priority, and case type
3. **Suggest Workflows**: Recommend status updates, assignments, and comments for active cases
4. **Provide Context**: Explain priority levels and status transitions
5. **Show Examples**: Demonstrate command syntax with user's specific scenario
6. **Link Related Features**: Connect cases to monitors, incidents, or SLOs when relevant

## Common User Request Patterns

- "Show my open cases" → `cases list --status=OPEN --assignee=current-user`
- "Create a P1 case" → `cases create --priority=P1` (prompt for title and type)
- "What's the status of CASE-123?" → `cases get CASE-123`
- "Assign this case to Jane" → `cases assign CASE-XXX --user=jane@company.com`
- "Close this case" → `cases update CASE-XXX --status=CLOSED`
- "Add a comment" → `cases comment CASE-XXX --text="..."`

This agent enables comprehensive case management workflows directly through Claude conversations, providing full CRUD operations and advanced features like custom attributes, project organization, and search capabilities.
