const axios = require('axios');
const fs = require('fs');

// Leer tokens de Bitrix
const secretsPath = '/opt/flow-builder/server/.secrets/bitrix-tokens.json';
const tokens = JSON.parse(fs.readFileSync(secretsPath, 'utf-8'));

const phones = [
  '51975533810', '51945051168', '51943258150', '51943503810', '51960949018',
  '51975723142', '51986230568', '51948598467', '51907915546', '51918650383',
  '51993847431', '51918851753', '51941541497', '51937149304', '51989839627',
  '51992173072', '51991772566', '51996440335', '51944827154', '51964191669',
  '51900565163', '51976448664', '51990058925', '51996151772', '51986534743',
  '51900919216', '51994390112', '51937738459', '51931377908', '51996198511',
  '51963364838', '51960207316', '51947375752', '51985393744', '51965704575',
  '51943124630', '51977394074', '51931938624', '51983006149', '51980851603',
  '51991032860', '51966960895', '51988540567', '51938950752', '51922627961'
];

async function testBitrix() {
  console.log('🔍 Probando 45 números en Bitrix24...\n');

  let found = 0;
  let notFound = 0;
  let errors = 0;

  for (let i = 0; i < phones.length; i++) {
    const phone = phones[i];

    try {
      const url = `https://azaleiaperu.bitrix24.com/rest/crm.contact.list?filter[PHONE]=${phone}&select[]=ID&select[]=NAME&select[]=LAST_NAME`;

      const response = await axios.get(url, {
        headers: {
          'Authorization': `Bearer ${tokens.access_token}`
        },
        timeout: 5000
      });

      if (response.data?.result && response.data.result.length > 0) {
        const contact = response.data.result[0];
        const fullName = `${contact.NAME || ''} ${contact.LAST_NAME || ''}`.trim();
        console.log(`[${i + 1}/45] ✅ ${phone} → ${fullName || 'Sin nombre'} (ID: ${contact.ID})`);
        found++;
      } else {
        console.log(`[${i + 1}/45] ⚠️  ${phone} → No encontrado`);
        notFound++;
      }

      // Esperar 200ms entre llamadas
      await new Promise(resolve => setTimeout(resolve, 200));

    } catch (error) {
      console.log(`[${i + 1}/45] ❌ ${phone} → Error: ${error.message}`);
      errors++;
    }
  }

  console.log('\n📊 RESUMEN:');
  console.log(`  ✅ Encontrados en Bitrix: ${found} (${(found/phones.length*100).toFixed(1)}%)`);
  console.log(`  ⚠️  No encontrados: ${notFound} (${(notFound/phones.length*100).toFixed(1)}%)`);
  console.log(`  ❌ Errores: ${errors}`);
  console.log(`\n${found > 0 ? '✅ Vale la pena hacer sync masivo' : '⚠️  Pocos números en Bitrix, no vale la pena'}`);
}

testBitrix().catch(console.error);
