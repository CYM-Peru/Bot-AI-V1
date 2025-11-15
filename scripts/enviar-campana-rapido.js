// Script rápido para enviar campañas con imagen desde URL
import { uploadMedia, sendTemplateMessage } from '../src/api/whatsapp-sender.ts';
import { campaignStorage } from '../server/campaigns/storage.ts';
import fs from 'fs';
import path from 'path';

const imageUrl = process.argv[2];
const numbersStr = process.argv[3];

if (!imageUrl || !numbersStr) {
  console.log('❌ Error: Faltan parámetros');
  process.exit(1);
}

const PHONE_NUMBER_ID = "865074343358032";
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
    console.error('Error:', error);
  }
  return null;
}

async function main() {
  try {
    // Parse numbers
    const recipients = numbersStr
      .split(',')
      .map(n => n.trim().replace(/\D/g, ''))
      .filter(n => n.length >= 9);

    if (recipients.length === 0) {
      console.log('❌ No hay números válidos');
      process.exit(1);
    }

    console.log(`✅ ${recipients.length} número(s) válido(s)`);
    console.log('');

    // Get config
    const config = await getWhatsAppConfig();
    if (!config) {
      console.log('❌ Error: Configuración de WhatsApp no disponible');
      process.exit(1);
    }

    // Convert Google Drive links to direct download URLs
    let finalImageUrl = imageUrl;
    if (imageUrl.includes('drive.google.com')) {
      // Extract file ID from various Google Drive URL formats
      let fileId = null;

      // Format: https://drive.google.com/file/d/FILE_ID/view
      const match1 = imageUrl.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
      if (match1) fileId = match1[1];

      // Format: https://drive.google.com/open?id=FILE_ID
      const match2 = imageUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/);
      if (match2) fileId = match2[1];

      if (fileId) {
        finalImageUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
        console.log('🔄 Link de Google Drive convertido a descarga directa');
      }
    }

    // Download image
    console.log('📥 Descargando imagen...');
    const imageResponse = await fetch(finalImageUrl);

    if (!imageResponse.ok) {
      console.log(`❌ Error al descargar: ${imageResponse.status} ${imageResponse.statusText}`);
      process.exit(1);
    }

    const arrayBuffer = await imageResponse.arrayBuffer();
    const imageBuffer = Buffer.from(arrayBuffer);
    const mimeType = imageResponse.headers.get('content-type') || 'image/jpeg';

    console.log(`✅ Descargado: ${(imageBuffer.length / 1024).toFixed(2)} KB`);
    console.log('');

    // Upload to WhatsApp
    console.log('📤 Subiendo a WhatsApp...');
    const uploadResult = await uploadMedia(config, imageBuffer, mimeType, 'campaign-image.jpg');

    if (!uploadResult.ok || !uploadResult.body) {
      console.log('❌ Error al subir a WhatsApp');
      console.log(uploadResult.body);
      process.exit(1);
    }

    const mediaId = uploadResult.body.id;
    console.log(`✅ Media ID: ${mediaId}`);
    console.log('');

    // Create campaign
    const campaign = {
      id: `campaign_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: `Campaña ${new Date().toLocaleString()}`,
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

    // Send messages
    console.log('📬 ENVIANDO MENSAJES...');
    console.log('');

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
          console.log(`  ✅ ${phone}`);
        } else {
          failed++;
          campaignStorage.updateMessageStatus(campaign.id, phone, 'failed');
          console.log(`  ❌ ${phone} - Error ${result.status}`);
        }

        // Wait 1 second between messages
        if (recipients.indexOf(phone) < recipients.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      } catch (error) {
        failed++;
        console.log(`  ❌ ${phone} - ${error.message}`);
      }
    }

    campaignStorage.updateCampaignStatus(campaign.id, 'completed');

    console.log('');
    console.log('═══════════════════════════════════════════════════');
    console.log('✅ COMPLETADO');
    console.log(`   Enviados: ${sent}`);
    console.log(`   Fallidos: ${failed}`);
    console.log('═══════════════════════════════════════════════════');
    console.log('');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();
