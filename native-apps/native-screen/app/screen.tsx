import { Ionicons } from "@expo/vector-icons"
import { router } from "expo-router"
import { useCallback, useEffect, useRef, useState } from "react"
import {
	BackHandler,
	Dimensions,
	Pressable,
	StyleSheet,
	Text,
	View,
} from "react-native"
import QRCode from "react-native-qrcode-svg"
import { RFValue } from "react-native-responsive-fontsize"
import { WebView } from "react-native-webview"
import { useCookie } from "../api/useCookie"
import { fetchScreenCode } from "../utils/fetchScreenCode"
import { logout } from "../utils/logout"
import { getRootUrl } from "../utils/rootUrl"
import { getScreen } from "../utils/screen"

type Variant = "primary" | "warning" | "danger"

const VARIANT_ACCENT: Record<Variant, string> = {
	primary: "#0a84ff",
	warning: "#ff9f0a",
	danger: "#ff453a",
}

export default function Screen() {
	const { data: cookie, isLoading } = useCookie()
	const screen = getScreen()
	const webViewRef = useRef<WebView>(null)
	const [menuOpen, setMenuOpen] = useState(false)
	const [qrOpen, setQrOpen] = useState(false)
	const [screenCode, setScreenCode] = useState<string | null>(null)

	useEffect(() => {
		if (!qrOpen || screenCode || !screen) return
		fetchScreenCode(getRootUrl(), screen.orgSlug, screen.screenSlug).then(
			setScreenCode,
		)
	}, [qrOpen, screenCode, screen])

	useEffect(() => {
		if (isLoading) return
		if (!cookie || !screen) {
			router.replace("/")
		}
	}, [cookie, isLoading, screen])

	// Intercept the hardware back / TV menu button.
	// Priority: close QR > close menu > open menu.
	useEffect(() => {
		const sub = BackHandler.addEventListener("hardwareBackPress", () => {
			setQrOpen((qr) => {
				if (qr) return false
				setMenuOpen((open) => !open)
				return false
			})
			return true // we've handled it; don't let RN navigate back
		})
		return () => sub.remove()
	}, [])

	const handleRefresh = useCallback(() => {
		setMenuOpen(false)
		webViewRef.current?.reload()
	}, [])

	const handleShowQr = useCallback(() => {
		setMenuOpen(false)
		setQrOpen(true)
	}, [])

	const handleLogout = useCallback(() => {
		setMenuOpen(false)
		logout()
	}, [])

	const handleExit = useCallback(() => {
		setMenuOpen(false)
		BackHandler.exitApp()
	}, [])

	const controlUrl = screen
		? `${getRootUrl()}/o/${screen.orgSlug}/screens/${screen.screenSlug}/control`
		: ""
	const connectHost = `${getRootUrl().replace(/^https?:\/\//, "")}/connect`

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
						<View style={styles.menuHeader}>
							<Text style={styles.menuTitle}>Menu</Text>
							<Text style={styles.menuSubtitle}>Choose an action</Text>
						</View>

						<View style={styles.menuList}>
							<MenuRow
								icon="refresh"
								label="Refresh page"
								description="Reload the screen content"
								onPress={handleRefresh}
								autoFocus
							/>
							<MenuRow
								icon="qr-code-outline"
								label="Open controller"
								description="Show QR code to control this screen from your phone"
								onPress={handleShowQr}
							/>
							<MenuRow
								icon="log-out-outline"
								label="Sign out"
								description="Disconnect this screen from your account"
								onPress={handleLogout}
								variant="warning"
							/>
							<MenuRow
								icon="power-outline"
								label="Exit app"
								description="Close TheOpenPresenter TV"
								onPress={handleExit}
								variant="danger"
							/>
						</View>

						<Text style={styles.menuHint}>Press Back to close</Text>
					</Pressable>
				</Pressable>
			)}

			{qrOpen && (
				<Pressable
					style={styles.menuBackdrop}
					onPress={() => setQrOpen(false)}
				>
					<Pressable
						style={styles.qrCard}
						onPress={(e) => e.stopPropagation()}
					>
						<View style={styles.qrHeader}>
							<View
								style={[
									styles.menuRowIcon,
									{ backgroundColor: "rgba(10,132,255,0.18)" },
								]}
							>
								<Ionicons
									name="qr-code-outline"
									size={RFValue(16)}
									color="#0a84ff"
								/>
							</View>
							<View style={{ flex: 1 }}>
								<Text style={styles.menuTitle}>Open controller</Text>
								<Text style={styles.menuSubtitle}>
									Scan with your phone to control this screen
								</Text>
							</View>
						</View>

						<View style={styles.qrFrame}>
							<QRCode size={getQrSize()} value={controlUrl} />
						</View>

						{screenCode && (
							<View style={styles.codeBlock}>
								<Text style={styles.codeEyebrow}>OR ENTER CODE</Text>
								<Text style={styles.codeConnectHost}>
									Go to <Text style={styles.codeConnectHostMono}>{connectHost}</Text>
								</Text>
								<View style={styles.codeRow}>
									<Text style={styles.codeLabel}>CODE</Text>
									<View style={styles.codeDigits}>
										{screenCode.split("").map((digit, i) => (
											<View key={i} style={styles.codeDigit}>
												<Text style={styles.codeDigitText}>{digit}</Text>
											</View>
										))}
									</View>
								</View>
							</View>
						)}

						<Text style={styles.menuHint}>Press Back to close</Text>
					</Pressable>
				</Pressable>
			)}
		</View>
	)
}

