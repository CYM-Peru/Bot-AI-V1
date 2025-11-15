# Guía de Instalación en Raspberry Pi 5

## Requisitos Previos

### Hardware
- Raspberry Pi 5 (8GB RAM recomendado, mínimo 4GB)
- MicroSD de 64GB+ (Clase 10 o superior)
- Fuente de alimentación oficial de Raspberry Pi 5
- Conexión a Internet (Ethernet recomendado)

### Software Base
- Raspberry Pi OS (64-bit) - Recomendado: **Bookworm**
- SSH habilitado (para administración remota)

---

## Preparación del Sistema

### 1. Actualizar el Sistema

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git build-essential
```

### 2. Instalar Node.js 18+

```bash
# Instalar Node.js 20 LTS (recomendado)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verificar instalación
node --version  # Debe ser v20.x.x
npm --version   # Debe ser 10.x.x
```

### 3. Instalar PostgreSQL

```bash
sudo apt install -y postgresql postgresql-contrib

# Iniciar PostgreSQL
sudo systemctl enable postgresql
sudo systemctl start postgresql

# Verificar
sudo systemctl status postgresql
```

### 4. Instalar Nginx (Opcional - para acceso con dominio)

```bash
sudo apt install -y nginx
sudo systemctl enable nginx
sudo systemctl start nginx
```

---

## Migración de la Base de Datos

### En el servidor actual (srv1003117):

```bash
cd /opt/flow-builder

# Crear backup de la base de datos
PGPASSWORD=azaleia_pg_2025_secure pg_dump -U whatsapp_user -d flowbuilder_crm -h localhost \
  --no-owner --no-privileges -F c -f flowbuilder_backup.dump

# Crear backup de archivos de datos
tar -czf data_backup.tar.gz data/

# Transferir a Raspberry Pi (reemplazar con tu IP de Raspberry Pi)
scp flowbuilder_backup.dump pi@192.168.1.XXX:/home/pi/
scp data_backup.tar.gz pi@192.168.1.XXX:/home/pi/
```

### En Raspberry Pi:

```bash
# Crear usuario y base de datos
sudo -u postgres psql << EOF
CREATE USER whatsapp_user WITH PASSWORD 'azaleia_pg_2025_secure';
CREATE DATABASE flowbuilder_crm OWNER whatsapp_user;
GRANT ALL PRIVILEGES ON DATABASE flowbuilder_crm TO whatsapp_user;
EOF

# Restaurar base de datos
sudo -u postgres pg_restore -d flowbuilder_crm -1 /home/pi/flowbuilder_backup.dump

# Otorgar permisos en las secuencias (importante!)
sudo -u postgres psql -d flowbuilder_crm << EOF
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO whatsapp_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO whatsapp_user;
EOF
```

---

## Instalación de la Aplicación

### 1. Clonar/Copiar el Proyecto

**Opción A: Desde el servidor actual**
```bash
# En tu máquina actual
cd /opt
tar -czf flow-builder.tar.gz flow-builder/ --exclude=node_modules --exclude=dist

# Transferir a Raspberry Pi
scp flow-builder.tar.gz pi@192.168.1.XXX:/home/pi/

# En Raspberry Pi
sudo mkdir -p /opt
cd /opt
sudo tar -xzf /home/pi/flow-builder.tar.gz
sudo chown -R pi:pi flow-builder
```

**Opción B: Desde repositorio Git (si tienes uno)**
```bash
cd /opt
sudo git clone <tu-repositorio> flow-builder
sudo chown -R pi:pi flow-builder
```

### 2. Configurar Variables de Entorno

```bash
cd /opt/flow-builder

# Copiar el archivo .env del servidor actual
# O crear uno nuevo con estos valores mínimos:
cat > .env << 'EOF'
PORT=3000
NODE_ENV=production

# PostgreSQL
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=flowbuilder_crm
POSTGRES_USER=whatsapp_user
POSTGRES_PASSWORD=azaleia_pg_2025_secure

