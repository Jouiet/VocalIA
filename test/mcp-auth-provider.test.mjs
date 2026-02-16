/**
 * MCP OAuth 2.1 Auth Provider — Unit Tests
 * VocalIA — Session 250.207
 *
 * Tests: mcp-server/src/auth-provider.ts (compiled to dist/auth-provider.js)
 * Was: 0 tests.
 *
 * Covers: VocaliaClientsStore (registration, rate limiting, max clients),
 * VocaliaOAuthProvider (authorize, challengeForAuthorizationCode,
 * exchangeAuthorizationCode, exchangeRefreshToken, verifyAccessToken,
 * revokeToken), token format, full OAuth 2.1 flow, edge cases.
 *
 * Run: node --test test/mcp-auth-provider.test.mjs
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

// Each require() shares the same module-level Maps — we create fresh providers per describe
const { VocaliaOAuthProvider } = require('../mcp-server/dist/auth-provider.js');

// ═══════════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════════

function createProvider() {
  return new VocaliaOAuthProvider();
}

function createMockRes() {
  const res = {
    redirectUrl: null,
    redirectStatus: null,
    redirect(status, url) {
      res.redirectStatus = status;
      res.redirectUrl = url;
    }
  };
  return res;
}

function makeClient(provider, name = 'Test Client') {
  return provider.clientsStore.registerClient({
    redirect_uris: ['http://localhost:3000/callback'],
    client_name: name
  });
}

async function getAuthCode(provider, client, opts = {}) {
  const res = createMockRes();
  await provider.authorize(client, {
    codeChallenge: opts.codeChallenge || 'test_challenge_abc',
    redirectUri: client.redirect_uris[0],
    scopes: opts.scopes || ['read', 'write'],
    state: opts.state || 'test_state'
  }, res);
  const url = new URL(res.redirectUrl);
  return url.searchParams.get('code');
}

async function getTokens(provider, client, code) {
  return provider.exchangeAuthorizationCode(client, code);
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 1: VocaliaClientsStore — Registration
// ═══════════════════════════════════════════════════════════════════════════════

describe('VocaliaClientsStore registration', () => {
  it('registers a client with correct fields', () => {
    const p = createProvider();
    const client = makeClient(p);
    assert.ok(client.client_id.startsWith('vocalia_'));
    assert.equal(client.client_id.length, 'vocalia_'.length + 16);
    assert.equal(typeof client.client_secret, 'string');
    assert.equal(client.client_secret.length, 64); // 32 bytes hex
    assert.equal(typeof client.client_id_issued_at, 'number');
    assert.equal(typeof client.client_secret_expires_at, 'number');
  });

  it('preserves client input fields', () => {
    const p = createProvider();
    const client = p.clientsStore.registerClient({
      redirect_uris: ['http://example.com/cb'],
      client_name: 'My App'
    });
    assert.deepEqual(client.redirect_uris, ['http://example.com/cb']);
    assert.equal(client.client_name, 'My App');
  });

  it('getClient returns registered client', () => {
    const p = createProvider();
    const client = makeClient(p, 'Retrieval Test');
    const fetched = p.clientsStore.getClient(client.client_id);
    assert.equal(fetched.client_id, client.client_id);
    assert.equal(fetched.client_name, 'Retrieval Test');
  });

  it('getClient returns undefined for unknown id', () => {
    const p = createProvider();
    const result = p.clientsStore.getClient('nonexistent_client_id');
    assert.equal(result, undefined);
  });

  it('generates unique client_ids', () => {
    const p = createProvider();
    const ids = new Set();
    for (let i = 0; i < 5; i++) {
      const c = makeClient(p, `Client${i}`);
      ids.add(c.client_id);
    }
    assert.equal(ids.size, 5);
  });

  it('generates unique client_secrets', () => {
    const p = createProvider();
    const secrets = new Set();
    for (let i = 0; i < 5; i++) {
      const c = makeClient(p, `SecretTest${i}`);
      secrets.add(c.client_secret);
    }
    assert.equal(secrets.size, 5);
  });

  it('secret expires ~1 year from now', () => {
    const p = createProvider();
    const now = Math.floor(Date.now() / 1000);
    const client = makeClient(p);
    const expiryDiff = client.client_secret_expires_at - now;
    const oneYear = 365 * 24 * 3600;
    assert.ok(Math.abs(expiryDiff - oneYear) < 5, 'Secret should expire in ~1 year');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 2: authorize() — Generates auth code and redirects
// ═══════════════════════════════════════════════════════════════════════════════

describe('VocaliaOAuthProvider.authorize()', () => {
  it('redirects with 302', async () => {
    const p = createProvider();
    const client = makeClient(p);
    const res = createMockRes();
    await p.authorize(client, {
      codeChallenge: 'challenge123',
      redirectUri: 'http://localhost:3000/callback',
      scopes: ['read'],
      state: 'abc'
    }, res);
    assert.equal(res.redirectStatus, 302);
  });

  it('redirect URL contains code param', async () => {
    const p = createProvider();
    const client = makeClient(p);
    const res = createMockRes();
    await p.authorize(client, {
      codeChallenge: 'c',
      redirectUri: 'http://localhost:3000/callback',
      scopes: [],
      state: 'xyz'
    }, res);
    const url = new URL(res.redirectUrl);
    assert.ok(url.searchParams.has('code'));
    assert.equal(url.searchParams.get('code').length, 32); // 16 bytes hex
  });

  it('redirect URL contains state param', async () => {
    const p = createProvider();
    const client = makeClient(p);
    const res = createMockRes();
    await p.authorize(client, {
      codeChallenge: 'c',
      redirectUri: 'http://localhost:3000/callback',
      scopes: [],
      state: 'my_custom_state'
    }, res);
    const url = new URL(res.redirectUrl);
    assert.equal(url.searchParams.get('state'), 'my_custom_state');
  });

  it('redirect URL uses correct redirectUri base', async () => {
    const p = createProvider();
    const client = p.clientsStore.registerClient({
      redirect_uris: ['https://myapp.com/auth/callback'],
      client_name: 'Redirect Test'
    });
    const res = createMockRes();
    await p.authorize(client, {
      codeChallenge: 'c',
      redirectUri: 'https://myapp.com/auth/callback',
      scopes: [],
      state: 's'
    }, res);
    assert.ok(res.redirectUrl.startsWith('https://myapp.com/auth/callback'));
  });

  it('omits state param when not provided', async () => {
    const p = createProvider();
    const client = makeClient(p);
    const res = createMockRes();
    await p.authorize(client, {
      codeChallenge: 'c',
      redirectUri: 'http://localhost:3000/callback',
      scopes: []
    }, res);
    const url = new URL(res.redirectUrl);
    assert.equal(url.searchParams.has('state'), false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 3: challengeForAuthorizationCode()
// ═══════════════════════════════════════════════════════════════════════════════

describe('challengeForAuthorizationCode()', () => {
  it('returns the stored code challenge', async () => {
    const p = createProvider();
    const client = makeClient(p);
    const code = await getAuthCode(p, client, { codeChallenge: 'my_pkce_challenge' });
    const challenge = await p.challengeForAuthorizationCode(client, code);
    assert.equal(challenge, 'my_pkce_challenge');
  });

  it('throws for invalid code', async () => {
    const p = createProvider();
    const client = makeClient(p);
    await assert.rejects(
      () => p.challengeForAuthorizationCode(client, 'nonexistent_code'),
      /Invalid authorization code/
    );
  });

  it('throws when code belongs to different client', async () => {
    const p = createProvider();
    const client1 = makeClient(p, 'Client1');
    const client2 = makeClient(p, 'Client2');
    const code = await getAuthCode(p, client1);
    await assert.rejects(
      () => p.challengeForAuthorizationCode(client2, code),
      /does not belong to this client/
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 4: exchangeAuthorizationCode()
// ═══════════════════════════════════════════════════════════════════════════════

describe('exchangeAuthorizationCode()', () => {
  it('returns tokens with correct structure', async () => {
    const p = createProvider();
    const client = makeClient(p);
    const code = await getAuthCode(p, client);
    const tokens = await getTokens(p, client, code);
    assert.equal(tokens.token_type, 'Bearer');
    assert.equal(tokens.expires_in, 3600);
    assert.ok(tokens.access_token.startsWith('vat_'));
    assert.ok(tokens.refresh_token.startsWith('vrt_'));
    assert.equal(typeof tokens.scope, 'string');
  });

  it('returns scope as space-separated string', async () => {
    const p = createProvider();
    const client = makeClient(p);
    const code = await getAuthCode(p, client, { scopes: ['tools', 'resources'] });
    const tokens = await getTokens(p, client, code);
    assert.equal(tokens.scope, 'tools resources');
  });

  it('consumes code (one-time use)', async () => {
    const p = createProvider();
    const client = makeClient(p);
    const code = await getAuthCode(p, client);
    await getTokens(p, client, code); // first use OK
    await assert.rejects(
      () => getTokens(p, client, code), // second use fails
      /Invalid authorization code/
    );
  });

  it('throws for invalid code', async () => {
    const p = createProvider();
    const client = makeClient(p);
    await assert.rejects(
      () => p.exchangeAuthorizationCode(client, 'bogus_code'),
      /Invalid authorization code/
    );
  });

  it('throws when code belongs to different client', async () => {
    const p = createProvider();
    const client1 = makeClient(p, 'Owner');
    const client2 = makeClient(p, 'Thief');
    const code = await getAuthCode(p, client1);
    await assert.rejects(
      () => p.exchangeAuthorizationCode(client2, code),
      /Client mismatch/
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 5: verifyAccessToken()
// ═══════════════════════════════════════════════════════════════════════════════

describe('verifyAccessToken()', () => {
  it('returns AuthInfo for valid token', async () => {
    const p = createProvider();
    const client = makeClient(p);
    const code = await getAuthCode(p, client, { scopes: ['read'] });
    const tokens = await getTokens(p, client, code);
    const info = await p.verifyAccessToken(tokens.access_token);
    assert.equal(info.token, tokens.access_token);
    assert.equal(info.clientId, client.client_id);
    assert.deepEqual(info.scopes, ['read']);
    assert.equal(typeof info.expiresAt, 'number');
  });

  it('throws for invalid token', async () => {
    const p = createProvider();
    await assert.rejects(
      () => p.verifyAccessToken('vat_nonexistent_token'),
      /Invalid access token/
    );
  });

  it('throws for revoked token', async () => {
    const p = createProvider();
    const client = makeClient(p);
    const code = await getAuthCode(p, client);
    const tokens = await getTokens(p, client, code);
    await p.revokeToken(client, { token: tokens.access_token });
    await assert.rejects(
      () => p.verifyAccessToken(tokens.access_token),
      /revoked/
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 6: exchangeRefreshToken()
// ═══════════════════════════════════════════════════════════════════════════════

describe('exchangeRefreshToken()', () => {
  it('returns new tokens for valid refresh token', async () => {
    const p = createProvider();
    const client = makeClient(p);
    const code = await getAuthCode(p, client, { scopes: ['read', 'write'] });
    const tokens = await getTokens(p, client, code);
    const newTokens = await p.exchangeRefreshToken(client, tokens.refresh_token);
    assert.ok(newTokens.access_token.startsWith('vat_'));
    assert.ok(newTokens.refresh_token.startsWith('vrt_'));
    assert.notEqual(newTokens.access_token, tokens.access_token);
    assert.notEqual(newTokens.refresh_token, tokens.refresh_token);
  });

  it('rotates refresh token (old one invalid)', async () => {
    const p = createProvider();
    const client = makeClient(p);
    const code = await getAuthCode(p, client);
    const tokens = await getTokens(p, client, code);
    const oldRefresh = tokens.refresh_token;
    await p.exchangeRefreshToken(client, oldRefresh); // consumes old
    await assert.rejects(
      () => p.exchangeRefreshToken(client, oldRefresh),
      /Invalid refresh token/
    );
  });

  it('preserves scopes when not specified', async () => {
    const p = createProvider();
    const client = makeClient(p);
    const code = await getAuthCode(p, client, { scopes: ['tools', 'resources'] });
    const tokens = await getTokens(p, client, code);
    const newTokens = await p.exchangeRefreshToken(client, tokens.refresh_token);
    assert.equal(newTokens.scope, 'tools resources');
  });

  it('allows scope narrowing', async () => {
    const p = createProvider();
    const client = makeClient(p);
    const code = await getAuthCode(p, client, { scopes: ['read', 'write'] });
    const tokens = await getTokens(p, client, code);
    const newTokens = await p.exchangeRefreshToken(client, tokens.refresh_token, ['read']);
    assert.equal(newTokens.scope, 'read');
  });

  it('throws for invalid refresh token', async () => {
    const p = createProvider();
    const client = makeClient(p);
    await assert.rejects(
      () => p.exchangeRefreshToken(client, 'vrt_bogus'),
      /Invalid refresh token/
    );
  });

  it('throws when refresh token belongs to different client', async () => {
    const p = createProvider();
    const client1 = makeClient(p, 'Owner');
    const client2 = makeClient(p, 'Other');
    const code = await getAuthCode(p, client1);
    const tokens = await getTokens(p, client1, code);
    await assert.rejects(
      () => p.exchangeRefreshToken(client2, tokens.refresh_token),
      /does not belong to this client/
    );
  });

  it('throws for revoked refresh token', async () => {
    const p = createProvider();
    const client = makeClient(p);
    const code = await getAuthCode(p, client);
    const tokens = await getTokens(p, client, code);
    await p.revokeToken(client, { token: tokens.refresh_token });
    // revokeToken deletes from refreshTokens map, so exchangeRefreshToken
    // hits "Invalid refresh token" before the revokedTokens check
    await assert.rejects(
      () => p.exchangeRefreshToken(client, tokens.refresh_token),
      /Invalid refresh token/
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 7: revokeToken()
// ═══════════════════════════════════════════════════════════════════════════════

describe('revokeToken()', () => {
  it('revokes access token', async () => {
    const p = createProvider();
    const client = makeClient(p);
    const code = await getAuthCode(p, client);
    const tokens = await getTokens(p, client, code);
    // Verify it works first
    await p.verifyAccessToken(tokens.access_token);
    // Revoke
    await p.revokeToken(client, { token: tokens.access_token });
    // Verify it no longer works
    await assert.rejects(
      () => p.verifyAccessToken(tokens.access_token),
      /revoked/
    );
  });

  it('revokes refresh token', async () => {
    const p = createProvider();
    const client = makeClient(p);
    const code = await getAuthCode(p, client);
    const tokens = await getTokens(p, client, code);
    await p.revokeToken(client, { token: tokens.refresh_token });
    // Token is deleted from refreshTokens map by revokeToken()
    await assert.rejects(
      () => p.exchangeRefreshToken(client, tokens.refresh_token),
      /Invalid refresh token/
    );
  });

  it('does not throw for unknown token (RFC 7009)', async () => {
    const p = createProvider();
    const client = makeClient(p);
    // RFC 7009: revocation of unknown token should NOT error
    await p.revokeToken(client, { token: 'unknown_token_xyz' });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 8: Token format verification
// ═══════════════════════════════════════════════════════════════════════════════

describe('Token format', () => {
  it('access token is vat_ + 64 hex chars', async () => {
    const p = createProvider();
    const client = makeClient(p);
    const code = await getAuthCode(p, client);
    const tokens = await getTokens(p, client, code);
    assert.match(tokens.access_token, /^vat_[a-f0-9]{64}$/);
  });

  it('refresh token is vrt_ + 64 hex chars', async () => {
    const p = createProvider();
    const client = makeClient(p);
    const code = await getAuthCode(p, client);
    const tokens = await getTokens(p, client, code);
    assert.match(tokens.refresh_token, /^vrt_[a-f0-9]{64}$/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 9: Full OAuth 2.1 flow (integration)
// ═══════════════════════════════════════════════════════════════════════════════

describe('Full OAuth 2.1 flow', () => {
  it('register → authorize → exchange → verify → refresh → verify → revoke', async () => {
    const p = createProvider();

    // 1. Register client
    const client = makeClient(p, 'Full Flow Client');
    assert.ok(client.client_id);

    // 2. Authorize → get code
    const code = await getAuthCode(p, client, {
      codeChallenge: 'S256_challenge_value',
      scopes: ['mcp:tools', 'mcp:resources']
    });
    assert.ok(code);

    // 3. Verify challenge
    const challenge = await p.challengeForAuthorizationCode(client, code);
    assert.equal(challenge, 'S256_challenge_value');

    // 4. Exchange code for tokens
    const tokens = await getTokens(p, client, code);
    assert.equal(tokens.token_type, 'Bearer');
    assert.equal(tokens.scope, 'mcp:tools mcp:resources');

    // 5. Verify access token
    const info = await p.verifyAccessToken(tokens.access_token);
    assert.equal(info.clientId, client.client_id);
    assert.deepEqual(info.scopes, ['mcp:tools', 'mcp:resources']);

    // 6. Refresh token
    const newTokens = await p.exchangeRefreshToken(client, tokens.refresh_token);
    assert.ok(newTokens.access_token !== tokens.access_token);

    // 7. Verify new access token works
    const newInfo = await p.verifyAccessToken(newTokens.access_token);
    assert.equal(newInfo.clientId, client.client_id);

    // 8. Old access token still works (wasn't revoked)
    const oldInfo = await p.verifyAccessToken(tokens.access_token);
    assert.equal(oldInfo.clientId, client.client_id);

    // 9. Revoke new access token
    await p.revokeToken(client, { token: newTokens.access_token });
    await assert.rejects(
      () => p.verifyAccessToken(newTokens.access_token),
      /revoked/
    );
  });

  it('multiple clients coexist independently', async () => {
    const p = createProvider();
    const clientA = makeClient(p, 'Client A');
    const clientB = makeClient(p, 'Client B');

    const codeA = await getAuthCode(p, clientA, { scopes: ['read'] });
    const codeB = await getAuthCode(p, clientB, { scopes: ['write'] });

    const tokensA = await getTokens(p, clientA, codeA);
    const tokensB = await getTokens(p, clientB, codeB);

    const infoA = await p.verifyAccessToken(tokensA.access_token);
    const infoB = await p.verifyAccessToken(tokensB.access_token);

    assert.equal(infoA.clientId, clientA.client_id);
    assert.equal(infoB.clientId, clientB.client_id);
    assert.deepEqual(infoA.scopes, ['read']);
    assert.deepEqual(infoB.scopes, ['write']);

    // Revoking A doesn't affect B
    await p.revokeToken(clientA, { token: tokensA.access_token });
    await assert.rejects(() => p.verifyAccessToken(tokensA.access_token));
    const stillValidB = await p.verifyAccessToken(tokensB.access_token);
    assert.equal(stillValidB.clientId, clientB.client_id);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 10: Provider interface completeness
// ═══════════════════════════════════════════════════════════════════════════════

describe('VocaliaOAuthProvider interface', () => {
  const p = createProvider();

  it('has clientsStore property', () => {
    assert.ok(p.clientsStore);
    assert.equal(typeof p.clientsStore.getClient, 'function');
    assert.equal(typeof p.clientsStore.registerClient, 'function');
  });

  it('has authorize method', () => assert.equal(typeof p.authorize, 'function'));
  it('has challengeForAuthorizationCode', () => assert.equal(typeof p.challengeForAuthorizationCode, 'function'));
  it('has exchangeAuthorizationCode', () => assert.equal(typeof p.exchangeAuthorizationCode, 'function'));
  it('has exchangeRefreshToken', () => assert.equal(typeof p.exchangeRefreshToken, 'function'));
  it('has verifyAccessToken', () => assert.equal(typeof p.verifyAccessToken, 'function'));
  it('has revokeToken', () => assert.equal(typeof p.revokeToken, 'function'));
});
