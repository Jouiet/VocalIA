/**
 * VocalIA OAuth 2.1 Provider — In-Memory Implementation
 *
 * Implements OAuthServerProvider from @modelcontextprotocol/sdk for the
 * Streamable HTTP transport. Supports:
 * - Dynamic client registration (RFC 7591)
 * - Authorization code flow with PKCE (RFC 7636)
 * - Token exchange and refresh
 * - Token revocation (RFC 7009)
 *
 * Storage: In-memory (suitable for single-instance deployment).
 * For multi-instance, replace with Redis/DB-backed stores.
 *
 * Session 250.172 — Phase 4.2
 */

import { randomUUID, randomBytes } from "crypto";
import type { Response } from "express";
import type { OAuthServerProvider, AuthorizationParams } from "@modelcontextprotocol/sdk/server/auth/provider.js";
import type { OAuthRegisteredClientsStore } from "@modelcontextprotocol/sdk/server/auth/clients.js";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import type {
  OAuthClientInformationFull,
  OAuthTokenRevocationRequest,
  OAuthTokens,
} from "@modelcontextprotocol/sdk/shared/auth.js";

// =============================================================================
// TYPES
// =============================================================================

interface StoredAuthCode {
  code: string;
  clientId: string;
  codeChallenge: string;
  redirectUri: string;
  scopes: string[];
  expiresAt: number;
}

interface StoredToken {
  token: string;
  clientId: string;
  scopes: string[];
  expiresAt: number;
  refreshToken?: string;
}

// =============================================================================
// IN-MEMORY STORES
// =============================================================================

const clients = new Map<string, OAuthClientInformationFull>();
const authCodes = new Map<string, StoredAuthCode>();
const accessTokens = new Map<string, StoredToken>();
const refreshTokens = new Map<string, StoredToken>();
const revokedTokens = new Set<string>();

// =============================================================================
// CLIENT STORE
// =============================================================================

class VocaliaClientsStore implements OAuthRegisteredClientsStore {
  getClient(clientId: string): OAuthClientInformationFull | undefined {
    return clients.get(clientId);
  }

