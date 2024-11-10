# Global args, set before the first FROM, shared by all stages
ARG PORT=5678
ARG NODE_ENV="production"
ARG TARGET="server"
# Reflect the same as on `.env.production`
ARG ROOT_URL="ROOT_URL_PLACEHOLDER"

################################################################################
# Build stage 1 - Dependencies

FROM node:22-alpine AS deps
# Import our shared args
ARG NODE_ENV
ARG ROOT_URL

WORKDIR /app/

RUN corepack enable

# Cache node_modules for as long as possible
COPY turbo.json package.json yarn.lock .yarnrc.yml /app/
COPY .yarn/ /app/.yarn
COPY patches/ /app/patches
COPY scripts/ /app/scripts

COPY apps/homepage/package.json /app/apps/homepage/package.json
COPY apps/remote/package.json /app/apps/remote/package.json
COPY apps/renderer/package.json /app/apps/renderer/package.json
COPY backend/backend-shared/package.json /app/backend/backend-shared/package.json
COPY backend/config/package.json /app/backend/config/package.json
COPY backend/db/package.json /app/backend/db/package.json
COPY backend/server/package.json /app/backend/server/package.json
COPY backend/worker/package.json /app/backend/worker/package.json
COPY packages/base-plugin/package.json /app/packages/base-plugin/package.json
COPY packages/eslint-config/package.json /app/packages/eslint-config/package.json
COPY packages/graphql/package.json /app/packages/graphql/package.json
COPY packages/lib/package.json /app/packages/lib/package.json
COPY packages/prettier-config/package.json /app/packages/prettier-config/package.json
COPY packages/typescript-config/package.json /app/packages/typescript-config/package.json
COPY packages/ui/package.json /app/packages/ui/package.json
COPY plugins/google-slides/package.json /app/plugins/google-slides/package.json
COPY plugins/myworshiplist/package.json /app/plugins/myworshiplist/package.json
COPY plugins/simple-image/package.json /app/plugins/simple-image/package.json
COPY plugins/audio-recorder/package.json /app/plugins/audio-recorder/package.json
COPY plugins/video-player/package.json /app/plugins/video-player/package.json
COPY plugins/radio/package.json /app/plugins/radio/package.json

RUN yarn install

################################################################################
# Build stage 2 - Build core

FROM deps AS builder-core

COPY tsconfig.json .gitignore /app/
COPY data/ /app/data

COPY packages/typescript-config/ /app/packages/typescript-config/

COPY packages/graphql/ /app/packages/graphql/
COPY apps/homepage/src/graphql/ /app/apps/homepage/src/graphql/
COPY apps/remote/src/graphql/ /app/apps/remote/src/graphql/
COPY apps/renderer/src/graphql/ /app/apps/renderer/src/graphql/
RUN yarn graphql build

COPY backend/config/ /app/backend/config/
RUN yarn workspace @repo/config build

COPY packages/lib/ /app/packages/lib/
RUN yarn workspace @repo/lib build

COPY backend/backend-shared/ /app/backend/backend-shared/
RUN yarn workspace @repo/backend-shared build

COPY packages/base-plugin/ /app/packages/base-plugin/
RUN yarn workspace @repo/base-plugin build

COPY packages/ui/ /app/packages/ui/
RUN yarn workspace @repo/ui build

################################################################################
# Build stage 3 - Build server

FROM builder-core AS builder-server

COPY backend/worker/ /app/backend/worker/
RUN yarn worker build

COPY backend/server/ /app/backend/server/
RUN yarn server build

################################################################################
# Build stage 4 - Build client

FROM builder-core AS builder-client

# Import our shared args
ARG NODE_ENV
ARG ROOT_URL

COPY apps/homepage/ /app/apps/homepage/
RUN yarn homepage codegen && yarn homepage build

COPY apps/remote/ /app/apps/remote/
RUN ls /app/packages/typescript-config
RUN yarn remote build

COPY apps/renderer/ /app/apps/renderer/
RUN yarn renderer build

################################################################################
# Build stage 5 - Build plugin

FROM builder-core AS builder-plugin

COPY plugins/google-slides/ /app/plugins/google-slides/
RUN yarn workspace @repo/plugin-google-slides build

COPY plugins/myworshiplist/ /app/plugins/myworshiplist/
RUN yarn workspace @repo/plugin-myworshiplist build

COPY plugins/simple-image/ /app/plugins/simple-image/
RUN yarn workspace @repo/plugin-simple-image build

COPY plugins/audio-recorder/ /app/plugins/audio-recorder/
RUN yarn workspace @repo/plugin-audio-recorder build

COPY plugins/video-player/ /app/plugins/video-player/
RUN yarn workspace @repo/plugin-video-player build

COPY plugins/radio/ /app/plugins/radio/
RUN yarn workspace @repo/plugin-radio build

################################################################################
# Build stage 6 - Combine deps and build, taking only needed files

FROM node:22-alpine AS clean
# Import our shared args
ARG NODE_ENV
ARG ROOT_URL

