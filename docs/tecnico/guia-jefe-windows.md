# Guía de Revisión para Jefe de Proyecto (Windows)

Esta guía está pensada para levantar el sistema completo en un computador Windows, sin depender del Mac del desarrollador.

## Punto clave

No necesitas que el Mac esté encendido.  
El sistema se ejecuta localmente en tu propio computador Windows.

## 1) Requisitos previos (instalar una sola vez)

- Git
- Node.js 20+ (incluye npm)
- Docker Desktop (con Docker Compose habilitado)

Verificación rápida en PowerShell:

```powershell
git --version
node -v
npm -v
docker --version
docker compose version
```

## 2) Descargar el proyecto

```powershell
git clone https://github.com/felvox/control-migratorio.git
cd control-migratorio
```

## 3) Levantar todo automáticamente (recomendado)

Desde PowerShell en la raíz del proyecto:

```powershell
.\levantar_sistema.ps1
```

Alternativa doble clic:

- `levantar_sistema_windows.bat`

Este script:

- levanta PostgreSQL
- instala dependencias si faltan
- ejecuta Prisma (`generate`, `deploy`, `seed`)
- carga casos demo para revisión
- levanta backend y frontend
- abre navegador en `http://127.0.0.1:4200/login`

## 4) Credenciales de ingreso

- Usuario (RUN): `15.960.680-5`
- Clave: `Admin123*`

## 5) Detener el sistema

```powershell
.\detener_sistema.ps1
```

Alternativa doble clic:

- `detener_sistema_windows.bat`

## 6) Si Windows bloquea el script por seguridad

Ejecutar en PowerShell (solo para la sesión actual):

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\levantar_sistema.ps1
```

## 7) Si algo falla, revisar logs

```powershell
Get-Content .\logs\backend.log -Tail 120
Get-Content .\logs\frontend.log -Tail 120
```

