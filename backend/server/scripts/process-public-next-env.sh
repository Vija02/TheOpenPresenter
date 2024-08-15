#!/bin/sh

if [ -n "$NODE_ENV" ]
then
  if [ "$NODE_ENV" = "production" ]
  then
    echo "Preprocessing environment variables"
    echo "This should only run on our docker build"

    # For each of the var in .env.production, replace with proper process env
    while read line; do
      ENV_NAME=$(echo "$line" | cut -d "=" -f 1)
      STRING_TO_REPLACE=$(echo "$line" | cut -d "=" -f 2)

      eval "ACTUAL_ENV=\$$ENV_NAME"

      find /app/@app/client/.next -type f -exec sed -i "s|$STRING_TO_REPLACE|$ACTUAL_ENV|g" {} \;
    done < /app/@app/server/.env.production
  fi
fi
