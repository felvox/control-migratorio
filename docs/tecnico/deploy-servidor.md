# Despliegue en Servidor (HTTPS + Backup + Acceso Restringido)

Esta guía es para publicar el sistema en un servidor/hosting con seguridad base de producción.

## 1) HTTPS activo (Nginx + Let's Encrypt)

Plantilla incluida:
- `deploy/nginx/control-migratorio.conf`

Definir el dominio público (FQDN) que usará el sistema:

```bash
export FQDN="controlmigratorio.institucion.cl"
```

Pasos:

```bash
sudo apt update
sudo apt install -y nginx certbot python3-certbot-nginx apache2-utils
```

Generar archivo final de Nginx con el dominio real:

```bash
sed "s/__FQDN__/${FQDN}/g" deploy/nginx/control-migratorio.conf | sudo tee /etc/nginx/sites-available/control-migratorio.conf >/dev/null
```

Instalar configuración:

```bash
sudo ln -sf /etc/nginx/sites-available/control-migratorio.conf /etc/nginx/sites-enabled/control-migratorio.conf
sudo nginx -t
sudo systemctl reload nginx
```

Emitir certificado SSL:

```bash
sudo certbot --nginx -d "$FQDN"
```

## 2) Backup diario (BD + storage)

Scripts incluidos:
- `deploy/backup/backup_bd_storage.sh`
- `deploy/backup/instalar_cron_backup.sh`
- `deploy/backup/backup.env.example`

Dependencia para respaldar PostgreSQL:

```bash
sudo apt install -y postgresql-client
```

Configurar:

```bash
cp deploy/backup/backup.env.example deploy/backup/backup.env
nano deploy/backup/backup.env
chmod +x deploy/backup/backup_bd_storage.sh deploy/backup/instalar_cron_backup.sh
```

Probar backup manual:

```bash
./deploy/backup/backup_bd_storage.sh ./deploy/backup/backup.env
```

Instalar ejecución diaria a las 02:00:

```bash
./deploy/backup/instalar_cron_backup.sh
```

## 3) Restringir acceso (IP o credenciales fuertes)

### Opción A: Restringir por IP (Nginx)

Archivo incluido:
- `deploy/nginx/control-migratorio-allowlist.conf`

Pasos:

```bash
sudo cp deploy/nginx/control-migratorio-allowlist.conf /etc/nginx/snippets/control-migratorio-allowlist.conf
sudo nano /etc/nginx/snippets/control-migratorio-allowlist.conf
```

Editar IPs permitidas (`allow ...;`) y dejar `deny all;`.

Luego descomentar esta línea en `control-migratorio.conf`:

```nginx
include /etc/nginx/snippets/control-migratorio-allowlist.conf;
```

Aplicar:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

### Opción B: Credenciales fuertes en acceso web (Basic Auth)

Crear usuario de acceso:

```bash
sudo htpasswd -c /etc/nginx/.htpasswd-control-migratorio admin-acceso
```

Descomentar en `control-migratorio.conf`:

```nginx
auth_basic "Acceso restringido - Control Migratorio";
auth_basic_user_file /etc/nginx/.htpasswd-control-migratorio;
```

Aplicar:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

## 4) Refuerzo a nivel backend (opcional)

El backend ahora soporta:
- `CORS_ORIGIN` (orígenes permitidos, separados por coma)
- `ALLOWED_IPS` (IPs permitidas para API, separadas por coma)

Ejemplo en `backend/.env`:

```env
CORS_ORIGIN="https://controlmigratorio.institucion.cl"
ALLOWED_IPS="181.12.34.56,190.98.12.44"
```

Además, la política de contraseña fue endurecida para creación y reseteo de usuarios:
- mínimo 10 caracteres
- mayúscula
- minúscula
- número
- símbolo
