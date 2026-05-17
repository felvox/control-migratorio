# Sistema Web de Control Migratorio

Sistema web para digitalizar el Acta de Control Migratorio con Angular, NestJS, PostgreSQL y Prisma.

## Arquitectura

- Frontend: Angular + TypeScript
- Backend: NestJS + TypeScript
- Base de datos: PostgreSQL + Prisma
- Archivos privados: `storage/` (evidencias y documentos)

## Acceso del sistema

URL de producción:
- definida por el DNS institucional configurado para este servicio

Acceso inicial (después de seed):
- Usuario: `15.960.680-5`
- Clave: `Admin123*`
- Rol: `ADMINISTRADOR`

## Seguridad y operación

- HTTPS obligatorio con proxy reverso
- Backup diario de base de datos + `storage`
- Restricción de acceso por IP y/o credenciales fuertes
- JWT con secreto robusto en entorno productivo

## Documentación

- Deploy en servidor (HTTPS, backup, control de acceso): [docs/tecnico/deploy-servidor.md](docs/tecnico/deploy-servidor.md)
- Arquitectura del sistema: [docs/tecnico/arquitectura.md](docs/tecnico/arquitectura.md)
- Endpoints REST: [docs/tecnico/endpoints.md](docs/tecnico/endpoints.md)
