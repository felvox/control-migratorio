# Endpoints principales

Base URL: `http://localhost:3000/api`

## Auth
- `POST /auth/login`
- `POST /auth/logout`
- `GET /auth/me`

## Usuarios (ADMINISTRADOR)
- `POST /usuarios`
- `GET /usuarios`
- `GET /usuarios/:id`
- `PATCH /usuarios/:id`
- `PATCH /usuarios/:id/desactivar`
- `PATCH /usuarios/:id/reset-password`
- `DELETE /usuarios/:id`

## Casos
- `POST /casos` (ADMINISTRADOR, OPERADOR)
- `GET /casos`
- `GET /casos/:id`
- `PATCH /casos/:id` (ADMINISTRADOR, OPERADOR)
- `PATCH /casos/:id/estado` (ADMINISTRADOR, OPERADOR)

## Evidencias
- `POST /casos/:casoId/evidencias` (ADMINISTRADOR, OPERADOR)
- `GET /casos/:casoId/evidencias`
- `GET /evidencias/:id/download`

## Documentos
- `POST /casos/:id/documentos/pdf` (ADMINISTRADOR, OPERADOR)
- `GET /casos/:id/documentos`
- `GET /documentos/:id/download`

## Dashboard
- `GET /dashboard/resumen` (ADMINISTRADOR)

## Reportes
- `GET /reportes/casos/excel` (ADMINISTRADOR)
- `GET /reportes/casos/pdf` (ADMINISTRADOR)

## Auditoría
- `GET /auditoria` (ADMINISTRADOR)
