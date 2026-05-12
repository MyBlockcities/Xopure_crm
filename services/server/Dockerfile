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
# NOTE: Railway uses the Dockerfile's directory (services/server) as the build
# context — paths below are relative to that, not the repo root.
USER root
COPY branding/index.html     /app/packages/twenty-server/dist/front/index.html
COPY branding/manifest.json  /app/packages/twenty-server/dist/front/manifest.json
COPY branding/icons/android/ /app/packages/twenty-server/dist/front/icons/android/
COPY branding/icons/ios/     /app/packages/twenty-server/dist/front/icons/ios/
RUN chown -R node:node /app/packages/twenty-server/dist/front
USER node

# Railway expects services to listen on $PORT. Twenty respects NODE_PORT.
# The live crm.xopure.com domain is currently mapped to port 8080, so set
# NODE_PORT=8080 and PORT=8080 on the Railway web service.

EXPOSE 8080
