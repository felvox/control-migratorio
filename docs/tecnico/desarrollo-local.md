# Desarrollo local

Guía opcional para ejecutar el sistema en ambiente local.

## Requisitos

- Node.js 20+
- npm 10+
- Docker

## Levantar rápido

```bash
./levantar_sistema.sh
```

## Levantar manual

1. Base de datos:

```bash
docker compose up -d
```

2. Backend:

```bash
cd backend
cp .env.example .env
npm install
npm run prisma:generate
npm run prisma:deploy
npm run prisma:seed
npm run start:dev
```

3. Frontend:

```bash
cd frontend
npm install
npm start
```

## URLs locales

- Frontend: `http://localhost:4200/login`
- Backend API: `http://localhost:3000/api`
