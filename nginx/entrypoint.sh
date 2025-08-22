#!/bin/sh
set -euo pipefail

# Configurable env vars
TLS_CERT_DIR="${TLS_CERT_DIR:-/etc/nginx/certs}"
TLS_DOMAIN="${TLS_DOMAIN:-localhost}"
TLS_CERT_PATH="${TLS_CERT_PATH:-$TLS_CERT_DIR/server.crt}"
TLS_KEY_PATH="${TLS_KEY_PATH:-$TLS_CERT_DIR/server.key}"
TLS_P12_PATH="${TLS_P12_PATH:-$TLS_CERT_DIR/server.p12}"
TLS_P12_PASSWORD="${TLS_P12_PASSWORD:-}" # may be empty for unencrypted P12
MODE="${TLS_MODE:-auto}" # auto|dev|prod
NODE_ENV_LOWER="$(printf '%s' "${NODE_ENV:-}" | tr '[:upper:]' '[:lower:]')"

mkdir -p "$TLS_CERT_DIR"
chmod 755 "$TLS_CERT_DIR"

need_cert_gen() {
  [ ! -f "$TLS_CERT_PATH" ] || [ ! -f "$TLS_KEY_PATH" ]
}

make_dev_cert() {
  echo "[entrypoint] Generating development TLS cert for $TLS_DOMAIN ..."
  tmp_cfg="$TLS_CERT_DIR/openssl-dev.cnf"
  cat >"$tmp_cfg" <<EOF
[req]
default_bits=2048
distinguished_name=req_distinguished_name
req_extensions=req_ext
x509_extensions=req_ext
prompt=no
[req_distinguished_name]
CN=$TLS_DOMAIN
[req_ext]
subjectAltName=@alt_names
extendedKeyUsage=serverAuth
keyUsage=digitalSignature,keyEncipherment
basicConstraints=CA:false
[alt_names]
DNS.1=$TLS_DOMAIN
DNS.2=localhost
IP.1=127.0.0.1
IP.2=::1
EOF
  openssl req -x509 -newkey rsa:2048 -sha256 -days 365 \
    -keyout "$TLS_KEY_PATH" -out "$TLS_CERT_PATH" -nodes \
    -config "$tmp_cfg"
  rm -f "$tmp_cfg"
}

extract_from_p12() {
  echo "[entrypoint] Extracting cert and key from PKCS#12 at $TLS_P12_PATH ..."
  if [ ! -f "$TLS_P12_PATH" ] && [ -n "${SIGNING_CERT_B64:-}" ]; then
    echo "$SIGNING_CERT_B64" | base64 -d > "$TLS_P12_PATH"
    chmod 600 "$TLS_P12_PATH"
  fi
  if [ ! -f "$TLS_P12_PATH" ]; then
    echo "[entrypoint] ERROR: No PKCS#12 found. Provide SIGNING_CERT_B64 or mount $TLS_P12_PATH" >&2
    exit 1
  fi
  # Extract leaf cert
  if [ -n "$TLS_P12_PASSWORD" ]; then
    PASSIN_OPT="-passin env:TLS_P12_PASSWORD"
  else
    PASSIN_OPT="-passin pass:"
  fi
  openssl pkcs12 -in "$TLS_P12_PATH" $PASSIN_OPT -clcerts -nokeys -out "$TLS_CERT_PATH"
  # Extract private key (unencrypted for NGINX)
  openssl pkcs12 -in "$TLS_P12_PATH" $PASSIN_OPT -nocerts -nodes -out "$TLS_KEY_PATH"
  # Optionally append chain
  if openssl pkcs12 -in "$TLS_P12_PATH" $PASSIN_OPT -cacerts -nokeys -out "$TLS_CERT_DIR/chain.crt" 2>/dev/null; then
    cat "$TLS_CERT_PATH" "$TLS_CERT_DIR/chain.crt" > "$TLS_CERT_DIR/server_fullchain.crt" && mv "$TLS_CERT_DIR/server_fullchain.crt" "$TLS_CERT_PATH"
    rm -f "$TLS_CERT_DIR/chain.crt"
  fi
}

print_cert_info() {
  if [ -f "$TLS_CERT_PATH" ]; then
    echo "[entrypoint] Installed certificate subject/issuer:"
    openssl x509 -in "$TLS_CERT_PATH" -noout -subject -issuer -enddate || true
  fi
}

run_nginx() {
  chmod 600 "$TLS_KEY_PATH" || true
  chmod 644 "$TLS_CERT_PATH" || true
  exec nginx -g 'daemon off;'
}

# Decide mode
if [ "$MODE" = "auto" ]; then
  if [ "$NODE_ENV_LOWER" = "production" ] || [ "$NODE_ENV_LOWER" = "prod" ]; then
    MODE="prod"
  else
    MODE="dev"
  fi
fi

echo "[entrypoint] Mode: $MODE (NODE_ENV=${NODE_ENV:-})"

case "$MODE" in
  prod)
    extract_from_p12
    ;;
  dev)
    if need_cert_gen; then
      make_dev_cert
    else
      echo "[entrypoint] Using existing dev cert at $TLS_CERT_PATH"
    fi
    ;;
  *)
    echo "[entrypoint] Unknown TLS_MODE: $MODE" >&2
    exit 1
    ;;
esac

print_cert_info
run_nginx
