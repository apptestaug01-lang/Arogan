# Database Scripts

Scripts for managing the PostgreSQL database used by LoanFlow.

## Files

- `cleanup.sql` — deletes all data in FK-safe order (child tables first, then parents).
- `schema-backup.sql` — full schema dump (tables, indexes, enums, FK constraints).

## Usage

### Clean up all data

```bash
# Via psql directly
psql "$DATABASE_URL" -f prisma/scripts/cleanup.sql

# Or via Prisma db execute
npx prisma db execute --stdin --schema prisma/schema.prisma < prisma/scripts/cleanup.sql
```

### Restore schema from backup

```bash
psql "$DATABASE_URL" -f prisma/scripts/schema-backup.sql
```

### Render deployment notes

- Render auto-deploys from `main`.
- The `backend/Dockerfile` runs `prisma db push --skip-generate` on every start to sync schema changes.
- Migration history lives in `backend/prisma/migrations/`.
- Always keep `schema-backup.sql` and the `migrations/` folder committed so the DB can be rebuilt if needed.
