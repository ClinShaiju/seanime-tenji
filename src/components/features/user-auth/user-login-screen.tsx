import { useUserLogin } from "@/api/hooks/user-auth.hooks"
import { useSetServerUrl } from "@/atoms/server.atoms"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { IMAGES } from "@/constants/images"
import { toast } from "@/lib/utils/toast"
import { router } from "expo-router"
import * as React from "react"
import { Image, KeyboardAvoidingView, Pressable, Text, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"

// UserLoginScreen is shown on a networked server (one with a server password) when no
// per-user session is present. The server's anon-data hardening gives a password-only
// client an empty session, so the user must sign in here to act as themselves. Mirrors
// the web's UserLoginScreen; rendered inline by ServerDataWrapper (not a route).
export function UserLoginScreen() {
    const { mutate: login, isPending } = useUserLogin()
    const setServerUrl = useSetServerUrl()

    const [username, setUsername] = React.useState("")
    const [password, setPassword] = React.useState("")

    const handleSignIn = React.useCallback(() => {
        const u = username.trim()
        if (!u || !password) {
            toast.error("Enter your username and password", { position: "bottom", visibilityTime: 1000 })
            return
        }
        login({ username: u, password })
    }, [username, password, login])

    return (
        <KeyboardAvoidingView className="flex-1 justify-center bg-background px-4">
            <SafeAreaView
                style={{ flex: 1, justifyContent: "center", alignItems: "center", gap: 10 }}
                edges={["top", "right", "bottom", "left"]}
            >
                <View className="px-6 flex justify-center items-center -top-32">
                    <Image className="w-32 h-32" source={IMAGES.logo2} resizeMode="cover" />
                </View>
                <Card className="w-full p-4 rounded-xl bg-background -top-32">
                    <CardHeader className="items-center">
                        <CardDescription>
                            <Text>Sign in to your Seanime profile.</Text>
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <View className="gap-4">
                            <View className="gap-2">
                                <Label htmlFor="user-login-username" nativeID="user-login-username-label">Username</Label>
                                <Input
                                    nativeID="user-login-username"
                                    className="w-full"
                                    placeholder="Username"
                                    value={username}
                                    onChangeText={setUsername}
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                    textContentType="username"
                                />
                            </View>

                            <View className="gap-2">
                                <Label htmlFor="user-login-password" nativeID="user-login-password-label">Password</Label>
                                <Input
                                    nativeID="user-login-password"
                                    className="w-full"
                                    placeholder="Password"
                                    value={password}
                                    onChangeText={setPassword}
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                    secureTextEntry
                                    textContentType="password"
                                    onSubmitEditing={handleSignIn}
                                />
                            </View>
                        </View>
                    </CardContent>
                    <CardFooter className="flex-col gap-3 pb-0">
                        <Button
                            variant="default"
                            onPress={handleSignIn}
                            disabled={isPending}
                        >
                            <Text>{isPending ? "Signing in..." : "Sign in"}</Text>
                        </Button>
                    </CardFooter>
                </Card>

                <Pressable
                    onPress={() => {
                        setServerUrl(null)
                        router.replace("/(out)/set-server-url")
                    }}
                    className="-top-32 active:opacity-75"
                >
                    <Text className="text-white/40 text-xs font-medium underline">Use a different server</Text>
                </Pressable>
            </SafeAreaView>
        </KeyboardAvoidingView>
    )
}
