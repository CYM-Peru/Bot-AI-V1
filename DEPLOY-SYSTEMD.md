# GUÍA DE DESPLIEGUE CON SYSTEMD

Este proyecto usa **systemd** para gestionar el servidor en producción.

## Comandos principales

### Ver estado del servidor
```bash
sudo systemctl status flowbuilder.service
```

### Reiniciar el servidor
```bash
sudo systemctl restart flowbuilder.service
```

### Ver logs en tiempo real
```bash
sudo journalctl -u flowbuilder.service -f
```

### Ver logs recientes (últimas 100 líneas)
```bash
sudo journalctl -u flowbuilder.service -n 100
```

### Detener el servidor
```bash
sudo systemctl stop flowbuilder.service
```

### Iniciar el servidor
```bash
sudo systemctl start flowbuilder.service
```

## Despliegue de cambios

1. **Pull de cambios desde Git:**
```bash
cd /opt/flow-builder
git pull origin main
```

2. **Instalar dependencias (si hay nuevas):**
```bash
npm install
```

3. **Compilar frontend (si hay cambios en src/):**
```bash
npm run build
```

4. **Reiniciar servidor:**
```bash
sudo systemctl restart flowbuilder.service
```

5. **Verificar que arrancó correctamente:**
```bash
sudo systemctl status flowbuilder.service
sudo journalctl -u flowbuilder.service -n 50
```

## Ubicación del servicio

- Archivo de servicio: `/etc/systemd/system/flowbuilder.service`
- Directorio del proyecto: `/opt/flow-builder`
- Variables de entorno: `/opt/flow-builder/.env`

## Verificación de salud

```bash
curl http://localhost:3000/health
```

Debería responder con status 200.

## Solución de problemas

Si el servidor no arranca:

1. Ver logs de error:
```bash
sudo journalctl -u flowbuilder.service -n 100 --no-pager
```

2. Verificar que PostgreSQL esté corriendo:
```bash
sudo systemctl status postgresql
```

3. Verificar variables de entorno en `.env`

4. Reintentar:
```bash
sudo systemctl restart flowbuilder.service
```