# WhatsApp (copiar del servidor actual)
META_VERIFY_TOKEN=azaleia_meta_token_2025
META_WABA_TOKEN=<tu_token>
WHATSAPP_PHONE_NUMBER_ID=857608144100041
WHATSAPP_ACCESS_TOKEN=<tu_token>
WHATSAPP_VERIFY_TOKEN=azaleia_meta_token_2025

# Bitrix24 (copiar del servidor actual)
B24_PORTAL_BASE=https://azaleia-peru.bitrix24.es
B24_APP_ID=<tu_app_id>
B24_APP_SECRET=<tu_app_secret>

# JWT
JWT_SECRET=8K9mX2pL5nR4vW7qZ3jH6tY1sA0bN4cE9fG2hI5kJ8lM3oP6rQ9uT2vX5wZ8yA1b
JWT_EXPIRES_IN=7d

# CORS (ajustar según tu configuración)
CORS_ORIGIN=http://localhost:3000
CRM_WS_ALLOWED_ORIGINS=http://localhost:3000

# Storage
CRM_STORAGE_MODE=postgres
CAMPAIGNS_STORAGE_MODE=postgres
METRICS_STORAGE_MODE=postgres
SESSIONS_STORAGE_MODE=postgres

# Encryption
ENCRYPTION_SECRET=c2veQzbNlU0/aLMkYCKLm7NUtS7f3losgN6I+aU8DIY=
EOF

# Permisos
chmod 600 .env
```

### 3. Instalar Dependencias

```bash
cd /opt/flow-builder

# Instalar dependencias de Node.js
npm install

# Build del frontend
npm run build
```

### 4. Restaurar Datos

```bash
cd /opt/flow-builder

# Extraer backup de datos
tar -xzf /home/pi/data_backup.tar.gz

# Verificar permisos
sudo chown -R pi:pi data/
```

---

## Configuración como Servicio

### 1. Crear Script de Kill Processes (si no existe)

```bash
sudo mkdir -p /opt/flow-builder/scripts

cat > /opt/flow-builder/scripts/kill-old-processes.sh << 'EOF'
#!/bin/bash
# Matar procesos antiguos del flow-builder
pkill -f "tsx server/index.ts" || true
sleep 2
EOF

sudo chmod +x /opt/flow-builder/scripts/kill-old-processes.sh
```

### 2. Crear Servicio Systemd

```bash
sudo tee /etc/systemd/system/flowbuilder.service > /dev/null << 'EOF'
[Unit]
Description=Flow Builder WhatsApp Bot
After=network.target postgresql.service

[Service]
Type=simple
User=pi
WorkingDirectory=/opt/flow-builder
EnvironmentFile=/opt/flow-builder/.env
ExecStartPre=/opt/flow-builder/scripts/kill-old-processes.sh
ExecStart=/usr/bin/npx tsx server/index.ts
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=flowbuilder

# Security
NoNewPrivileges=true
PrivateTmp=true

# Performance
LimitNOFILE=65536

[Install]
WantedBy=multi-user.target
EOF
```

### 3. Iniciar el Servicio

```bash
# Recargar systemd
sudo systemctl daemon-reload

# Habilitar inicio automático
sudo systemctl enable flowbuilder

# Iniciar servicio
sudo systemctl start flowbuilder

# Verificar estado
sudo systemctl status flowbuilder

# Ver logs en tiempo real
sudo journalctl -u flowbuilder -f
```

---

## Opciones de Acceso

### Opción 1: Solo Red Local

Accede desde tu red local usando:
```
http://192.168.1.XXX:3000
```

### Opción 2: Túnel Cloudflare (Recomendado)

```bash
# Instalar cloudflared
wget https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64.deb
sudo dpkg -i cloudflared-linux-arm64.deb

# Autenticar (seguir instrucciones en el navegador)
cloudflared tunnel login

# Crear túnel
cloudflared tunnel create flowbuilder

# Configurar túnel
mkdir -p ~/.cloudflared
cat > ~/.cloudflared/config.yml << 'EOF'
tunnel: <TUNNEL-ID>
credentials-file: /home/pi/.cloudflared/<TUNNEL-ID>.json

ingress:
  - hostname: tudominio.com
    service: http://localhost:3000
  - service: http_status:404
EOF

# Crear ruta DNS
cloudflared tunnel route dns flowbuilder tudominio.com