function getQrSize(): number {
	const { width, height } = Dimensions.get("window")
	return Math.min(width, height) * 0.32
}

type MenuRowProps = {
	icon: keyof typeof Ionicons.glyphMap
	label: string
	description?: string
	onPress: () => void
	autoFocus?: boolean
	variant?: Variant
}

function MenuRow({
	icon,
	label,
	description,
	onPress,
	autoFocus,
	variant = "primary",
}: MenuRowProps) {
	const ref = useRef<View>(null)
	const accent = VARIANT_ACCENT[variant]

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
			style={({ focused, pressed }) => {
				const active = focused || pressed
				return [
					styles.menuRow,
					active && {
						backgroundColor: `${accent}26`, // ~15% opacity hex tail
						borderColor: accent,
					},
				]
			}}
		>
			{({ focused, pressed }) => {
				const active = focused || pressed
				return (
					<>
						<View
							style={[
								styles.menuRowIcon,
								{ backgroundColor: `${accent}1F` },
								active && { backgroundColor: accent },
							]}
						>
							<Ionicons
								name={icon}
								size={RFValue(16)}
								color={active ? "#fff" : accent}
							/>
						</View>

						<View style={styles.menuRowText}>
							<Text style={styles.menuRowLabel}>{label}</Text>
							{description && (
								<Text style={styles.menuRowDescription}>{description}</Text>
							)}
						</View>

						<Ionicons
							name="chevron-forward"
							size={RFValue(12)}
							color={active ? accent : "#5a6068"}
						/>
					</>
				)
			}}
		</Pressable>
	)
}

