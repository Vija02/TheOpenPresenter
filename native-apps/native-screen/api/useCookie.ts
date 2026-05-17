import NitroCookies from "react-native-nitro-cookies"
import { useQuery } from "@tanstack/react-query"
import { getRootUrl, isAutoLogin } from "../utils/rootUrl"

// Fake cookie object for auto-login mode
const AUTO_LOGIN_COOKIE = { name: "auto-login", value: "true" }

export const useCookie = () => {
	return useQuery({
		queryKey: ["cookie"],
		queryFn: async () => {
			// If auto-login mode is enabled, return a fake cookie
			if (isAutoLogin()) {
				return AUTO_LOGIN_COOKIE
			}
			
			const cookies = await NitroCookies.get(getRootUrl())
			return cookies?.["connect.sid"] ?? null
		},
	})
}
