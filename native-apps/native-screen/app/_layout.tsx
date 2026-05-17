import { QueryClientProvider } from "@tanstack/react-query"
import { Slot } from "expo-router"
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context"
import { queryClient } from "../utils/queryClient"
import { useKeepAwake } from "expo-keep-awake"
import ToastManager from "toastify-react-native"
import { ApolloProvider } from "@apollo/client"
import { apolloClient, recreateApolloClient, onApolloClientChange } from "../utils/apollo"
import { useEffect, useState } from "react"
import { initRootUrl, initAutoLogin } from "../utils/rootUrl"
import { View, Text } from "react-native"

export default function Layout() {
	useKeepAwake()
	const [isReady, setIsReady] = useState(false)
	const [currentApolloClient, setCurrentApolloClient] = useState(apolloClient)

	useEffect(() => {
		Promise.all([initRootUrl(), initAutoLogin()]).then(() => {
			// Recreate Apollo client after root URL is initialized from storage
			const newClient = recreateApolloClient()
			setCurrentApolloClient(newClient)
			setIsReady(true)
		})
	}, [])

	// Listen for Apollo client recreation (e.g. after auto-login changes the root URL)
	useEffect(() => {
		return onApolloClientChange((newClient) => {
			setCurrentApolloClient(newClient)
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
			<ApolloProvider client={currentApolloClient}>
				<SafeAreaProvider>
					<SafeAreaView style={{ flex: 1 }}>
						<Slot />
						<ToastManager />
					</SafeAreaView>
				</SafeAreaProvider>
			</ApolloProvider>
		</QueryClientProvider>
	)
}
