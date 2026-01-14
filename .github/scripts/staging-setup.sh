#!/bin/bash
set -e

# Staging environment setup script for sprites.dev
# This script is executed inside the sprite container to set up the staging environment

# Arguments:
# $1 - IMAGE_TAG (e.g., pr-123)
# $2 - SPRITE_URL (e.g., https://xxx.sprites.dev)
# $3 - DEPLOYMENT_TIMESTAMP (ISO 8601 format)

IMAGE_TAG="${1:-main}"
SPRITE_URL="${2:-http://localhost:5678}"
DEPLOYMENT_TIMESTAMP="${3:-$(date -u +%Y-%m-%dT%H:%M:%SZ)}"

echo "=== Setting up staging environment ==="
echo "Image Tag: ${IMAGE_TAG}"
echo "Sprite URL: ${SPRITE_URL}"
echo "Deployment Timestamp: ${DEPLOYMENT_TIMESTAMP}"

# Install Docker if not present
if ! command -v docker &> /dev/null; then
    echo "Installing Docker..."
    sudo apt-get update
    sudo apt-get install -y docker.io
fi

# Start Docker as a Sprite service (Sprite environments don't use systemd)
echo "Starting Docker as Sprite service..."
sprite-env services create docker --cmd /usr/bin/sudo --args /usr/bin/dockerd 2>/dev/null || true

# Wait for Docker to be ready
echo "Waiting for Docker to start..."
for i in {1..10}; do
    if sudo docker info &>/dev/null; then
        echo "Docker is ready!"
        break
    fi
    echo "Waiting for Docker... ($i/10)"
    sleep 2
done

# Create docker network
echo "Creating docker network..."
sudo docker network create staging-network 2>/dev/null || true

# Pull images
echo "Pulling images..."
sudo docker pull ghcr.io/vija02/theopenpresenter_server:${IMAGE_TAG}
sudo docker pull ghcr.io/vija02/theopenpresenter_db:main
sudo docker pull redis:7.4-alpine
sudo docker pull grafana/alloy:v1.5.1
sudo docker pull philiplehmann/unoserver:3.0.1-1816

# Stop and remove existing containers
echo "Cleaning up existing containers..."
sudo docker stop theopenpresenter_server theopenpresenter_worker theopenpresenter_db theopenpresenter_redis theopenpresenter_alloy theopenpresenter_unoserver 2>/dev/null || true
sudo docker rm theopenpresenter_server theopenpresenter_worker theopenpresenter_db theopenpresenter_redis theopenpresenter_alloy theopenpresenter_unoserver 2>/dev/null || true

# Remove old volumes to ensure clean state
echo "Cleaning up old volumes..."
sudo docker volume rm theopenpresenter-pg-volume theopenpresenter-redis-volume 2>/dev/null || true

# Create volumes
echo "Creating volumes..."
sudo docker volume create theopenpresenter-pg-volume
sudo docker volume create theopenpresenter-redis-volume

# Start PostgreSQL
echo "Starting PostgreSQL..."
sudo docker run -d \
    --name theopenpresenter_db \
    --network staging-network \
    -e POSTGRES_PASSWORD=stagingpassword \
    -v theopenpresenter-pg-volume:/var/lib/postgresql/data \
    ghcr.io/vija02/theopenpresenter_db:main \
    postgres -c logging_collector=on -c log_destination=stderr

# Wait for PostgreSQL to be ready
echo "Waiting for PostgreSQL..."
sleep 10
for i in {1..30}; do
    if sudo docker exec theopenpresenter_db pg_isready -U postgres; then
        echo "PostgreSQL is ready!"
        break
    fi
    echo "Waiting for PostgreSQL... ($i/30)"
    sleep 2
done

# Start Redis
echo "Starting Redis..."
sudo docker run -d \
    --name theopenpresenter_redis \
    --network staging-network \
    -v theopenpresenter-redis-volume:/data \
    redis:7.4-alpine \
    redis-server --save 60 1 --loglevel warning

# Start Unoserver
echo "Starting Unoserver..."
sudo docker run -d \
    --name theopenpresenter_unoserver \
    --network staging-network \
    philiplehmann/unoserver:3.0.1-1816

# Start Alloy (minimal config for staging)
echo "Starting Alloy..."
mkdir -p /tmp/alloy
cat > /tmp/alloy/config.alloy << 'ALLOY_CONFIG'
logging {
    level = "info"
}
ALLOY_CONFIG

