# Sistema Web de Control Migratorio

Sistema institucional para registro, consulta y trazabilidad de actas de control migratorio.

## Producción

- Frontend: `https://control-migratorio-frontend.onrender.com`
- API backend: `https://control-migratorio-backend.onrender.com/api`
- Infraestructura: Render (`Static Site` + `Web Service` + `PostgreSQL`)

## Base tecnológica

- Frontend: Angular + TypeScript
- Backend: NestJS + TypeScript
- Base de datos: PostgreSQL + Prisma
- Archivos privados: carpeta `storage/`
- Seguridad: JWT con control de roles

## Documentación técnica

- Deploy en Render: [docs/tecnico/deploy-servidor.md](docs/tecnico/deploy-servidor.md)
- Arquitectura del sistema: [docs/tecnico/arquitectura.md](docs/tecnico/arquitectura.md)
- Endpoints REST: [docs/tecnico/endpoints.md](docs/tecnico/endpoints.md)
