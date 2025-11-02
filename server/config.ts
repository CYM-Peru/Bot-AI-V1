/**
 * ⚠️ CONFIGURACIÓN CRÍTICA DEL SERVIDOR - NO MODIFICAR SIN AUTORIZACIÓN ⚠️
 *
 * Este archivo contiene configuraciones críticas del servidor que afectan
 * la funcionalidad y seguridad de la aplicación.
 *
 * IMPORTANTE: Cualquier cambio debe ser revisado y aprobado por el administrador.
 */

/**
 * REQUEST_BODY_SIZE_LIMIT: Tamaño máximo permitido para el cuerpo de las peticiones
 *
 * ⚠️ ADVERTENCIA: Este valor ha sido configurado en 2.5GB para soportar flujos grandes.
 * NO REDUCIR este valor sin consultar al administrador, ya que causará errores
 * "request entity too large" en el sistema.
 *
 * Valor actual: "2500mb" (2.5 GB)
 * Configurado el: 2025-10-31
 * Motivo: Soportar guardado de flujos complejos con muchos nodos
 */
export const REQUEST_BODY_SIZE_LIMIT = "2500mb";

/**
 * Validación de integridad de la configuración
 * Esta función verifica que los valores críticos no hayan sido modificados incorrectamente
 */
export function validateConfig() {
  const sizeInMB = parseInt(REQUEST_BODY_SIZE_LIMIT);

  if (isNaN(sizeInMB) || sizeInMB < 2500) {
    console.error("\n");
    console.error("═".repeat(80));
    console.error("⚠️  ERROR CRÍTICO DE CONFIGURACIÓN ⚠️");
    console.error("═".repeat(80));
    console.error("");
    console.error("El REQUEST_BODY_SIZE_LIMIT ha sido modificado a un valor inválido.");
    console.error(`Valor actual: ${REQUEST_BODY_SIZE_LIMIT}`);
    console.error("Valor mínimo requerido: 2500mb");
    console.error("");
    console.error("Esto causará errores 'request entity too large' en producción.");
    console.error("Por favor, restaure el valor a '2500mb' en server/config.ts");
    console.error("");
    console.error("═".repeat(80));
    console.error("\n");

    // No detenemos el servidor, pero advertimos fuertemente
    return false;
  }

  return true;
}
