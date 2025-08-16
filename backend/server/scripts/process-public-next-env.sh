#!/bin/sh

if [ -n "$NODE_ENV" ]
then
  if [ "$NODE_ENV" = "production" ]
  then
    echo "Preprocessing environment variables"

    # Determine the project root directory
    # If running in Docker, use /app, otherwise use relative path from backend/server
    if [ -d "/app" ]; then
      PROJECT_ROOT="/app"
    else
      PROJECT_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
    fi

    echo "Using project root: $PROJECT_ROOT"

    # For each of the var in .env.production, replace with proper process env
    while read line; do
      ENV_NAME=$(echo "$line" | cut -d "=" -f 1)
      STRING_TO_REPLACE=$(echo "$line" | cut -d "=" -f 2)

      eval "ACTUAL_ENV=\$$ENV_NAME"

      find "$PROJECT_ROOT/apps/homepage/.next" -type f -name "*.js" -print0 | xargs -0 -P $(nproc) sed -i "s|$STRING_TO_REPLACE|$ACTUAL_ENV|g";
    done < "$PROJECT_ROOT/backend/server/.env.production"

    while read line; do
      ENV_NAME=$(echo "$line" | cut -d "=" -f 1)
      STRING_TO_REPLACE=$(echo "$line" | cut -d "=" -f 2)

      eval "ACTUAL_ENV=\$$ENV_NAME"

      find "$PROJECT_ROOT/apps/remote/dist" -type f -name "*.js" -print0 | xargs -0 -P $(nproc) sed -i "s|$STRING_TO_REPLACE|$ACTUAL_ENV|g";
    done < "$PROJECT_ROOT/apps/remote/.env.production"
  
    while read line; do
      ENV_NAME=$(echo "$line" | cut -d "=" -f 1)
      STRING_TO_REPLACE=$(echo "$line" | cut -d "=" -f 2)

      eval "ACTUAL_ENV=\$$ENV_NAME"

      find "$PROJECT_ROOT/apps/renderer/dist" -type f -name "*.js" -print0 | xargs -0 -P $(nproc) sed -i "s|$STRING_TO_REPLACE|$ACTUAL_ENV|g";
    done < "$PROJECT_ROOT/apps/renderer/.env.production"
  fi
fi
