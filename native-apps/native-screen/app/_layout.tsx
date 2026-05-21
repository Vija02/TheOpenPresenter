import { QueryClientProvider } from "@tanstack/react-query"
import { useKeepAwake } from "expo-keep-awake"
import { Slot } from "expo-router"
import * as SplashScreen from "expo-splash-screen"
import { useCallback, useEffect, useState } from "react"
import { View } from "react-native"
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context"
import ToastManager from "toastify-react-native"
import { queryClient } from "../utils/queryClient"
import { initRootUrl } from "../utils/rootUrl"
import { initScreen } from "../utils/screen"

// Keep the native splash on screen until our async init finishes.
SplashScreen.preventAutoHideAsync().catch(() => {
	/* ignore — safe if called more than once */
})

export default function Layout() {
	useKeepAwake()
	const [isReady, setIsReady] = useState(false)

	useEffect(() => {
		Promise.all([initRootUrl(), initScreen()]).then(() => {
			setIsReady(true)
		})
	}, [])

	const onLayoutRootView = useCallback(() => {
		if (isReady) {
			SplashScreen.hideAsync().catch(() => {
				/* ignore — already hidden */
			})
		}
	}, [isReady])

	if (!isReady) {
		return null
	}

	return (
		<View style={{ flex: 1 }} onLayout={onLayoutRootView}>
			<QueryClientProvider client={queryClient}>
				<SafeAreaProvider>
					<SafeAreaView style={{ flex: 1 }}>
						<Slot />
						<ToastManager />
					</SafeAreaView>
				</SafeAreaProvider>
			</QueryClientProvider>
		</View>
	)
}
