import NitroCookies from "react-native-nitro-cookies"
import { useQuery } from "@tanstack/react-query"
import { getRootUrl } from "../utils/rootUrl"

export const useCookie = () => {
	return useQuery({
		queryKey: ["cookie"],
		queryFn: async () => {
			const cookies = await NitroCookies.get(getRootUrl())
			return cookies?.["connect.sid"] ?? null
		},
	})
}
