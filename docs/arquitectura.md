# Arquitectura base

## Stack
- Frontend: Angular 18 + TypeScript
- Backend: NestJS 10 + TypeScript
- Base de datos: PostgreSQL
- ORM: Prisma
- Autenticación: JWT + roles
- Archivos: storage privado en disco

## Núcleo de negocio
El sistema gira en torno a `Caso`.

Relaciones implementadas:
- Un caso tiene múltiples personas.
- Un caso tiene evidencias generales y evidencias por persona.
- Un caso tiene documentos generados (PDF acta).
- Las acciones relevantes generan auditoría.

## Seguridad
- JWT obligatorio para rutas privadas.
- Guard por roles en backend y frontend.
- Hash de contraseñas con `bcryptjs`.
- Acceso a archivos solo por endpoints autenticados.

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
