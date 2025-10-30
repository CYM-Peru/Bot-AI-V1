# Deployment Automático - Configuración

## Overview

El proyecto tiene configurado CI/CD con GitHub Actions para desplegar automáticamente al VPS cuando se hace merge a `main`.

## ¿Qué se despliega automáticamente?

### ✅ Frontend
- Se compila con `npm run build`
- Se sube a `/var/www/flow-builder` en el VPS
- Se recargan permisos y Nginx

### ✅ Backend
- **No requiere compilación** (usa `tsx` en runtime)
- Se sube el código fuente al path configurado en `VPS_APP_PATH`
- Se instalan dependencias (incluyendo `tsx`)
- Se reinicia el servicio (PM2 o systemd)

## Configuración Requerida

### Secrets de GitHub

Debes configurar estos secrets en tu repositorio de GitHub:
**Settings → Secrets and variables → Actions → New repository secret**

| Secret | Descripción | Ejemplo |
|--------|-------------|---------|
| `VPS_HOST` | IP o dominio del VPS | `192.168.1.100` o `bot.midominio.com` |
| `VPS_USER` | Usuario SSH del VPS | `root` o `deploy` |
| `VPS_KEY` | Clave privada SSH | Contenido completo de `~/.ssh/id_rsa` |
| `VPS_APP_PATH` | Path donde está el backend | `/home/deploy/bot-ai` |

### Obtener la clave SSH

```bash
# En tu VPS, genera una clave SSH si no tienes
ssh-keygen -t rsa -b 4096 -C "deploy@bot-ai"

# Muestra la clave PRIVADA (copia TODO el contenido)
cat ~/.ssh/id_rsa

# Agrega la clave PÚBLICA a authorized_keys
cat ~/.ssh/id_rsa.pub >> ~/.ssh/authorized_keys
```

Copia el contenido completo de la clave privada (incluyendo `-----BEGIN` y `-----END`) y pégalo en el secret `VPS_KEY`.

## Configurar el Process Manager

El workflow necesita saber cómo reiniciar tu backend. Elige una opción:

### Opción 1: PM2 (Recomendado)

Edita `.github/workflows/deploy.yml` y descomenta estas líneas:

```yaml
# Option 1: PM2 (uncomment if using PM2)
pm2 restart bot-ai-server || pm2 start npm --name bot-ai-server -- run start:server
```

**Instalación de PM2 en el VPS:**
```bash
npm install -g pm2
cd /home/deploy/bot-ai
pm2 start npm --name bot-ai-server -- run start:server
pm2 save
pm2 startup
```

### Opción 2: systemd

Edita `.github/workflows/deploy.yml` y descomenta:

```yaml
# Option 2: systemd (uncomment if using systemd)
systemctl restart bot-ai.service
```

**Crear servicio systemd:**

```bash
sudo nano /etc/systemd/system/bot-ai.service
```

Contenido:
```ini
[Unit]
Description=Bot AI Server
After=network.target

[Service]
Type=simple
User=deploy
WorkingDirectory=/home/deploy/bot-ai
ExecStart=/usr/bin/npm run start:server
Restart=always
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

Habilitar:
```bash
sudo systemctl daemon-reload
sudo systemctl enable bot-ai
sudo systemctl start bot-ai
```

## Flujo de Deployment

1. **Desarrollador hace merge a `main`**
   - Automáticamente se dispara el workflow

2. **GitHub Actions ejecuta:**
   - ✅ Checkout del código
   - ✅ Instala Node.js 20
   - ✅ Instala dependencias
   - ✅ Ejecuta tests (si existen)
   - ✅ Compila frontend (`npm run build`)

3. **Si el build es exitoso:**
   - ✅ Sube frontend compilado al VPS
   - ✅ Sube código backend al VPS
   - ✅ Instala dependencias en el VPS (incluyendo `tsx`)
   - ✅ Reinicia el servicio
   - ✅ Recarga Nginx

4. **Tu aplicación está actualizada** 🚀

## Verificar que funciona

1. Haz un cambio pequeño y commitea
2. Crea un PR y haz merge a `main`
3. Ve a GitHub → Actions → Deploy Flow Builder
4. Verifica que todos los pasos sean exitosos ✅

## Troubleshooting

### Error: "Permission denied"
- Verifica que `VPS_KEY` tenga la clave SSH correcta
- Verifica que el usuario tenga permisos SSH

### Error: "npm: command not found"
- Instala Node.js en el VPS:
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### Error: "pm2: command not found"
```bash
npm install -g pm2
```

### Error en compilación del frontend
- Verifica que no haya errores de TypeScript localmente
- Ejecuta `npm run build` antes de hacer push
- El backend usa `tsx` en runtime, no requiere compilación

## Deployment Manual (Fallback)

Si el CI/CD falla, puedes desplegar manualmente:

```bash
# En tu VPS
cd /home/deploy/bot-ai
git pull origin main
npm install
pm2 restart bot-ai-server  # o systemctl restart bot-ai
```

## Notas Importantes

- ⚠️ El deployment solo ocurre en push a `main`
- ⚠️ Los PRs ejecutan tests pero NO despliegan
- ⚠️ Asegúrate de que `.env` esté en el VPS (no se sube por seguridad)
- ⚠️ Las dependencias nuevas se instalan automáticamente
