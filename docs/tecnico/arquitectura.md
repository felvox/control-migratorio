# Arquitectura del sistema

## Stack

- Frontend: Angular + TypeScript
- Backend: NestJS + TypeScript
- Base de datos: PostgreSQL
- ORM: Prisma
- Autenticación: JWT + roles
- Almacenamiento de archivos: `storage/` (privado)

## Despliegue productivo

- `control-migratorio-frontend` en Render Static Site
- `control-migratorio-backend` en Render Web Service
- `control-migratorio-db` en Render PostgreSQL

## Dominio funcional

El núcleo del sistema es `Caso`.

Relaciones:

- Un `Caso` tiene una o más `Persona`
- Una `Persona` pertenece a un `Caso`
- Un `Caso` tiene `Evidencia` general y por persona
- Un `Caso` tiene `DocumentoGenerado` (acta PDF)
- Las acciones relevantes generan `Auditoria`

## Módulos backend

- `auth`
- `usuarios`
- `casos`
- `evidencias`
- `documentos`
- `dashboard`
- `reportes`
- `auditoria`

## Features frontend

- `auth`
- `dashboard`
- `usuarios`
- `casos`
- `reportes`
- `auditoria`
- `consulta`

## Seguridad

- Rutas protegidas por JWT
- Control por roles: `ADMINISTRADOR`, `OPERADOR`, `CONSULTA`, `AUDITOR`
- Contraseñas con hash (`bcryptjs`)
- Descarga de evidencias/documentos solo vía backend autenticado
