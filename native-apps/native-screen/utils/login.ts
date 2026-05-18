import NitroCookies from "react-native-nitro-cookies"
import { router } from "expo-router"
import { queryClient } from "./queryClient"
import { getRootUrl, setRootUrl } from "./rootUrl"

export const login = async (
	setCookieHeader: string,
	rootUrl?: string,
	redirectTo: string = "/",
) => {
	const url = rootUrl ?? getRootUrl()

	// Save the root URL if provided
	if (rootUrl) {
		await setRootUrl(rootUrl)
	}

	await NitroCookies.setFromResponse(url, setCookieHeader)

	queryClient.clear()

	router.replace(redirectTo)
}
