import { Nullish } from "@/api/generated/types"

export const __DEV_SERVER_PORT = 43000

export function devOrProd<T>(dev: T, prod: T): T {
    return prod
    // return process.env.NODE_ENV === "development" ? dev : prod
}

export function getServerBaseUrl(serverUrl: Nullish<string>, removeProtocol: boolean = false): string {
    if (!serverUrl) return ""
    let ret = devOrProd(`http://10.0.0.127:${__DEV_SERVER_PORT}`, serverUrl)
    if (removeProtocol) {
        ret = ret.replace(/^https?:\/\//, "")
    }
    return ret
}
