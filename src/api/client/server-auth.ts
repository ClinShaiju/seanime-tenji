import { getClientHeaders } from "@/api/client/client-identity"
import { getStoredServerAuthToken, getStoredSessionToken } from "@/atoms/server.atoms"
import * as CryptoJS from "crypto-js"

type TokenClaims = {
    endpoint: string
    iat: number
    exp: number
}

class HMACAuth {
    constructor(
        private readonly secret: string,
        private readonly ttlSeconds: number,
    ) {}

    generateToken(endpoint: string): string {
        const now = Math.floor(Date.now() / 1000)
        const claims: TokenClaims = {
            endpoint,
            iat: now,
            exp: now + this.ttlSeconds,
        }

        const claimsJson = JSON.stringify(claims)
        const claimsBase64 = CryptoJS.enc.Base64.stringify(CryptoJS.enc.Utf8.parse(claimsJson))
            .replace(/\+/g, "-")
            .replace(/\//g, "_")
            .replace(/=+$/g, "")

        const signature = CryptoJS.enc.Base64.stringify(CryptoJS.HmacSHA256(claimsBase64, this.secret))
            .replace(/\+/g, "-")
            .replace(/\//g, "_")
            .replace(/=+$/g, "")

        return `${claimsBase64}.${signature}`
    }

    generateQueryParam(endpoint: string, symbol: string = "?"): string {
        return `${symbol}token=${encodeURIComponent(this.generateToken(endpoint))}`
    }
}

function resolveAuthToken(authToken?: string | null) {
    return authToken ?? getStoredServerAuthToken() ?? null
}

export function hashServerPassword(password: string) {
    return CryptoJS.SHA256(password).toString(CryptoJS.enc.Hex)
}

export function getServerAuthHeaders(authToken?: string | null): Record<string, string> {
    const resolvedToken = resolveAuthToken(authToken)
    const headers: Record<string, string> = { ...getClientHeaders() }

    // Per-user session (multi-user profiles): identifies the acting user. The server
    // password (X-Seanime-Token) only passes the network gate; this is what makes the
    // request act as a logged-in user against the hardened server.
    const sessionToken = getStoredSessionToken()
    if (sessionToken) {
        headers["Authorization"] = `Bearer ${sessionToken}`
    }

    if (resolvedToken) {
        headers["X-Seanime-Token"] = resolvedToken
    }

    return headers
}

export function getServerHMACToken(endpoint: string, authToken?: string | null): string {
    const resolvedToken = resolveAuthToken(authToken)
    if (!resolvedToken) return ""

    return new HMACAuth(resolvedToken, 24 * 60 * 60).generateToken(endpoint)
}

export function getServerHMACTokenQueryParam(
    endpoint: string,
    symbol: string = "?",
    authToken?: string | null,
): string {
    const resolvedToken = resolveAuthToken(authToken)
    if (!resolvedToken) return ""

    return new HMACAuth(resolvedToken, 24 * 60 * 60).generateQueryParam(endpoint, symbol)
}

export function appendServerHMACToken(url: string, endpoint: string, authToken?: string | null): string {
    const tokenQuery = getServerHMACTokenQueryParam(endpoint, url.includes("?") ? "&" : "?", authToken)
    if (!tokenQuery) return url

    return `${url}${tokenQuery}`
}
