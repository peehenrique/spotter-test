PY=.venv/bin/python

.PHONY: test backend frontend

test:
	cd backend && ../$(PY) manage.py test

backend:
	cd backend && ../$(PY) manage.py runserver 127.0.0.1:8000

frontend:
	cd frontend && npm run dev
