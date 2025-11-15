import express from 'express';
import { createServer } from 'http';
import type { AddressInfo } from 'net';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { createConnectionsRouter } from '../../server/routes/connections';
import * as storage from '../../server/utils/storage';

const app = express();
app.use('/api/connections', createConnectionsRouter());

let server: ReturnType<typeof createServer>;
let baseUrl: string;

describe('Connections API', () => {
  beforeAll(async () => {
    server = createServer(app);
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const { port } = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });

  it('returns not_configured for whatsapp without env', async () => {
    const res = await fetch(`${baseUrl}/api/connections/whatsapp/check`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(false);
  });

  it('returns not_configured for bitrix without env', async () => {
    const readJsonSpy = vi.spyOn(storage, 'readJsonFile').mockReturnValue(null);
    const res = await fetch(`${baseUrl}/api/connections/bitrix/check`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(false);
    readJsonSpy.mockRestore();
  });
});
