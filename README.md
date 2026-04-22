# Sistema Web de Control Migratorio

MVP profesional para digitalizar el Acta de Control Migratorio con Angular + NestJS + PostgreSQL + Prisma.

## Estructura

```text
control-migratorio/
  frontend/      # Angular
  backend/       # NestJS
  storage/       # Archivos privados (evidencias y documentos)
  docs/          # Documentación mínima
  docker-compose.yml
```

## Requisitos
- Node.js 20+
- npm 10+
- Docker Desktop

## Comando automático (recomendado)

Desde la raíz del proyecto:

```bash
./levantar_sistema.sh
```

O en macOS (doble clic):

```bash
./levantar_sistema.command
```

Este comando hace todo automáticamente:
- levanta PostgreSQL con Docker
- instala dependencias faltantes
- ejecuta `prisma generate`, migraciones (`prisma deploy`) y seed
- levanta backend y frontend
- abre Google Chrome en `http://localhost:4200`

## 1) Levantar PostgreSQL

```bash
docker compose up -d
```

## 2) Backend

```bash
cd backend
cp .env.example .env
npm install
npm run prisma:generate
npm run prisma:deploy
npm run prisma:seed
npm run start:dev
```

Backend disponible en:
- `http://localhost:3000/api`

## 3) Frontend

```bash
cd frontend
npm install
npm start
```

Frontend disponible en:
- `http://localhost:4200`

## Usuarios seed
Usuarios base:
- `11111111-1` / `admin@controlmigratorio.local` (ADMINISTRADOR)
- `22222222-2` / `operador@controlmigratorio.local` (OPERADOR)
- `33333333-3` / `consulta@controlmigratorio.local` (CONSULTA)
- `17.754.725-5` (ADMINISTRADOR)

Claves seed:
- `11111111-1`, `22222222-2`, `33333333-3` -> `ChangeMe123!`
- `17.754.725-5` -> `Admin123*`

## Flujo de negocio implementado
- Caso con menores involucrados: derivación inicial a `CARABINEROS` y estado `DERIVADO_CARABINEROS`.
- Caso sin menores: derivación a `PDI` y estado `DERIVADO_PDI`.

## Storage privado
Los archivos no se exponen por URL pública:
- Se guardan físicamente en `storage/casos/...`
- Solo se descargan por endpoints autenticados
- BD guarda metadatos y ruta

## Scripts útiles backend
- `npm run start:dev`
- `npm run build`
- `npm run prisma:generate`
- `npm run prisma:deploy`
- `npm run prisma:seed`

## Scripts útiles frontend
- `npm start`
- `npm run build`

## Estado actual del MVP
Incluye:
- autenticación JWT con roles
- gestión de usuarios (admin)
- creación/edición/listado/detalle de casos
- personas asociadas al caso
- carga y descarga de evidencias (jpg, jpeg, png, pdf)
- generación de acta PDF por caso
- dashboard administrador
- exportación de reportes en Excel y PDF
- auditoría de acciones sensibles
- vistas frontend funcionales y responsive
