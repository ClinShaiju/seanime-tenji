import { getStoredString, removeStoredKey } from "@/atoms/storage"
import * as SecureStore from "expo-secure-store"

/**
 * Secure at-rest storage for the two bearer credentials (server-password auth token +
 * per-user session token). Both are long-lived, full-account credentials, so they must
 * NOT sit in the plaintext MMKV file (readable from an unencrypted device backup or a
 * jailbroken device). They live in the iOS Keychain via expo-secure-store instead.
 *
 * The Keychain API is async, but the request layer reads these tokens synchronously on
 * every call (getServerAuthHeaders / HMAC signing). We bridge that with a synchronous
 * in-memory mirror: reads hit the mirror; writes update the mirror immediately and
 * write through to the Keychain asynchronously. The mirror is populated by
 * `hydrateSecureTokens()`, which must run once at startup before authenticated requests.
 *
 * Values are stored JSON-encoded to stay wire-compatible with the previous
 * createJSONStorage(MMKV) format, so a one-time migration can move existing tokens over
 * verbatim.
 */

// The Keychain persists at rest but stays available while the device is unlocked, which
// matches how these tokens are used (foreground playback + API calls).
const SECURE_OPTS: SecureStore.SecureStoreOptions = {
    keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
}

// Synchronous mirror of the JSON-encoded values, keyed by storage key.
const memoryCache: Record<string, string | null> = {}

// atomWithStorage subscribers, so a late async hydrate updates any mounted atom.
type Listener = (value: string | null) => void
const listeners: Record<string, Set<Listener>> = {}

function notify(key: string, value: string | null) {
    listeners[key]?.forEach(cb => {
        try {
            cb(value)
        } catch {
            // a subscriber throwing must not stop the others
        }
    })
}

/**
 * jotai-compatible string storage backed by the sync mirror + async Keychain.
 * Wrap with createJSONStorage(() => secureStringStorage).
 */
export const secureStringStorage = {
    getItem: (key: string): string | null => memoryCache[key] ?? null,
    setItem: (key: string, value: string) => {
        memoryCache[key] = value
        notify(key, value)
        // Fire-and-forget: the mirror is already authoritative for this session.
        SecureStore.setItemAsync(key, value, SECURE_OPTS).catch(() => {})
    },
    removeItem: (key: string) => {
        memoryCache[key] = null
        notify(key, null)
        SecureStore.deleteItemAsync(key, SECURE_OPTS).catch(() => {})
    },
    subscribe: (key: string, callback: Listener) => {
        ;(listeners[key] ??= new Set()).add(callback)
        return () => listeners[key]?.delete(callback)
    },
}

/** Synchronous read of the raw JSON-encoded value (mirror). */
export function getSecureStoredString(key: string): string | null {
    return memoryCache[key] ?? null
}

async function hydrateOne(key: string) {
    let value: string | null = null
    try {
        value = await SecureStore.getItemAsync(key, SECURE_OPTS)
    } catch {
        value = null
    }

    // One-time migration: an existing user still has the token in plaintext MMKV.
    if (value == null) {
        const legacy = getStoredString(key)
        if (legacy != null) {
            value = legacy
            try {
                await SecureStore.setItemAsync(key, legacy, SECURE_OPTS)
                // Only scrub the plaintext copy once it's safely in the Keychain.
                removeStoredKey(key)
            } catch {
                // Keychain write failed — keep the MMKV copy so the user isn't logged out.
            }
        }
    }

    memoryCache[key] = value
    notify(key, value)
}

let hydrated = false

/**
 * Populate the sync mirror from the Keychain (migrating any legacy plaintext token).
 * Idempotent; call once at app startup before authenticated requests fire.
 */
export async function hydrateSecureTokens(keys: string[]): Promise<void> {
    if (hydrated) return
    hydrated = true
    await Promise.all(keys.map(hydrateOne))
}
