#!/usr/bin/env bash
set -euo pipefail

# Deploy the XO Pure Hetzner observability stack from repo-owned config.
# Run on the Hetzner host as root. The stack is intentionally host-networked,
# but every service config binds either localhost or the Hetzner Tailscale IP.

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "${SCRIPT_DIR}/../.." && pwd)"
SRC="${REPO_ROOT}/services/observability"
DEST="${OBS_STACK_DIR:-/opt/grafana-stack}"

copy_config() {
  local source_path="$1"
  local dest_path="$2"
  install -d -m 0755 "$(dirname -- "${dest_path}")"
  cp -f "${source_path}" "${dest_path}"
}

run_container() {
  local name="$1"
  shift
  podman rm -f "${name}" >/dev/null 2>&1 || true
  podman run -d --name "${name}" --restart unless-stopped --network host "$@"
}

prepare_tempo_storage() {
  podman volume create tempo-data >/dev/null
  podman run --rm --user 0 \
    -v tempo-data:/var/tempo:Z \
    docker.io/library/busybox:latest \
    sh -c 'mkdir -p /var/tempo/traces /var/tempo/wal /var/tempo/generator/wal && chown -R 10001:10001 /var/tempo'
}

copy_config "${SRC}/alloy/config.alloy" "${DEST}/alloy/config.alloy"
copy_config "${SRC}/loki/loki-config.yaml" "${DEST}/loki/loki-config.yaml"
copy_config "${SRC}/prometheus/prometheus.yml" "${DEST}/prometheus/prometheus.yml"
copy_config "${SRC}/tempo/tempo-config.yaml" "${DEST}/tempo/tempo-config.yaml"
copy_config "${SRC}/grafana/grafana.ini" "${DEST}/grafana/grafana.ini"
copy_config "${SRC}/grafana/provisioning/datasources/datasources.yaml" "${DEST}/grafana/datasources.yaml"

prepare_tempo_storage

run_container loki \
  --memory 1g \
  -v "${DEST}/loki/loki-config.yaml:/etc/loki/loki-config.yaml:Z" \
  -v loki-data:/loki:Z \
  docker.io/grafana/loki:latest \
  -config.file=/etc/loki/loki-config.yaml

run_container prometheus \
  --memory 1g \
  -v "${DEST}/prometheus/prometheus.yml:/etc/prometheus/prometheus.yml:Z" \
  -v prometheus-data:/prometheus:Z \
  docker.io/prom/prometheus:latest \
  --config.file=/etc/prometheus/prometheus.yml \
  --storage.tsdb.path=/prometheus \
  --web.enable-remote-write-receiver \
  --web.listen-address=127.0.0.1:9090

run_container tempo \
  --memory 1g \
  -v "${DEST}/tempo/tempo-config.yaml:/etc/tempo/tempo-config.yaml:Z" \
  -v tempo-data:/var/tempo:Z \
  docker.io/grafana/tempo:latest \
  -config.file=/etc/tempo/tempo-config.yaml

run_container alloy \
  --memory 512m \
  -v "${DEST}/alloy/config.alloy:/etc/alloy/config.alloy:Z" \
  -v alloy-data:/var/lib/alloy:Z \
  docker.io/grafana/alloy:latest \
  run \
  --server.http.listen-addr=127.0.0.1:12345 \
  --storage.path=/var/lib/alloy \
  /etc/alloy/config.alloy

run_container grafana \
  --memory 512m \
  -v "${DEST}/grafana/datasources.yaml:/etc/grafana/provisioning/datasources/datasources.yaml:Z" \
  -v "${DEST}/grafana/grafana.ini:/etc/grafana/grafana.ini:Z" \
  -v grafana-data:/var/lib/grafana:Z \
  -e GF_SERVER_HTTP_ADDR=127.0.0.1 \
  -e GF_SERVER_HTTP_PORT=3333 \
  -e GF_AUTH_ANONYMOUS_ENABLED=false \
  docker.io/grafana/grafana:latest

podman ps --filter name=alloy --filter name=loki --filter name=prometheus --filter name=tempo --filter name=grafana
