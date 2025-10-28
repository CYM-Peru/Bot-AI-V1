import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { checkWhatsAppConnection, sendWhatsAppMessage } from '../services/whatsapp';

const ORIGINAL_ENV = { ...process.env };

function mockFetchImplementation(status: number, body: unknown) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: vi.fn().mockResolvedValue(body),
  } as unknown as Response);
}

describe('WhatsApp service', () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.restoreAllMocks();
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.restoreAllMocks();
  });

  it('envía mensajes de texto con payload correcto', async () => {
    process.env.WSP_ACCESS_TOKEN = 'token';
    process.env.WSP_PHONE_NUMBER_ID = '123';
    const fetchMock = mockFetchImplementation(200, { success: true });
    vi.stubGlobal('fetch', fetchMock);

    const result = await sendWhatsAppMessage({ phone: '51999', text: 'hola' });
    expect(result.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/123/messages'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer token' }),
      })
    );
  });

  it('check retorna estado ok', async () => {
    process.env.WSP_ACCESS_TOKEN = 'token';
    process.env.WSP_PHONE_NUMBER_ID = '123';
    const fetchMock = mockFetchImplementation(200, { display_phone_number: '+51 999' });
    vi.stubGlobal('fetch', fetchMock);

    const status = await checkWhatsAppConnection();
    expect(status.ok).toBe(true);
    expect(status.displayPhoneNumber).toBe('+51 999');
  });

  it('check responde not_configured cuando faltan credenciales', async () => {
    delete process.env.WSP_ACCESS_TOKEN;
    delete process.env.WSP_PHONE_NUMBER_ID;
    const status = await checkWhatsAppConnection();
    expect(status.ok).toBe(false);
    expect(status.reason).toBe('not_configured');
  });
});
