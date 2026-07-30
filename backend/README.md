# GateDelay Backend - Migrations

## Overview

This backend uses a custom migration service that supports both SQLite (via Sequelize) and MongoDB databases. Migrations are executed via REST API endpoints.

## Prerequisites

### Required Software
- Node.js (v14 or higher)
- npm

### Required Database
- **SQLite** - Used for migration tracking and the `markets` table
  - No installation required (embedded database)
  - Database file location: `backend/data/migrations.sqlite`

### Optional Database
- **MongoDB** - Required for other features, but NOT for the `001_init_markets` migration
  - Default URI: `mongodb://127.0.0.1:27017/gatedelay`
  - Can be configured via `MONGODB_URI` environment variable

## Installation

```bash
cd backend
npm install
```

## Environment Variables

All environment variables are optional and have defaults:

- `PORT` - Server port (default: `4000`)
- `MONGODB_URI` - MongoDB connection string (default: `mongodb://127.0.0.1:27017/gatedelay`)

## Running the Server

```bash
npm start
```

The server will start on port 4000 (or the port specified in `PORT` environment variable).

## Migration Commands

### Check Migration Status

```bash
curl http://localhost:4000/api/migrations/status
```

**Expected output:**
```json
{
  "success": true,
  "data": {
    "active": null,
    "total": 1,
    "applied": 0,
    "pending": 1,
    "scripts": [
      {
        "name": "001_init_markets",
        "filename": "001_init_markets.js",
        "path": "/path/to/backend/migrations/001_init_markets.js",
        "checksum": "...",
        "applied": false
      }
    ],
    "history": []
  }
}
```

### List Available Migrations

```bash
curl http://localhost:4000/api/migrations/scripts
```

### Execute a Specific Migration

```bash
curl -X POST http://localhost:4000/api/migrations/execute \
  -H "Content-Type: application/json" \
  -d '{"name": "001_init_markets"}'
```

**Expected successful output:**
```json
{
  "success": true,
  "data": {
    "id": "mig_1234567890",
    "status": "completed",
    "progress": 100,
    "currentStep": 3,
    "totalSteps": 3,
    "error": null
  }
}
```

### Execute All Pending Migrations

```bash
curl -X POST http://localhost:4000/api/migrations/execute-all
```

### Validate Migration Integrity

```bash
curl -X POST http://localhost:4000/api/migrations/validate/001_init_markets
```

## Rollback Commands

### Rollback a Migration

After executing a migration, you can roll it back using the migration ID from the execution response:

```bash
curl -X POST http://localhost:4000/api/migrations/rollback/mig_1234567890
```

**Expected output:**
```json
{
  "success": true,
  "data": {
    "id": "mig_1234567890",
    "status": "rolled_back",
    "name": "001_init_markets"
  }
}
```

**Note:** The rollback for `001_init_markets` will drop the `markets` table.

## Migration: 001_init_markets

### What It Does

Creates the `markets` table with the following schema:

```sql
CREATE TABLE IF NOT EXISTS markets (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
```

### Steps

The migration executes in 3 steps:
1. `schema` - Creates the table structure
2. `indexes` - Applies any necessary indexes
3. `seed` - Seeds initial data (if applicable)

### Database

- **Engine**: SQLite
- **File**: `backend/data/migrations.sqlite`
- **Created automatically** when the migration runs

### Rollback Behavior

Rolling back this migration will:
- Drop the `markets` table completely
- Remove all data in the table

## Migration State Tracking

Migration state is tracked in two places:

1. **File-based state**: `backend/data/migration-state.json`
   - Tracks which migrations have been applied
   - Maintains migration history with timestamps and checksums

2. **Database log**: `migration_log` table in SQLite
   - Contains execution history with status
   - Used for auditing and debugging

## Troubleshooting

### Server won't start
- Ensure port 4000 is not in use, or set a different `PORT` environment variable
- Check that all dependencies are installed: `npm install`

### Migration fails with "already in progress"
- Only one migration can run at a time
- Check status endpoint to see if another migration is running
- Wait for the current migration to complete or fail

### Migration shows as "applied" but table doesn't exist
- Check `backend/data/migration-state.json` for state inconsistencies
- Verify the SQLite database file exists at `backend/data/migrations.sqlite`
- Use a SQLite client to inspect the database directly

## Development

### Adding New Migrations

1. Create a new file in `backend/migrations/` following the naming pattern: `00X_description.js`
2. Implement `up()` and `down()` functions
3. Use the provided context: `{ mongoose, sequelize }`

Example:
```javascript
module.exports = {
  steps: ['schema', 'indexes', 'seed'],
  async up(context) {
    const { sequelize } = context;
    // Your migration logic here
  },
  async down(context) {
    const { sequelize } = context;
    // Your rollback logic here
  },
};
```

## API Reference

### GET /api/migrations/status
Returns overall migration status and list of all migrations.

### GET /api/migrations/scripts
Returns list of discovered migration scripts.

### GET /api/migrations/progress/:id
Returns progress of a specific migration execution.

### POST /api/migrations/execute
Executes a single migration by name.

**Body:** `{"name": "migration_name"}`

### POST /api/migrations/execute-all
Executes all pending migrations in order.

### POST /api/migrations/rollback/:id
Rolls back a specific migration by execution ID.

### POST /api/migrations/validate/:name
Validates a migration's integrity (checksum and structure).
