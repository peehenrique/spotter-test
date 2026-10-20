# Backend Dockerfile
# O contexto do build é a RAIZ do repositório.
# No Easypanel, configure:
# - Dockerfile Path: backend/Dockerfile
# - Build Context: . (raiz do projeto)
# - Porta do serviço: 80 (ou a mesma porta definida em PORT)
#
# Variáveis (configure no Easypanel):
# - DJANGO_SECRET_KEY
# - DJANGO_DEBUG=0
# - DJANGO_ALLOWED_HOSTS = host público do backend (ou *)
# - CORS_ALLOWED_ORIGINS = URL pública do frontend (ex: https://rotas.seudominio.com)

FROM python:3.11-slim

WORKDIR /app

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ .

ENV DJANGO_DEBUG=0
ENV PYTHONUNBUFFERED=1

EXPOSE 80

CMD ["sh", "-c", "gunicorn config.wsgi:application --bind 0.0.0.0:${PORT:-80} --workers 2 --timeout 120"]