# Iniciar túnel como servicio
sudo cloudflared service install
sudo systemctl start cloudflared
sudo systemctl enable cloudflared
```

### Opción 3: Nginx + DuckDNS (Dominio Dinámico Gratis)

```bash
# Instalar certbot para SSL
sudo apt install -y certbot python3-certbot-nginx

# Configurar DuckDNS (registrarse en duckdns.org)
# Crear script de actualización de IP
cat > /home/pi/duckdns.sh << 'EOF'
#!/bin/bash
echo url="https://www.duckdns.org/update?domains=TU-SUBDOMINIO&token=TU-TOKEN&ip=" | curl -k -o /home/pi/duck.log -K -
EOF

chmod +x /home/pi/duckdns.sh

# Agregar a cron (ejecutar cada 5 minutos)
(crontab -l 2>/dev/null; echo "*/5 * * * * /home/pi/duckdns.sh >/dev/null 2>&1") | crontab -

# Configurar Nginx
sudo tee /etc/nginx/sites-available/flowbuilder > /dev/null << 'EOF'
server {
    listen 80;
    server_name TU-SUBDOMINIO.duckdns.org;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # WebSocket para CRM
    location /api/crm/ws {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
EOF

# Habilitar sitio
sudo ln -s /etc/nginx/sites-available/flowbuilder /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# Obtener certificado SSL (después de configurar DuckDNS y abrir puerto 80 en tu router)
sudo certbot --nginx -d TU-SUBDOMINIO.duckdns.org
```

---

## Configuración de Router (Para acceso desde Internet)

### 1. Port Forwarding

En tu router, redirige estos puertos a tu Raspberry Pi:

**Opción con Nginx:**
- Puerto 80 (HTTP) → Raspberry Pi IP:80
- Puerto 443 (HTTPS) → Raspberry Pi IP:443

**Opción sin Nginx (solo Node.js):**
- Puerto 3000 → Raspberry Pi IP:3000

### 2. IP Estática Local

Configura IP estática para tu Raspberry Pi en el router.

---

## Actualizar Webhooks de WhatsApp/Bitrix

### WhatsApp Business API

Actualiza la URL del webhook en Meta Business:
```
https://tu-dominio.com/api/meta/webhook
```

### Bitrix24

Actualiza la URL de callback OAuth:
```
https://tu-dominio.com/api/bitrix/oauth/callback
```

Y actualiza en tu `.env`:
```
B24_REDIRECT_URL=https://tu-dominio.com/api/bitrix/oauth/callback
CORS_ORIGIN=https://tu-dominio.com
CRM_WS_ALLOWED_ORIGINS=https://tu-dominio.com
```

---

## Comandos Útiles

### Gestión del Servicio

```bash
# Ver logs en tiempo real
sudo journalctl -u flowbuilder -f

# Ver logs con filtro de error
sudo journalctl -u flowbuilder | grep -i error

# Reiniciar servicio
sudo systemctl restart flowbuilder

# Detener servicio
sudo systemctl stop flowbuilder

# Ver estado
sudo systemctl status flowbuilder
```

### Base de Datos

```bash
# Conectar a PostgreSQL
PGPASSWORD=azaleia_pg_2025_secure psql -U whatsapp_user -d flowbuilder_crm -h localhost

# Backup manual
PGPASSWORD=azaleia_pg_2025_secure pg_dump -U whatsapp_user -d flowbuilder_crm > backup.sql

# Ver tamaño de la base de datos
PGPASSWORD=azaleia_pg_2025_secure psql -U whatsapp_user -d flowbuilder_crm -c "SELECT pg_size_pretty(pg_database_size('flowbuilder_crm'));"
```

### Monitoreo de Recursos

```bash
# Ver uso de CPU/RAM
htop

# Ver uso de disco
df -h

# Ver temperatura de la Raspberry Pi
vcgencmd measure_temp

# Ver procesos de Node.js
ps aux | grep tsx
```

---

## Optimizaciones para Raspberry Pi 5

### 1. Configurar Swap (si tienes 4GB RAM)

```bash
# Aumentar swap a 4GB
sudo dphys-swapfile swapoff
sudo sed -i 's/CONF_SWAPSIZE=.*/CONF_SWAPSIZE=4096/' /etc/dphys-swapfile
sudo dphys-swapfile setup
sudo dphys-swapfile swapon
```

### 2. Limitar Memoria de Node.js

En el servicio systemd, agregar:
```bash
Environment="NODE_OPTIONS=--max-old-space-size=2048"
```

### 3. Habilitar Ventilador Activo (si tienes case con ventilador)

```bash
# En /boot/config.txt
sudo nano /boot/config.txt

# Agregar:
dtoverlay=gpio-fan,gpiopin=14,temp=60000
```

---

## Backup Automático

### Script de Backup Diario

```bash
sudo tee /opt/flow-builder/scripts/backup.sh > /dev/null << 'EOF'
#!/bin/bash
BACKUP_DIR="/home/pi/backups"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p "$BACKUP_DIR"

# Backup de PostgreSQL
PGPASSWORD=azaleia_pg_2025_secure pg_dump -U whatsapp_user -d flowbuilder_crm \
  -F c -f "$BACKUP_DIR/db_$DATE.dump"

# Backup de datos
tar -czf "$BACKUP_DIR/data_$DATE.tar.gz" /opt/flow-builder/data/

# Limpiar backups antiguos (mantener últimos 7 días)
find "$BACKUP_DIR" -name "*.dump" -mtime +7 -delete
find "$BACKUP_DIR" -name "*.tar.gz" -mtime +7 -delete

echo "Backup completado: $DATE"
EOF

sudo chmod +x /opt/flow-builder/scripts/backup.sh

# Agregar a crontab (ejecutar diariamente a las 2 AM)
(crontab -l 2>/dev/null; echo "0 2 * * * /opt/flow-builder/scripts/backup.sh >> /var/log/flowbuilder-backup.log 2>&1") | crontab -
```

---

## Troubleshooting

### Problema: Servicio no inicia

```bash
# Ver logs detallados
sudo journalctl -u flowbuilder -n 100 --no-pager

# Verificar permisos
sudo chown -R pi:pi /opt/flow-builder

# Verificar que PostgreSQL esté corriendo
sudo systemctl status postgresql
```

### Problema: No conecta a PostgreSQL

```bash
# Verificar que el usuario existe
sudo -u postgres psql -c "\du"

# Verificar permisos
sudo -u postgres psql -d flowbuilder_crm -c "GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO whatsapp_user;"
```

### Problema: Alta temperatura

```bash
# Monitorear temperatura
watch -n 1 vcgencmd measure_temp

# Si supera 70°C constantemente:
# - Instalar un ventilador activo
# - Mejorar ventilación del case
# - Reducir carga del sistema
```

---

## Rendimiento Esperado

### Raspberry Pi 5 (8GB)
- ✅ Puede manejar 100-200 conversaciones concurrentes
- ✅ Respuesta rápida para CRM
- ✅ Build de frontend en ~30-60 segundos

### Raspberry Pi 5 (4GB)
- ⚠️ Puede manejar 50-100 conversaciones concurrentes
- ⚠️ Requiere swap configurado
- ⚠️ Build de frontend más lento (~60-90 segundos)

---

## Próximos Pasos

1. ✅ Preparar Raspberry Pi con sistema operativo
2. ✅ Instalar dependencias (Node.js, PostgreSQL, Nginx)
3. ✅ Migrar base de datos
4. ✅ Copiar aplicación y configurar
5. ✅ Crear servicio systemd
6. ✅ Configurar acceso (local/túnel/dominio)
7. ✅ Actualizar webhooks de WhatsApp/Bitrix
8. ✅ Configurar backups automáticos
9. ✅ Monitorear rendimiento

---

## Soporte

Si tienes problemas durante la instalación:

1. Verifica los logs: `sudo journalctl -u flowbuilder -f`
2. Verifica la base de datos: Conecta con psql y revisa las tablas
3. Verifica el puerto: `sudo netstat -tlnp | grep 3000`
4. Verifica recursos: `htop` y `vcgencmd measure_temp`

**¡Buena suerte con tu instalación!**
