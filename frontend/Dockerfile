# Frontend Dockerfile
# O contexto do build é a RAIZ do repositório.
# No Easypanel, configure:
# - Dockerfile Path: frontend/Dockerfile
# - Build Context: . (raiz do projeto)
# - Porta do serviço: 80
#
# Variável de build (defina no Easypanel no momento do build):
# - VITE_API_URL = URL pública do backend, sem barra no final
#   ex: https://api.seudominio.com
# O nginx só serve os arquivos estáticos. Ele não procura o host "backend".

FROM node:22-alpine AS build

WORKDIR /app

COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/ ./

ARG VITE_API_URL=
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build

FROM nginx:1.27-alpine

COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY frontend/docker-entrypoint.sh /spotter-entrypoint.sh
RUN chmod +x /spotter-entrypoint.sh
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["/spotter-entrypoint.sh"]
