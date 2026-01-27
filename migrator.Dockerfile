# Global args, set before the first FROM, shared by all stages
ARG NODE_ENV="production"

################################################################################
# Build stage 1 - Dependencies (minimal for db operations)

FROM node:22-alpine AS deps

WORKDIR /app/

RUN corepack enable

# Copy only what's needed for db operations
COPY package.json yarn.lock .yarnrc.yml /app/
COPY .yarn/ /app/.yarn
COPY scripts/ /app/scripts

# Only the packages needed for db setup
COPY backend/config/package.json /app/backend/config/package.json
COPY backend/db/package.json /app/backend/db/package.json
COPY packages/typescript-config/package.json /app/packages/typescript-config/package.json

RUN NO_POSTINSTALL=1 yarn

################################################################################
# Build stage 2 - Build config package

FROM deps AS builder

COPY tsconfig.json /app/

# Build typescript-config (required by config build)
COPY packages/typescript-config/ /app/packages/typescript-config/

# Build config (required by db and setup_db.js)
COPY backend/config/ /app/backend/config/
RUN yarn workspace @repo/config build

# Copy db directory (contains migrations and graphile-migrate config)
COPY backend/db/ /app/backend/db/

################################################################################
# Build stage FINAL - Runtime image for migrations

FROM node:22-alpine

WORKDIR /app/

RUN corepack enable

# Install git (required by setup_db.js checkGit function)
RUN apk add --no-cache git
RUN git init

# Copy everything from builder
COPY --from=builder /app/ /app/

# Import our shared args
ARG NODE_ENV

LABEL description="TheOpenPresenter DB Migrator"

ENV NODE_ENV=$NODE_ENV
ENV DATABASE_HOST="pg"
ENV DATABASE_NAME="theopenpresenter_db"
ENV DATABASE_OWNER="${DATABASE_NAME}"
ENV DATABASE_VISITOR="${DATABASE_NAME}_visitor"
ENV DATABASE_AUTHENTICATOR="${DATABASE_NAME}_authenticator"

# Default command runs migrations
# Can be overridden to run setup_db.js or other db commands
ENTRYPOINT [ "sh", "-c" ]
CMD [ "yarn setup:db" ]
