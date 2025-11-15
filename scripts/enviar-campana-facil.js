#!/usr/bin/env node
// Script SÚPER SIMPLE para enviar campañas con imagen
// Uso: node /opt/flow-builder/scripts/enviar-campana-facil.js

import readline from 'readline';
import fs from 'fs';
import path from 'path';
import { uploadMedia, sendTemplateMessage } from '../src/api/whatsapp-sender.ts';
import { campaignStorage } from '../server/campaigns/storage.ts';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function ask(question) {
  return new Promise(resolve => rl.question(question, resolve));
}

// Configuración fija
const PHONE_NUMBER_ID = "865074343358032"; // 961842916
const TEMPLATE_NAME = "lanzamiento_octubre";

async function getWhatsAppConfig() {
  try {
    const connectionsPath = path.join(process.cwd(), "data", "whatsapp-connections.json");
    const data = await fs.promises.readFile(connectionsPath, "utf-8");
    const parsed = JSON.parse(data);
    const connection = parsed.connections?.find(c => c.phoneNumberId === PHONE_NUMBER_ID);

    if (connection && connection.accessToken) {
      return {
        accessToken: connection.accessToken,
        phoneNumberId: connection.phoneNumberId,
        apiVersion: "v20.0",
        baseUrl: "https://graph.facebook.com",
      };
    }
  } catch (error) {
    console.error('Error al cargar configuración:', error);
  }
  return null;
}

async function main() {
  console.log('');
  console.log('═══════════════════════════════════════════════════');
  console.log('  📱 ENVIAR CAMPAÑA CON IMAGEN - MODO FÁCIL');
  console.log('═══════════════════════════════════════════════════');
  console.log('');

  // Paso 1: Pedir ruta de imagen
  const imagePath = await ask('📸 Ruta completa de tu imagen (o Enter para usar imagen de prueba): ');
  console.log('');

  let mediaId;

  if (imagePath.trim() === '') {
    // Usar imagen de prueba
    console.log('✅ Usando imagen de prueba (cuadro rojo)');
    mediaId = "1946808952546233";
  } else {
    // Verificar que existe
    if (!fs.existsSync(imagePath.trim())) {
      console.log('❌ Error: No se encuentra el archivo:', imagePath);
      console.log('');
      rl.close();
      process.exit(1);
    }

    // Subir imagen
    console.log('📤 Subiendo imagen a WhatsApp...');

    const config = await getWhatsAppConfig();
    if (!config) {
      console.log('❌ Error al obtener configuración de WhatsApp');
      rl.close();
      process.exit(1);
    }

    const imageBuffer = fs.readFileSync(imagePath.trim());
    const fileName = path.basename(imagePath.trim());
    let mimeType = 'image/jpeg';
    if (fileName.toLowerCase().endsWith('.png')) mimeType = 'image/png';

    const uploadResult = await uploadMedia(config, imageBuffer, mimeType, fileName);

    if (!uploadResult.ok || !uploadResult.body) {
      console.log('❌ Error al subir imagen:', uploadResult.body);
      rl.close();
      process.exit(1);
    }

    mediaId = uploadResult.body.id;
    console.log('✅ Imagen subida! Media ID:', mediaId);
  }

  console.log('');

  // Paso 2: Pedir destinatarios
  const recipientsInput = await ask('📞 Números de teléfono (separados por coma): ');
  console.log('');

  const recipients = recipientsInput
    .split(',')
    .map(phone => phone.trim().replace(/\D/g, ''))
    .filter(phone => phone.length >= 9);

  if (recipients.length === 0) {
    console.log('❌ No hay números válidos');
    rl.close();
    process.exit(1);
  }

  console.log(`✅ ${recipients.length} número(s) válido(s)`);
  console.log('');

  // Paso 3: Confirmar
  console.log('═══════════════════════════════════════════════════');
  console.log('📋 RESUMEN:');
  console.log(`   Plantilla: ${TEMPLATE_NAME}`);
  console.log(`   Media ID: ${mediaId}`);
  console.log(`   Destinatarios: ${recipients.join(', ')}`);
  console.log('═══════════════════════════════════════════════════');
  console.log('');

  const confirm = await ask('¿Enviar ahora? (si/no): ');

  if (confirm.toLowerCase() !== 'si' && confirm.toLowerCase() !== 's') {
    console.log('❌ Cancelado');
    rl.close();
    process.exit(0);
  }

  console.log('');
  console.log('📤 ENVIANDO...');
  console.log('');

  // Crear campaña
  const campaign = {
    id: `campaign_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    name: `Campaña Rápida ${new Date().toLocaleString()}`,
    whatsappNumberId: PHONE_NUMBER_ID,
    templateName: TEMPLATE_NAME,
    language: 'es_PE',
    recipients: recipients,
    variables: [
      {
        type: 'header',
        parameters: [
          {
            type: 'image',
            image: { id: mediaId }
          }
        ]
      }
    ],
    status: 'sending',
    createdAt: Date.now(),
    createdBy: 'script',
    throttleRate: 60,
  };

  campaignStorage.createCampaign(campaign);

  // Obtener config
  const config = await getWhatsAppConfig();
  if (!config) {
    console.log('❌ Error al obtener configuración');
    rl.close();
    process.exit(1);
  }

  // Enviar a cada destinatario
  let sent = 0;
  let failed = 0;

  for (const phone of recipients) {
    try {
      const result = await sendTemplateMessage(
        config,
        phone,
        TEMPLATE_NAME,
        'es_PE',
        campaign.variables
      );

      if (result.ok) {
        sent++;
        campaignStorage.updateMessageStatus(campaign.id, phone, 'sent');
        console.log(`✅ Enviado a ${phone}`);
      } else {
        failed++;
        campaignStorage.updateMessageStatus(campaign.id, phone, 'failed');
        console.log(`❌ Error enviando a ${phone}`);
      }

      // Esperar 1 segundo entre mensajes
      if (recipients.indexOf(phone) < recipients.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } catch (error) {
      failed++;
      console.log(`❌ Error enviando a ${phone}:`, error.message);
    }
  }

  campaignStorage.updateCampaignStatus(campaign.id, 'completed');

  console.log('');
  console.log('═══════════════════════════════════════════════════');
  console.log('✅ CAMPAÑA COMPLETADA');
  console.log(`   Enviados: ${sent}`);
  console.log(`   Fallidos: ${failed}`);
  console.log('═══════════════════════════════════════════════════');
  console.log('');

  rl.close();
}

main().catch(error => {
  console.error('Error:', error);
  rl.close();
  process.exit(1);
});