  registerClient(
    client: Omit<OAuthClientInformationFull, "client_id" | "client_id_issued_at">
  ): OAuthClientInformationFull {
    const clientId = `vocalia_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
    const clientSecret = randomBytes(32).toString("hex");
    const now = Math.floor(Date.now() / 1000);

    const registered: OAuthClientInformationFull = {
      ...client,
      client_id: clientId,
      client_secret: clientSecret,
      client_id_issued_at: now,
      client_secret_expires_at: now + 365 * 24 * 3600, // 1 year
    };

    clients.set(clientId, registered);
    console.error(`✅ OAuth client registered: ${clientId}`);
    return registered;
  }
}

// =============================================================================
// TOKEN HELPERS
// =============================================================================

function generateAccessToken(): string {
  return `vat_${randomBytes(32).toString("hex")}`;
}

function generateRefreshToken(): string {
  return `vrt_${randomBytes(32).toString("hex")}`;
}

// =============================================================================
// OAUTH SERVER PROVIDER
// =============================================================================

export class VocaliaOAuthProvider implements OAuthServerProvider {
  private _clientsStore = new VocaliaClientsStore();

  get clientsStore(): OAuthRegisteredClientsStore {
    return this._clientsStore;
  }

  /**
   * Handle authorization request — generates auth code and redirects.
   * In a real deployment, this would show a login page.
   * For MCP (machine-to-machine), we auto-approve and redirect with code.
   */
  async authorize(
    client: OAuthClientInformationFull,
    params: AuthorizationParams,
    res: Response
  ): Promise<void> {
    const code = randomBytes(16).toString("hex");
    const now = Math.floor(Date.now() / 1000);

    authCodes.set(code, {
      code,
      clientId: client.client_id,
      codeChallenge: params.codeChallenge,
      redirectUri: params.redirectUri,
      scopes: params.scopes || [],
      expiresAt: now + 600, // 10 minutes
    });

    // Build redirect URL with auth code
    const redirectUrl = new URL(params.redirectUri);
    redirectUrl.searchParams.set("code", code);
    if (params.state) {
      redirectUrl.searchParams.set("state", params.state);
    }

    res.redirect(302, redirectUrl.toString());
  }

  /**
   * Return the code challenge for a given authorization code.
   */
  async challengeForAuthorizationCode(
    client: OAuthClientInformationFull,
    authorizationCode: string
  ): Promise<string> {
    const stored = authCodes.get(authorizationCode);
    if (!stored) {
      throw new Error("Invalid authorization code");
    }
    if (stored.clientId !== client.client_id) {
      throw new Error("Authorization code does not belong to this client");
    }
    const now = Math.floor(Date.now() / 1000);
    if (stored.expiresAt < now) {
      authCodes.delete(authorizationCode);
      throw new Error("Authorization code expired");
    }
    return stored.codeChallenge;
  }

  /**
   * Exchange authorization code for tokens.
   */
  async exchangeAuthorizationCode(
    client: OAuthClientInformationFull,
    authorizationCode: string,
    _codeVerifier?: string,
    _redirectUri?: string,
    _resource?: URL
  ): Promise<OAuthTokens> {
    const stored = authCodes.get(authorizationCode);
    if (!stored) {
      throw new Error("Invalid authorization code");
    }

    // Consume the code (one-time use)
    authCodes.delete(authorizationCode);

    const now = Math.floor(Date.now() / 1000);
    if (stored.expiresAt < now) {
      throw new Error("Authorization code expired");
    }
    if (stored.clientId !== client.client_id) {
      throw new Error("Client mismatch");
    }

    return this._issueTokens(client.client_id, stored.scopes);
  }

  /**
   * Exchange refresh token for new access token.
   */
  async exchangeRefreshToken(
    client: OAuthClientInformationFull,
    refreshToken: string,
    scopes?: string[],
    _resource?: URL
  ): Promise<OAuthTokens> {
    const stored = refreshTokens.get(refreshToken);
    if (!stored) {
      throw new Error("Invalid refresh token");
    }
    if (stored.clientId !== client.client_id) {
      throw new Error("Refresh token does not belong to this client");
    }
    if (revokedTokens.has(refreshToken)) {
      throw new Error("Refresh token has been revoked");
    }

    // Revoke old refresh token (rotation)
    refreshTokens.delete(refreshToken);

    const finalScopes = scopes && scopes.length > 0 ? scopes : stored.scopes;
    return this._issueTokens(client.client_id, finalScopes);
  }

  /**
   * Verify an access token and return auth info.
   */
  async verifyAccessToken(token: string): Promise<AuthInfo> {
    if (revokedTokens.has(token)) {
      throw new Error("Token has been revoked");
    }

    const stored = accessTokens.get(token);
    if (!stored) {
      throw new Error("Invalid access token");
    }

    const now = Math.floor(Date.now() / 1000);
    if (stored.expiresAt < now) {
      accessTokens.delete(token);
      throw new Error("Access token expired");
    }

    return {
      token: stored.token,
      clientId: stored.clientId,
      scopes: stored.scopes,
      expiresAt: stored.expiresAt,
    };
  }

  /**
   * Revoke an access or refresh token.
   */
  async revokeToken(
    _client: OAuthClientInformationFull,
    request: OAuthTokenRevocationRequest
  ): Promise<void> {
    const token = request.token;
    revokedTokens.add(token);
    accessTokens.delete(token);
    refreshTokens.delete(token);
  }

  /**
   * Issue a new access + refresh token pair.
   */
  private _issueTokens(clientId: string, scopes: string[]): OAuthTokens {
    const now = Math.floor(Date.now() / 1000);
    const accessToken = generateAccessToken();
    const refreshToken = generateRefreshToken();

    const accessExpiry = now + 3600; // 1 hour
    const refreshExpiry = now + 30 * 24 * 3600; // 30 days

    accessTokens.set(accessToken, {
      token: accessToken,
      clientId,
      scopes,
      expiresAt: accessExpiry,
    });

    refreshTokens.set(refreshToken, {
      token: refreshToken,
      clientId,
      scopes,
      expiresAt: refreshExpiry,
    });

    return {
      access_token: accessToken,
      token_type: "Bearer",
      expires_in: 3600,
      refresh_token: refreshToken,
      scope: scopes.join(" "),
    };
  }
}

// =============================================================================
// TOKEN CLEANUP (prevent unbounded memory growth)
// =============================================================================

const CLEANUP_INTERVAL = 15 * 60 * 1000; // 15 minutes

const cleanupTimer = setInterval(() => {
  const now = Math.floor(Date.now() / 1000);
  let cleaned = 0;

  for (const [key, stored] of authCodes) {
    if (stored.expiresAt < now) { authCodes.delete(key); cleaned++; }
  }
  for (const [key, stored] of accessTokens) {
    if (stored.expiresAt < now) { accessTokens.delete(key); cleaned++; }
  }
  for (const [key, stored] of refreshTokens) {
    if (stored.expiresAt < now) { refreshTokens.delete(key); cleaned++; }
  }

  if (cleaned > 0) {
    console.error(`🧹 OAuth cleanup: ${cleaned} expired entries removed`);
  }
}, CLEANUP_INTERVAL);

// Prevent cleanup timer from blocking process exit
cleanupTimer.unref();
