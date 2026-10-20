#!/bin/sh
set -eu

conf=/etc/nginx/conf.d/default.conf
sed -i "s/listen 80;/listen ${PORT:-80};/" "$conf"

# Só o docker compose define API_UPSTREAM. No EasyPanel o browser chama VITE_API_URL.
if [ -n "${API_UPSTREAM:-}" ]; then
  proxy_block="    location /api/ {
        proxy_pass ${API_UPSTREAM};
        proxy_read_timeout 120s;
        proxy_set_header Host \$host;
    }
"
  awk -v block="$proxy_block" '
    index($0, "location / {") && !inserted {
      printf "%s\n", block
      inserted = 1
    }
    { print }
  ' "$conf" > "${conf}.tmp"
  mv "${conf}.tmp" "$conf"
fi

exec nginx -g "daemon off;"
