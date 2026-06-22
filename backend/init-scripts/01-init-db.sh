#!/bin/sh
set -e

echo "Running database initialization..."

# Wait for PostgreSQL to be ready
until PGPASSWORD="$POSTGRES_PASSWORD" psql -h "$POSTGRES_HOST" -U "$POSTGRES_USER" -d postgres -c '\q'; do
  echo "Waiting for PostgreSQL to start..."
  sleep 1
done

echo "PostgreSQL is ready!"

# Note: Migrations will be run by the backend service on startup
echo "Database initialization completed!"