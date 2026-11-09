#!/bin/bash
# UNSUPPORTED. PAN Parrot deploys on Netlify. See DEPLOYMENT.md.
echo "This startup script is unsupported. Read DEPLOYMENT.md." >&2
exit 1

# PAN Parrot Startup Script
# This script handles database initialization and starts the application

set -e

echo "🦜 Starting PAN Parrot..."

# Wait for database to be ready
echo "⏳ Waiting for database..."
for i in {1..30}; do
  if npx prisma db push --skip-generate > /dev/null 2>&1; then
    echo "✅ Database is ready"
    break
  fi
  echo "⏳ Database not ready, waiting... ($i/30)"
  sleep 2
done

# Run database migrations
echo "🗄️ Running database migrations..."
npx prisma db push --skip-generate

# Seed database with default users
echo "🌱 Seeding database..."
if [ "$NODE_ENV" = "production" ]; then
  # In production, only seed if no users exist
  npm run db:seed 2>/dev/null || echo "Database already seeded"
else
  npm run db:seed
fi

echo "🚀 Starting application..."
exec "$@"
