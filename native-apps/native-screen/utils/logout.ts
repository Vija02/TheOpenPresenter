import NitroCookies from "react-native-nitro-cookies"
import { router } from "expo-router"
import { queryClient } from "./queryClient"
import { clearRootUrl, clearAutoLogin } from "./rootUrl"

export const logout = async () => {
	await NitroCookies.clearAll()
	await clearRootUrl()
	await clearAutoLogin()
	queryClient.clear()

	router.replace("/")
}