sudo docker run -d \
    --name theopenpresenter_alloy \
    --network staging-network \
    -v /tmp/alloy:/etc/alloy \
    grafana/alloy:v1.5.1 \
    run /etc/alloy/config.alloy \
    --storage.path=/var/lib/alloy/data \
    --server.http.listen-addr=0.0.0.0:12345 \
    --stability.level=experimental

# Start the main server
echo "Starting TheOpenPresenter server..."
sudo docker run -d \
    --name theopenpresenter_server \
    --network staging-network \
    -p 5678:5678 \
    -e NODE_ENV=production \
    -e ROOT_DATABASE_URL=postgres://postgres:stagingpassword@theopenpresenter_db/template1 \
    -e REDIS_URL=redis://theopenpresenter_redis:6379 \
    -e DATABASE_HOST=theopenpresenter_db \
    -e DATABASE_NAME=theopenpresenter_staging \
    -e DATABASE_OWNER=theopenpresenter_staging \
    -e DATABASE_OWNER_PASSWORD=stagingsecret1 \
    -e DATABASE_AUTHENTICATOR=theopenpresenter_staging_authenticator \
    -e DATABASE_AUTHENTICATOR_PASSWORD=stagingsecret2 \
    -e DATABASE_VISITOR=theopenpresenter_staging_visitor \
    -e SECRET=stagingsecret3 \
    -e JWT_SECRET=stagingsecret4 \
    -e PORT=5678 \
    -e ROOT_URL=${SPRITE_URL} \
    -e STORAGE_TYPE=file \
    -e STORAGE_PROXY=local \
    -e ENABLED_PLUGINS=lyrics-presenter,simple-image,google-slides,radio,audio-recorder,video-player,worship-pads,embed,timer \
    -e PLUGIN_GOOGLE_SLIDES_UNOCONVERT_SERVER=http://theopenpresenter_unoserver:3000 \
    -e OTLP_HOST=http://theopenpresenter_alloy:4318 \
    -e DISABLE_HSTS=1 \
    ghcr.io/vija02/theopenpresenter_server:${IMAGE_TAG}

# Start the worker
echo "Starting TheOpenPresenter worker..."
sudo docker run -d \
    --name theopenpresenter_worker \
    --network staging-network \
    -e NODE_ENV=production \
    -e ROOT_DATABASE_URL=postgres://postgres:stagingpassword@theopenpresenter_db/template1 \
    -e DATABASE_HOST=theopenpresenter_db \
    -e DATABASE_NAME=theopenpresenter_staging \
    -e DATABASE_OWNER=theopenpresenter_staging \
    -e DATABASE_OWNER_PASSWORD=stagingsecret1 \
    -e DATABASE_AUTHENTICATOR=theopenpresenter_staging_authenticator \
    -e DATABASE_AUTHENTICATOR_PASSWORD=stagingsecret2 \
    -e DATABASE_VISITOR=theopenpresenter_staging_visitor \
    -e SECRET=stagingsecret3 \
    -e JWT_SECRET=stagingsecret4 \
    -e PORT=5678 \
    -e ROOT_URL=${SPRITE_URL} \
    -e STORAGE_TYPE=file \
    -e STORAGE_PROXY=local \
    -e ENABLED_PLUGINS=lyrics-presenter,simple-image,google-slides,radio,audio-recorder,video-player,worship-pads,embed,timer \
    -e TARGET=worker \
    -e OTLP_HOST=http://theopenpresenter_alloy:4318 \
    ghcr.io/vija02/theopenpresenter_server:${IMAGE_TAG}

# Store deployment timestamp for expiration tracking
echo "${DEPLOYMENT_TIMESTAMP}" > /tmp/deployment_timestamp

# Create a checkpoint to preserve the Docker setup across reboots
echo "Creating checkpoint..."
sprite-env checkpoints create 2>/dev/null || true

echo "=== Setup complete ==="
echo "Waiting for services to start..."
sleep 15

# Check if server is running
echo "=== Container status ==="
sudo docker ps

echo "=== Server logs ==="
sudo docker logs theopenpresenter_server --tail 50 2>&1 || true

echo "=== Staging environment is ready ==="
echo "URL: ${SPRITE_URL}"
