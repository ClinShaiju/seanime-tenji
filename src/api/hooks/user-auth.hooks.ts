import { useServerMutation } from "@/api/client/requests"
import { SaveUserDebrid_Variables, UserChangePassword_Variables, UserLogin_Variables } from "@/api/generated/endpoint.types"
import { API_ENDPOINTS } from "@/api/generated/endpoints"
import { UserLoginResponse } from "@/api/generated/types"
import { useSetSessionToken } from "@/atoms/server.atoms"
import { toast } from "@/lib/utils/toast"
import { useQueryClient } from "@tanstack/react-query"

// Multi-user profiles: log in / out as a user (distinct from the AniList login in
// auth.hooks.ts). On success we store the session token, which is then sent as
// `Authorization: Bearer <token>` on every request + as `session` on the /events WS.

export function useUserLogin() {
    const queryClient = useQueryClient()
    const setSessionToken = useSetSessionToken()

    return useServerMutation<UserLoginResponse, UserLogin_Variables>({
        endpoint: API_ENDPOINTS.USER_AUTH.UserLogin.endpoint,
        method: API_ENDPOINTS.USER_AUTH.UserLogin.methods[0],
        mutationKey: [API_ENDPOINTS.USER_AUTH.UserLogin.key],
        onSuccess: async data => {
            if (data?.token) {
                setSessionToken(data.token)
                toast.success("Logged in")
                await queryClient.invalidateQueries({ queryKey: [API_ENDPOINTS.STATUS.GetStatus.key] })
                await queryClient.invalidateQueries()
            }
        },
    })
}

export function useUserChangePassword() {
    return useServerMutation<boolean, UserChangePassword_Variables>({
        endpoint: API_ENDPOINTS.USER_AUTH.UserChangePassword.endpoint,
        method: API_ENDPOINTS.USER_AUTH.UserChangePassword.methods[0],
        mutationKey: [API_ENDPOINTS.USER_AUTH.UserChangePassword.key],
        onSuccess: () => {
            toast.success("Password changed")
        },
    })
}

// Saves the user's debrid override (shared server debrid vs their own provider/key).
// The server writes every field unconditionally, so the form must always submit the
// full shape (see SaveUserDebrid_Variables).
export function useUserSaveDebrid() {
    const queryClient = useQueryClient()

    return useServerMutation<boolean, SaveUserDebrid_Variables>({
        endpoint: API_ENDPOINTS.USER_AUTH.SaveUserDebrid.endpoint,
        method: API_ENDPOINTS.USER_AUTH.SaveUserDebrid.methods[0],
        mutationKey: [API_ENDPOINTS.USER_AUTH.SaveUserDebrid.key],
        onSuccess: async () => {
            toast.success("Debrid settings saved")
            await queryClient.invalidateQueries({ queryKey: [API_ENDPOINTS.STATUS.GetStatus.key] })
        },
    })
}

export function useUserLogout() {
    const queryClient = useQueryClient()
    const setSessionToken = useSetSessionToken()

    return useServerMutation({
        endpoint: API_ENDPOINTS.USER_AUTH.UserLogout.endpoint,
        method: API_ENDPOINTS.USER_AUTH.UserLogout.methods[0],
        mutationKey: [API_ENDPOINTS.USER_AUTH.UserLogout.key],
        onSuccess: async () => {
            setSessionToken(null)
            toast.success("Logged out of profile")
            await queryClient.invalidateQueries({ queryKey: [API_ENDPOINTS.STATUS.GetStatus.key] })
            await queryClient.invalidateQueries()
        },
    })
}
