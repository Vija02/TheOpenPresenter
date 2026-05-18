import NitroCookies from "react-native-nitro-cookies"
import { router } from "expo-router"
import { queryClient } from "./queryClient"
import { clearRootUrl } from "./rootUrl"
import { clearScreen } from "./screen"

export const logout = async () => {
	await NitroCookies.clearAll()
	await clearRootUrl()
	await clearScreen()
	queryClient.clear()

	router.replace("/")
}
