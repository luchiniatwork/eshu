#!/bin/sh
# Eshu — Idempotent migration runner
#
# Applies SQL migrations from /migrations/ in alphabetical order.
# Tracks applied migrations in a _applied_migrations table so it's
# safe to run on every `docker compose up`.
#
# Environment:
#   DATABASE_URL — PostgreSQL connection string (required)

set -e

if [ -z "$DATABASE_URL" ]; then
  echo "ERROR: DATABASE_URL is not set"
  exit 1
fi

# Wait for PostgreSQL to accept connections
echo "Waiting for PostgreSQL..."
until pg_isready -d "$DATABASE_URL" > /dev/null 2>&1; do
  sleep 1
done
echo "PostgreSQL is ready."

# Create tracking table if it doesn't exist
psql "$DATABASE_URL" -q -c "
  CREATE TABLE IF NOT EXISTS _applied_migrations (
    filename TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
"

# Apply each migration in order
applied=0
skipped=0

for f in /migrations/*.sql; do
  filename=$(basename "$f")
  already=$(psql "$DATABASE_URL" -tAc \
    "SELECT 1 FROM _applied_migrations WHERE filename = '$filename'" 2>/dev/null)

  if [ "$already" = "1" ]; then
    echo "  skip  $filename (already applied)"
    skipped=$((skipped + 1))
  else
    echo "  apply $filename"
    psql "$DATABASE_URL" -q -f "$f"
    psql "$DATABASE_URL" -q -c \
      "INSERT INTO _applied_migrations (filename) VALUES ('$filename')"
    applied=$((applied + 1))
  fi
done

echo "Migrations complete: $applied applied, $skipped skipped."
