import { createJSONStorage } from "jotai/utils"
import { createMMKV } from "react-native-mmkv"

const storage = createMMKV({ id: "seanime-mobile" })

const stringStorage = {
    getItem: (key: string) => storage.getString(key) ?? null,
    setItem: (key: string, value: string) => {
        storage.set(key, value)
    },
    removeItem: (key: string) => {
        storage.remove(key)
    },
    subscribe: (key: string, callback: (value: string | null) => void) => {
        const listener = storage.addOnValueChangedListener(changedKey => {
            if (changedKey === key) {
                callback(storage.getString(key) ?? null)
            }
        })

        return () => {
            listener.remove()
        }
    },
}

export function createAtomStorage<Value>() {
    return createJSONStorage<Value>(() => stringStorage)
}

export function getStoredString(key: string) {
    return storage.getString(key) ?? null
}

export function setStoredString(key: string, value: string) {
    storage.set(key, value)
}

export function removeStoredKey(key: string) {
    storage.remove(key)
}

export function getStoredJsonValue<Value>(key: string): Value | null {
    const value = storage.getString(key)
    if (value == null) return null

    try {
        return JSON.parse(value) as Value
    }
    catch {
        return null
    }
}

export const THEME_STORAGE_KEY = "theme"

export function getStoredTheme() {
    const value = storage.getString(THEME_STORAGE_KEY)
    return value === "light" || value === "dark" ? value : null
}

export function setStoredTheme(theme: "light" | "dark") {
    storage.set(THEME_STORAGE_KEY, theme)
}
