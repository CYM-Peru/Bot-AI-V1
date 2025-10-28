import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getWhatsAppEnv, getWhatsAppVerifyToken, isWhatsAppConfigured } from '../utils/env';

const ORIGINAL_ENV = { ...process.env };

describe('env helpers', () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it('prefiere variables WSP_*', () => {
    process.env.WSP_BASE_URL = 'https://graph.test';
    process.env.WSP_API_VERSION = 'v99.0';
    process.env.WSP_PHONE_NUMBER_ID = '123';
    process.env.WSP_ACCESS_TOKEN = 'token';
    const env = getWhatsAppEnv();
    expect(env.baseUrl).toBe('https://graph.test');
    expect(env.apiVersion).toBe('v99.0');
    expect(env.phoneNumberId).toBe('123');
    expect(env.accessToken).toBe('token');
    expect(isWhatsAppConfigured()).toBe(true);
  });

  it('usa fallback legacy cuando faltan WSP_*', () => {
    process.env.WHATSAPP_ACCESS_TOKEN = 'legacy-token';
    process.env.WHATSAPP_PHONE_NUMBER_ID = 'legacy-id';
    const env = getWhatsAppEnv();
    expect(env.accessToken).toBe('legacy-token');
    expect(env.phoneNumberId).toBe('legacy-id');
  });

  it('devuelve verify token', () => {
    process.env.WSP_VERIFY_TOKEN = 'secret';
    expect(getWhatsAppVerifyToken()).toBe('secret');
  });
});
