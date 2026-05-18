import { router } from "expo-router"
import { useCallback, useEffect, useRef, useState } from "react"
import {
	BackHandler,
	Pressable,
	StyleSheet,
	Text,
	View,
} from "react-native"
import { RFValue } from "react-native-responsive-fontsize"
import { WebView } from "react-native-webview"
import { useCookie } from "../api/useCookie"
import { logout } from "../utils/logout"
import { getRootUrl } from "../utils/rootUrl"
import { getScreen } from "../utils/screen"

export default function Screen() {
	const { data: cookie, isLoading } = useCookie()
	const screen = getScreen()
	const webViewRef = useRef<WebView>(null)
	const [menuOpen, setMenuOpen] = useState(false)

	useEffect(() => {
		if (isLoading) return
		if (!cookie || !screen) {
			router.replace("/")
		}
	}, [cookie, isLoading, screen])

	// Intercept the hardware back / TV menu button: open menu if closed, close if open.
	useEffect(() => {
		const sub = BackHandler.addEventListener("hardwareBackPress", () => {
			setMenuOpen((open) => !open)
			return true // we've handled it; don't let RN navigate back
		})
		return () => sub.remove()
	}, [])

	const handleRefresh = useCallback(() => {
		setMenuOpen(false)
		webViewRef.current?.reload()
	}, [])

	const handleLogout = useCallback(() => {
		setMenuOpen(false)
		logout()
	}, [])

	const handleExit = useCallback(() => {
		setMenuOpen(false)
		BackHandler.exitApp()
	}, [])

	if (!cookie || !screen) {
		return null
	}

	return (
		<View style={styles.container}>
			<WebView
				ref={webViewRef}
				source={{
					uri: `${getRootUrl()}/render/s/${screen.orgSlug}/${screen.screenSlug}`,
				}}
				injectedJavaScriptBeforeContentLoaded={`
				  window.onerror = function(message, sourcefile, lineno, colno, error) {
				    alert("Message: " + message + " - Source: " + sourcefile + " Line: " + lineno + ":" + colno);
				    return true;
				  };
				`}
				allowsInlineMediaPlayback
				mediaPlaybackRequiresUserAction={false}
				webviewDebuggingEnabled
				sharedCookiesEnabled
				userAgent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/77.0.3865.90 Safari/537.36"
				mixedContentMode="always"
				androidLayerType="hardware"
				domStorageEnabled={true}
			/>

			{menuOpen && (
				<Pressable
					style={styles.menuBackdrop}
					onPress={() => setMenuOpen(false)}
				>
					<Pressable style={styles.menuCard} onPress={(e) => e.stopPropagation()}>
						<Text style={styles.menuTitle}>Menu</Text>

						<MenuButton label="Refresh page" onPress={handleRefresh} autoFocus />
						<MenuButton label="Logout" onPress={handleLogout} variant="danger" />
						<MenuButton label="Exit app" onPress={handleExit} variant="danger" />
						<MenuButton label="Cancel" onPress={() => setMenuOpen(false)} variant="ghost" />
					</Pressable>
				</Pressable>
			)}
		</View>
	)
}

type MenuButtonProps = {
	label: string
	onPress: () => void
	autoFocus?: boolean
	variant?: "primary" | "danger" | "ghost"
}

function MenuButton({ label, onPress, autoFocus, variant = "primary" }: MenuButtonProps) {
	const ref = useRef<View>(null)

	useEffect(() => {
		if (autoFocus) {
			// @ts-ignore – TV-only API exposed by react-native-tvos
			ref.current?.requestTVFocus?.()
		}
	}, [autoFocus])

	return (
		<Pressable
			ref={ref as any}
			onPress={onPress}
			hasTVPreferredFocus={autoFocus}
			style={({ focused, pressed }) => [
				styles.menuButton,
				variant === "danger" && styles.menuButtonDanger,
				variant === "ghost" && styles.menuButtonGhost,
				(focused || pressed) && styles.menuButtonFocused,
				(focused || pressed) && variant === "danger" && styles.menuButtonDangerFocused,
			]}
		>
			<Text
				style={[
					styles.menuButtonText,
					variant === "ghost" && styles.menuButtonTextGhost,
				]}
			>
				{label}
			</Text>
		</Pressable>
	)
}

const styles = StyleSheet.create({
	container: { height: "100%" },
	menuBackdrop: {
		...StyleSheet.absoluteFillObject,
		backgroundColor: "rgba(0,0,0,0.6)",
		alignItems: "center",
		justifyContent: "center",
	},
	menuCard: {
		minWidth: 360,
		backgroundColor: "#1c1c1c",
		borderRadius: 12,
		padding: 20,
		gap: 10,
	},
	menuTitle: {
		color: "#fff",
		fontSize: RFValue(14),
		fontWeight: "bold",
		marginBottom: 12,
		textAlign: "center",
	},
	menuButton: {
		backgroundColor: "#2a2a2a",
		borderRadius: 8,
		paddingVertical: 14,
		paddingHorizontal: 20,
		borderWidth: 2,
		borderColor: "transparent",
	},
	menuButtonFocused: {
		backgroundColor: "#0a84ff",
		borderColor: "#fff",
	},
	menuButtonDanger: {
		backgroundColor: "#3a1414",
	},
	menuButtonDangerFocused: {
		backgroundColor: "#cc2222",
		borderColor: "#fff",
	},
	menuButtonGhost: {
		backgroundColor: "transparent",
	},
	menuButtonText: {
		color: "#fff",
		fontSize: RFValue(10),
		textAlign: "center",
	},
	menuButtonTextGhost: {
		color: "#aaa",
	},
})
