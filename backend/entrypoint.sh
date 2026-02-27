#!/bin/sh
set -e

echo "⏳ Waiting for postgres..."
until python -c "import psycopg2; psycopg2.connect(dsn='$DATABASE_URL_SYNC')" 2>/dev/null; do
  sleep 1
done
echo "✅ Postgres ready"

echo "🔄 Running migrations..."
alembic upgrade head
echo "✅ Migrations done"

echo "🚀 Starting server..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
