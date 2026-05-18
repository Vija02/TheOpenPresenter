import { QueryClientProvider } from "@tanstack/react-query"
import { useKeepAwake } from "expo-keep-awake"
import { Slot } from "expo-router"
import { useEffect, useState } from "react"
import { Text, View } from "react-native"
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context"
import ToastManager from "toastify-react-native"
import { queryClient } from "../utils/queryClient"
import { initRootUrl } from "../utils/rootUrl"
import { initScreen } from "../utils/screen"

export default function Layout() {
	useKeepAwake()
	const [isReady, setIsReady] = useState(false)

	useEffect(() => {
		Promise.all([initRootUrl(), initScreen()]).then(() => {
			setIsReady(true)
		})
	}, [])

	if (!isReady) {
		return (
			<View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
				<Text>Loading...</Text>
			</View>
		)
	}

	return (
		<QueryClientProvider client={queryClient}>
			<SafeAreaProvider>
				<SafeAreaView style={{ flex: 1 }}>
					<Slot />
					<ToastManager />
				</SafeAreaView>
			</SafeAreaProvider>
		</QueryClientProvider>
	)
}
