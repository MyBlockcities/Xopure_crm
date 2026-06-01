# services/server/Dockerfile
#
# XO Pure CRM — Main web/server service (custom build)
#
# =============================================================================
# RAILWAY CONFIGURATION REQUIREMENTS (IMPORTANT)
# =============================================================================
# For this Dockerfile to work correctly and actually build your custom
# twenty-front code (dashboards, MainDashboardRedirect, templates, widgets, etc.):
#
# 1. In the Railway dashboard, the **web/server service** must have:
#    - Root Directory = `/`   (repository root)
#    - Dockerfile path        = `services/server/Dockerfile` (relative to root)
#
# 2. The worker service should normally stay pointed at the pure upstream image
#    (or a very similar lightweight one) for consistency.
#
# 3. You will need to set any required VITE_* / build environment variables
#    in the Railway service settings (e.g. VITE_API_URL, feature flags, etc.).
#
# If the Root Directory is still set to `services/server`, Railway will not
# have access to the rest of the monorepo and the build will fail or fall back
# to the old branding-only behavior.
#
# Builder image: node:22-bookworm-slim (chosen for reliable native module builds
# such as canvas). Runtime remains the official twentycrm/twenty:v0.32.0 image.
# =============================================================================

# -----------------------------------------------------------------------------
# Builder stage — full monorepo context, builds custom frontend
# -----------------------------------------------------------------------------
# WHY node:22-bookworm-slim (not Alpine + Node 24):
# - Alpine is extremely minimal and frequently fails to build native Node modules
#   such as canvas@3.x (a transitive dependency pulled in by charting, testing,
#   PDF, and jsdom-related packages in the Twenty ecosystem).
# - canvas requires Cairo, Pango, JPEG, GIF, SVG, pixman, etc. at compile time.
# - Node 24 is still young for many heavy monorepos; Node 22 LTS is the current
#   stable, well-tested choice for Twenty-style builds.
#
# This combination (Debian bookworm + Node 22) gives the highest success rate
# on Railway / CI while still producing a reasonably small builder layer.
# -----------------------------------------------------------------------------
FROM node:22-bookworm-slim AS builder

WORKDIR /app

# Install native build dependencies required by canvas and similar packages.
# These must be present BEFORE `yarn install --immutable` so that optional
# native modules can compile successfully.
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg-dev \
    libgif-dev \
    librsvg2-dev \
    libpixman-1-dev \
    pkg-config \
  && rm -rf /var/lib/apt/lists/*

# Copy the entire monorepo (needed for Nx workspace + yarn workspaces)
COPY . .

# Use Yarn 4 (berry) with immutable install for reproducible builds.
# This is where canvas (and other native deps) will attempt to build.
RUN corepack enable && yarn install --immutable

# Build order matters: shared must come before front.
RUN npx nx build twenty-shared
RUN npx nx build twenty-front --configuration=production

# -----------------------------------------------------------------------------
# Runtime stage — based on the official pinned Twenty image
# -----------------------------------------------------------------------------
# Pin to an exact upstream tag. Check https://github.com/twentyhq/twenty/releases
# NEVER use `latest`.
#
# CRITICAL: services/server and services/worker MUST use the exact same tag.
FROM twentycrm/twenty:v0.32.0

# Copy the freshly built custom frontend dist over the stock one.
# The upstream image serves the frontend from this location.
COPY --from=builder /app/packages/twenty-front/dist /app/packages/twenty-server/dist/front

# Apply XO Pure branding on top of the custom build (favicons, manifest, title, etc.)
USER root
COPY services/server/branding/index.html     /app/packages/twenty-server/dist/front/index.html
COPY services/server/branding/manifest.json  /app/packages/twenty-server/dist/front/manifest.json
COPY services/server/branding/icons/android/ /app/packages/twenty-server/dist/front/icons/android/
COPY services/server/branding/icons/ios/     /app/packages/twenty-server/dist/front/icons/ios/
RUN chown -R node:node /app/packages/twenty-server/dist/front
USER node

# Railway expects the service to listen on $PORT.
# Twenty respects NODE_PORT.
ENV NODE_PORT=8080
ENV PORT=8080

EXPOSE 8080

# The upstream image already has the correct CMD / entrypoint for the server.
# Do not override it unless you have a very specific reason.
