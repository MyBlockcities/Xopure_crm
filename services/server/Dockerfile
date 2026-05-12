# services/server/Dockerfile
#
# XO Pure CRM — server (web) service, built on Twenty.
#
# Pin to an exact upstream tag. Check https://github.com/twentyhq/twenty/releases
# for the current stable version before changing this. NEVER use `latest`.
#
# IMPORTANT: services/server and services/worker MUST use the same tag.

FROM twentycrm/twenty:v0.32.0

# Overlay XO Pure branding on top of the upstream frontend dist.
# Replaces favicon/icons, manifest, and page title without rebuilding twenty-front.
# NOTE: Railway's build context is determined by the service's Root Directory
# setting in the dashboard. This Dockerfile assumes Root Directory = "/" (repo
# root). If the dashboard ever sets a different Root Directory, these paths
# must be adjusted to match.
USER root
COPY services/server/branding/index.html     /app/packages/twenty-server/dist/front/index.html
COPY services/server/branding/manifest.json  /app/packages/twenty-server/dist/front/manifest.json
COPY services/server/branding/icons/android/ /app/packages/twenty-server/dist/front/icons/android/
COPY services/server/branding/icons/ios/     /app/packages/twenty-server/dist/front/icons/ios/
RUN chown -R node:node /app/packages/twenty-server/dist/front
USER node

# Railway expects services to listen on $PORT. Twenty respects NODE_PORT.
# The live crm.xopure.com domain is currently mapped to port 8080, so set
# NODE_PORT=8080 and PORT=8080 on the Railway web service.

EXPOSE 8080