# Copy over selectively just the tings we need, try and avoid the rest
COPY --from=deps /app/turbo.json /app/package.json /app/yarn.lock /app/.yarnrc.yml /app/
COPY --from=deps /app/.yarn /app/.yarn/
COPY --from=deps /app/node_modules /app/node_modules/
COPY --from=builder-core /app/packages/graphql/ /app/packages/graphql/
COPY --from=builder-core /app/backend/config/ /app/backend/config/
COPY --from=builder-core /app/packages/lib/ /app/packages/lib/
COPY --from=builder-core /app/backend/backend-shared/ /app/backend/backend-shared/
COPY --from=builder-core /app/packages/base-plugin/ /app/packages/base-plugin/
COPY backend/db/ /app/backend/db/

COPY --from=builder-client /app/apps/remote/package.json /app/apps/remote/
COPY --from=builder-client /app/apps/remote/dist/ /app/apps/remote/dist/
COPY --from=builder-client /app/apps/renderer/package.json /app/apps/renderer/
COPY --from=builder-client /app/apps/renderer/dist/ /app/apps/renderer/dist/
COPY --from=builder-client /app/apps/homepage/package.json /app/apps/homepage/
COPY --from=builder-client /app/apps/homepage/src/next.config.js /app/apps/homepage/src/next.config.js
COPY --from=builder-client /app/apps/homepage/.next /app/apps/homepage/.next

COPY --from=builder-server /app/backend/server/package.json /app/backend/server/
COPY --from=builder-server /app/backend/server/postgraphile.tags.jsonc /app/backend/server/
COPY --from=builder-server /app/backend/server/.env.production /app/backend/server/
COPY --from=builder-server /app/backend/server/dist/ /app/backend/server/dist/
COPY --from=builder-server /app/backend/server/scripts/ /app/backend/server/scripts/
COPY --from=builder-server /app/backend/server/public/ /app/backend/server/public/
COPY --from=builder-server /app/backend/worker/package.json /app/backend/worker/
COPY --from=builder-server /app/backend/worker/crontab /app/backend/worker/
COPY --from=builder-server /app/backend/worker/templates/ /app/backend/worker/templates/
COPY --from=builder-server /app/backend/worker/dist/ /app/backend/worker/dist/

COPY --from=builder-plugin /app/plugins/google-slides/package.json /app/plugins/google-slides/
COPY --from=builder-plugin /app/plugins/google-slides/dist/ /app/plugins/google-slides/dist/
COPY --from=builder-plugin /app/plugins/google-slides/out/ /app/plugins/google-slides/out/
COPY --from=builder-plugin /app/plugins/myworshiplist/package.json /app/plugins/myworshiplist/
COPY --from=builder-plugin /app/plugins/myworshiplist/dist/ /app/plugins/myworshiplist/dist/
COPY --from=builder-plugin /app/plugins/myworshiplist/out/ /app/plugins/myworshiplist/out/
COPY --from=builder-plugin /app/plugins/simple-image/package.json /app/plugins/simple-image/
COPY --from=builder-plugin /app/plugins/simple-image/dist/ /app/plugins/simple-image/dist/
COPY --from=builder-plugin /app/plugins/simple-image/out/ /app/plugins/simple-image/out/
COPY --from=builder-plugin /app/plugins/audio-recorder/package.json /app/plugins/audio-recorder/
COPY --from=builder-plugin /app/plugins/audio-recorder/dist/ /app/plugins/audio-recorder/dist/
COPY --from=builder-plugin /app/plugins/audio-recorder/out/ /app/plugins/audio-recorder/out/
COPY --from=builder-plugin /app/plugins/video-player/package.json /app/plugins/video-player/
COPY --from=builder-plugin /app/plugins/video-player/dist/ /app/plugins/video-player/dist/
COPY --from=builder-plugin /app/plugins/video-player/out/ /app/plugins/video-player/out/
COPY --from=builder-plugin /app/plugins/radio/package.json /app/plugins/radio/
COPY --from=builder-plugin /app/plugins/radio/dist/ /app/plugins/radio/dist/
COPY --from=builder-plugin /app/plugins/radio/out/ /app/plugins/radio/out/

# Shared args shouldn't be overridable at runtime (because they're baked into
# the built JS).
#
# Further, they aren't available in ENTRYPOINT (because it's at runtime), so
# push them to a .env file that we can source from ENTRYPOINT.
RUN echo -e "NODE_ENV=$NODE_ENV\nROOT_URL=$ROOT_URL" > /app/.env

################################################################################
# Build stage FINAL - COPY everything

FROM node:22-alpine

EXPOSE $PORT
WORKDIR /app/

COPY --from=clean /app/ /app/

# Import our shared args
ARG PORT
ARG NODE_ENV
ARG ROOT_URL
ARG TARGET

LABEL description="TheOpenPresenter $TARGET"

# You might want to disable GRAPHILE_TURBO if you have issues
ENV GRAPHILE_TURBO=1 TARGET=$TARGET PORT=$PORT
ENV DATABASE_HOST="pg"
ENV DATABASE_NAME="theopenpresenter_db"
ENV DATABASE_OWNER="${DATABASE_NAME}"
ENV DATABASE_VISITOR="${DATABASE_NAME}_visitor"
ENV DATABASE_AUTHENTICATOR="${DATABASE_NAME}_authenticator"

# Entrypoint last so that we can run `sh` in previous build steps for debugging
ENTRYPOINT [ "sh", "-c", "yarn $TARGET start" ]
