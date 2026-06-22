import { useServerMutation } from "@/api/client/requests"
import { UserLogin_Variables, UserLoginResponse } from "@/api/generated/endpoint.types"
import { API_ENDPOINTS } from "@/api/generated/endpoints"
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
        endpoint: API_ENDPOINTS.USER.Login.endpoint,
        method: API_ENDPOINTS.USER.Login.methods[0],
        mutationKey: [API_ENDPOINTS.USER.Login.key],
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

export function useUserLogout() {
    const queryClient = useQueryClient()
    const setSessionToken = useSetSessionToken()

    return useServerMutation({
        endpoint: API_ENDPOINTS.USER.Logout.endpoint,
        method: API_ENDPOINTS.USER.Logout.methods[0],
        mutationKey: [API_ENDPOINTS.USER.Logout.key],
        onSuccess: async () => {
            setSessionToken(null)
            toast.success("Logged out of profile")
            await queryClient.invalidateQueries({ queryKey: [API_ENDPOINTS.STATUS.GetStatus.key] })
            await queryClient.invalidateQueries()
        },
    })
}
