# Flow Builder - Configuración del Proyecto

## ⚠️ IMPORTANTE - GESTIÓN DE PROCESOS

**ESTA APLICACIÓN USA SYSTEMD, NO PM2**

### Comandos correctos:

```bash
# Ver estado
sudo systemctl status flowbuilder

# Reiniciar
sudo systemctl restart flowbuilder

# Ver logs
sudo journalctl -u flowbuilder -f

# Detener
sudo systemctl stop flowbuilder

# Iniciar
sudo systemctl start flowbuilder
```

### ❌ NO USAR:
- `pm2 restart flow-builder` ❌
- `pm2 logs flow-builder` ❌
- `pm2 list` ❌
- Ningún comando pm2 para esta app

### Archivo de servicio:
- `/etc/systemd/system/flowbuilder.service`

---

## Base de Datos

**PostgreSQL** (NO JSON)
- Database: `flowbuilder_crm`
- User: `whatsapp_user`
- Password: `azaleia_pg_2025_secure`

---

## Reglas de Negocio

### Estados de conversaciones:
- `active` - En cola o con bot
- `attending` - Siendo atendido por asesor
- `closed` - Cerrado

### NO asignación automática:
- Los chats deben quedarse en cola
- Los asesores aceptan manualmente
- QueueDistributor debe estar DESACTIVADO o en modo "manual"

### Cuando asesor se desloguea:
- Sus chats asignados SE QUEDAN con él
- NO redistribuir a otros asesores
- Chats nuevos van a cola

---

**Última actualización:** 2025-11-21
