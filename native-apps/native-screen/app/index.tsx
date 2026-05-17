import { router, useRootNavigationState } from "expo-router"
import { useEffect } from "react"
import { Text, View } from "react-native"
import { useCookie } from "../api/useCookie"

export default function App() {
	const { data: cookie, isLoading } = useCookie()

	const navigationState = useRootNavigationState()
	useEffect(() => {
		if (!navigationState?.key || isLoading) {
			return
		}

		if (cookie) {
			router.replace("/dashboard")
		} else {
			router.replace("/login")
		}
	}, [cookie, isLoading, navigationState])

	return (
		<View>
			<Text>Redirecting...</Text>
		</View>
	)
}