const styles = StyleSheet.create({
	container: { height: "100%" },
	menuBackdrop: {
		...StyleSheet.absoluteFillObject,
		backgroundColor: "rgba(8, 10, 14, 0.78)",
		alignItems: "center",
		justifyContent: "center",
	},
	menuCard: {
		width: "44%",
		minWidth: 440,
		maxWidth: 620,
		backgroundColor: "#14171d",
		borderRadius: 22,
		paddingVertical: 26,
		paddingHorizontal: 26,
		borderWidth: 1,
		borderColor: "rgba(255,255,255,0.06)",
		shadowColor: "#000",
		shadowOpacity: 0.55,
		shadowRadius: 40,
		shadowOffset: { width: 0, height: 18 },
		elevation: 24,
	},
	menuHeader: {
		paddingBottom: 18,
		marginBottom: 14,
		borderBottomWidth: StyleSheet.hairlineWidth,
		borderBottomColor: "rgba(255,255,255,0.08)",
	},
	menuTitle: {
		color: "#fff",
		fontSize: RFValue(15),
		fontWeight: "700",
		letterSpacing: -0.2,
	},
	menuSubtitle: {
		color: "#7a8090",
		fontSize: RFValue(9),
		fontWeight: "500",
		marginTop: 4,
	},
	menuList: {
		gap: 8,
	},
	menuRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: 14,
		paddingVertical: 12,
		paddingHorizontal: 14,
		borderRadius: 14,
		borderWidth: 1.5,
		borderColor: "transparent",
		backgroundColor: "rgba(255,255,255,0.03)",
	},
	menuRowIcon: {
		width: RFValue(32),
		height: RFValue(32),
		borderRadius: RFValue(10),
		alignItems: "center",
		justifyContent: "center",
	},
	menuRowText: {
		flex: 1,
		gap: 2,
	},
	menuRowLabel: {
		color: "#f2f3f5",
		fontSize: RFValue(11),
		fontWeight: "600",
		letterSpacing: -0.1,
	},
	menuRowDescription: {
		color: "#8a909c",
		fontSize: RFValue(8),
		fontWeight: "400",
	},
	menuHint: {
		color: "#5a6068",
		fontSize: RFValue(7.5),
		textAlign: "center",
		marginTop: 16,
		letterSpacing: 0.5,
	},
	qrCard: {
		backgroundColor: "#14171d",
		borderRadius: 22,
		paddingVertical: 26,
		paddingHorizontal: 26,
		borderWidth: 1,
		borderColor: "rgba(255,255,255,0.06)",
		alignItems: "center",
		shadowColor: "#000",
		shadowOpacity: 0.55,
		shadowRadius: 40,
		shadowOffset: { width: 0, height: 18 },
		elevation: 24,
	},
	qrHeader: {
		flexDirection: "row",
		alignItems: "center",
		gap: 14,
		alignSelf: "stretch",
		paddingBottom: 18,
		marginBottom: 18,
		borderBottomWidth: StyleSheet.hairlineWidth,
		borderBottomColor: "rgba(255,255,255,0.08)",
	},
	qrFrame: {
		backgroundColor: "#fff",
		borderRadius: 16,
		padding: 18,
	},
	qrUrl: {
		color: "#9aa3b2",
		fontSize: RFValue(8.5),
		fontWeight: "500",
		marginTop: 16,
		letterSpacing: 0.3,
		maxWidth: "100%",
	},
	codeBlock: {
		marginTop: 18,
		alignItems: "center",
		gap: 6,
	},
	codeEyebrow: {
		color: "#5a6068",
		fontSize: RFValue(7),
		fontWeight: "700",
		letterSpacing: 2,
	},
	codeConnectHost: {
		color: "#9aa3b2",
		fontSize: RFValue(9),
		fontWeight: "500",
	},
	codeConnectHostMono: {
		color: "#f2f3f5",
		fontFamily: "monospace",
		fontWeight: "600",
	},
	codeRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: 12,
		marginTop: 6,
	},
	codeLabel: {
		color: "#7a8090",
		fontSize: RFValue(8),
		fontWeight: "700",
		letterSpacing: 1.5,
	},
	codeDigits: {
		flexDirection: "row",
		gap: 6,
	},
	codeDigit: {
		minWidth: RFValue(18),
		paddingVertical: RFValue(4),
		paddingHorizontal: RFValue(6),
		borderRadius: RFValue(6),
		borderWidth: 1,
		borderColor: "rgba(255,255,255,0.1)",
		backgroundColor: "rgba(255,255,255,0.05)",
		alignItems: "center",
		justifyContent: "center",
	},
	codeDigitText: {
		color: "#f2f3f5",
		fontFamily: "monospace",
		fontSize: RFValue(13),
		fontWeight: "600",
	},
})
