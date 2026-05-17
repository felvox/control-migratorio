# Deploy en Render

Guía base del despliegue actualmente operativo.

## Servicios creados

1. `control-migratorio-db` (PostgreSQL)
2. `control-migratorio-backend` (Web Service, Node, raíz `backend`)
3. `control-migratorio-frontend` (Static Site, raíz `frontend`)

## URLs de producción

- Frontend: `https://control-migratorio-frontend.onrender.com`
- API: `https://control-migratorio-backend.onrender.com/api`

## Variables del backend

Definidas en Render (`control-migratorio-backend`):

- `DATABASE_URL`
- `JWT_SECRET`
- `JWT_EXPIRES_IN`
- `MAX_UPLOAD_SIZE_MB`
- `NODE_ENV=production`

## Configuración de build

### Backend

- Runtime: Node
- Root Directory: `backend`
- Build Command: `yarn && yarn build`
- Start Command: `yarn start:prod`
- Auto Deploy: `On Commit`

### Frontend

- Tipo: Static Site
- Root Directory: `frontend`
- Build Command: `yarn && yarn build`
- Publish Directory: `dist/frontend/browser`
- Auto Deploy: `On Commit`

## Operación

- Cada `git push origin main` dispara deploy automático.
- Si el backend queda inactivo en plan Free, Render lo reactiva al primer request.
- Respaldar periódicamente:
  1. Base de datos PostgreSQL (`pg_dump`)
  2. Carpeta `storage/` (evidencias y documentos)
