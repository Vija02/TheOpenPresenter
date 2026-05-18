import axios from "axios"
import { router } from "expo-router"
import { ReactNode, useEffect, useState } from "react"
import {
	ActivityIndicator,
	Dimensions,
	Image,
	StyleSheet,
	Text,
	View,
} from "react-native"
import QRCode from "react-native-qrcode-svg"
import { RFValue } from "react-native-responsive-fontsize"
import EventSource, { EventSourceListener } from "react-native-sse"
import { useCookie } from "../api/useCookie"
import { login } from "../utils/login"
import { getRootUrl } from "../utils/rootUrl"
import { getScreen, setScreen } from "../utils/screen"

type Status = "connecting" | "ready" | "error"

export default function Setup() {
	const { data: cookie, isLoading: cookieLoading } = useCookie()
	const [qrId, setQRId] = useState<string | null>(null)
	const [status, setStatus] = useState<Status>("connecting")
	const [errorMessage, setErrorMessage] = useState<string | null>(null)
	const rootUrl = getRootUrl()

	// If we already have a session and a screen, jump straight to the renderer.
	useEffect(() => {
		if (cookieLoading) return
		if (cookie && getScreen()) {
			router.replace("/screen")
		}
	}, [cookieLoading, cookie])

	useEffect(() => {
		if (!rootUrl) return

		setStatus("connecting")
		setErrorMessage(null)
		setQRId(null)

		const url = new URL(`${rootUrl}/qr-auth/screen-select/request`)
		const es = new EventSource(url)

		const listener: EventSourceListener = (event) => {
			if (event.type === "message") {
				try {
					const data = JSON.parse(event.data)

					if (data.id) {
						setQRId(data.id)
						setStatus("ready")
					}

					if (data.done && data.screen && data.loginToken) {
						const { orgSlug, screenSlug } = data.screen
						if (orgSlug && screenSlug) {
							axios(
								`${rootUrl}/qr-auth/login?token=${data.loginToken}&persist-session=1`,
							)
								.then(async (response) => {
									const setCookieHeader = response.headers["set-cookie"]
									if (!setCookieHeader || setCookieHeader.length === 0) {
										throw new Error("Server did not return a session cookie")
									}
									await setScreen({ orgSlug, screenSlug })
									await login(setCookieHeader[0], rootUrl, "/screen")
								})
								.catch((e) => {
									console.error("Login failed", e)
									setErrorMessage(e?.message ?? "Login failed")
									setStatus("error")
								})
						}
					}
				} catch (_e) {
					// Keep-alive / heartbeat – ignore JSON parse errors
				}
			} else if (event.type === "error") {
				console.error("Connection error:", event.message)
				setErrorMessage(event.message ?? "Connection error")
				setStatus("error")
			} else if (event.type === "exception") {
				console.error("Exception:", event.message, event.error)
				setErrorMessage(event.message ?? "An exception occurred")
				setStatus("error")
			}
		}

		es.addEventListener("open", listener)
		es.addEventListener("message", listener)
		es.addEventListener("error", listener)

		return () => {
			es.removeAllEventListeners()
			es.close()
		}
	}, [rootUrl])

	const { width, height } = Dimensions.get("window")
	const qrSize = Math.min(width * 0.34, height * 0.62)

	return (
		<View style={styles.container}>
			<View style={styles.glowTopRight} />
			<View style={styles.glowBottomLeft} />

			<View style={styles.header}>
				<Image
					source={require("../assets/images/brand.png")}
					style={styles.brandImage}
					resizeMode="contain"
				/>
			</View>

			<View style={styles.row}>
				<View style={styles.leftPanel}>
					<Text style={styles.eyebrow}>SET UP THIS DEVICE</Text>
					<Text style={styles.subtitle}>
						Link this screen to your account in a few seconds.
					</Text>

					<View style={styles.steps}>
						<Step number={1} label="Open the camera app on your phone" />
						<Step number={2} label="Point it at the QR code on the right" />
						<Step number={3} label="Sign in and link to your account" />
					</View>
				</View>

				<View style={styles.rightPanel}>
					<View
						style={[
							styles.qrCard,
							{ width: qrSize + 64, height: qrSize + 64 },
						]}
					>
						{status === "ready" && qrId && (
							<QRCode
								size={qrSize}
								value={`${rootUrl}/qr-auth/screen-select/auth?id=${qrId}`}
							/>
						)}
						{status === "connecting" && (
							<View style={styles.qrFiller}>
								<ActivityIndicator size="large" color="#0a84ff" />
								<Text style={styles.qrFillerText}>Generating code…</Text>
							</View>
						)}
						{status === "error" && (
							<View style={styles.qrFiller}>
								<Text style={styles.errorTitle}>Connection failed</Text>
								<Text style={styles.errorDetail}>Could not reach {rootUrl}</Text>
								{errorMessage && (
									<Text style={styles.errorMessage}>{errorMessage}</Text>
								)}
							</View>
						)}
					</View>
					<Text style={styles.qrHint}>Scan with your phone camera</Text>
				</View>
			</View>

			<View style={styles.footer}>
				<View
					style={[
						styles.statusDot,
						status === "ready" && styles.statusDotReady,
						status === "error" && styles.statusDotError,
					]}
				/>
				<Text style={styles.footerText}>
					{status === "ready"
						? "Waiting for sign-in…"
						: status === "connecting"
							? "Connecting to server…"
							: "Connection error"}
				</Text>
			</View>
		</View>
	)
}

function Step({
	number,
	label,
	children,
}: {
	number: number
	label: string
	children?: ReactNode
}) {
	return (
		<View style={styles.step}>
			<View style={styles.stepBubble}>
				<Text style={styles.stepNumber}>{number}</Text>
			</View>
			<View style={styles.stepBody}>
				<Text style={styles.stepLabel}>STEP {number}</Text>
				<Text style={styles.stepText}>{label}</Text>
				{children}
			</View>
		</View>
	)
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: "#0b0d12",
		overflow: "hidden",
	},
	glowTopRight: {
		position: "absolute",
		top: -200,
		right: -200,
		width: 600,
		height: 600,
		borderRadius: 300,
		backgroundColor: "#0a84ff",
		opacity: 0.08,
	},
	glowBottomLeft: {
		position: "absolute",
		bottom: -240,
		left: -240,
		width: 560,
		height: 560,
		borderRadius: 280,
		backgroundColor: "#5b8def",
		opacity: 0.06,
	},
	header: {
		flexDirection: "row",
		alignItems: "center",
		paddingHorizontal: 64,
		paddingTop: 40,
	},
	brandImage: {
		height: RFValue(34),
		width: RFValue(130),
	},
	row: {
		flex: 1,
		flexDirection: "row",
		alignItems: "center",
	},
	leftPanel: {
		flex: 1.05,
		paddingHorizontal: 64,
		justifyContent: "center",
	},
	eyebrow: {
		color: "#5b8def",
		fontSize: RFValue(9),
		fontWeight: "700",
		letterSpacing: 2,
		marginBottom: 12,
	},
	title: {
		color: "#fff",
		fontSize: RFValue(30),
		fontWeight: "800",
		lineHeight: RFValue(42),
		letterSpacing: -0.5,
		includeFontPadding: false,
	},
	subtitle: {
		color: "#e6e8ee",
		fontSize: RFValue(16),
		fontWeight: "600",
		lineHeight: RFValue(24),
		marginTop: 0,
		marginBottom: 44,
		maxWidth: "92%",
	},
	steps: {
		gap: 22,
	},
	step: {
		flexDirection: "row",
		alignItems: "flex-start",
		gap: 18,
	},
	stepBubble: {
		width: RFValue(30),
		height: RFValue(30),
		borderRadius: RFValue(15),
		backgroundColor: "rgba(10, 132, 255, 0.12)",
		borderWidth: 1,
		borderColor: "rgba(10, 132, 255, 0.55)",
		alignItems: "center",
		justifyContent: "center",
		marginTop: RFValue(2),
	},
	stepNumber: {
		color: "#7ab2ff",
		fontSize: RFValue(12),
		fontWeight: "700",
	},
	stepBody: {
		flexShrink: 1,
		gap: 4,
	},
	stepLabel: {
		color: "#6c7384",
		fontSize: RFValue(7.5),
		fontWeight: "700",
		letterSpacing: 1.5,
	},
	stepText: {
		color: "#e6e8ee",
		fontSize: RFValue(12),
		fontWeight: "500",
		lineHeight: RFValue(18),
	},
	urlPill: {
		color: "#fff",
		fontSize: RFValue(14),
		fontWeight: "700",
		marginTop: 8,
		paddingVertical: 8,
		paddingHorizontal: 14,
		alignSelf: "flex-start",
		backgroundColor: "rgba(255,255,255,0.06)",
		borderColor: "rgba(255,255,255,0.12)",
		borderWidth: 1,
		borderRadius: 10,
		overflow: "hidden",
	},
	rightPanel: {
		flex: 1,
		alignItems: "center",
		justifyContent: "center",
		paddingHorizontal: 32,
		gap: 20,
	},
	qrCard: {
		backgroundColor: "#fff",
		borderRadius: 28,
		padding: 32,
		alignItems: "center",
		justifyContent: "center",
		shadowColor: "#0a84ff",
		shadowOpacity: 0.35,
		shadowRadius: 40,
		shadowOffset: { width: 0, height: 12 },
		elevation: 16,
	},
	qrHint: {
		color: "#9aa3b2",
		fontSize: RFValue(10),
		fontWeight: "500",
		letterSpacing: 0.3,
	},
	qrFiller: {
		alignItems: "center",
		justifyContent: "center",
		gap: 16,
		padding: 24,
	},
	qrFillerText: {
		color: "#444",
		fontSize: RFValue(10),
	},
	errorTitle: {
		color: "#c0392b",
		fontSize: RFValue(14),
		fontWeight: "700",
	},
	errorDetail: {
		color: "#555",
		fontSize: RFValue(9),
		textAlign: "center",
	},
	errorMessage: {
		color: "#888",
		fontSize: RFValue(8),
		marginTop: 8,
		textAlign: "center",
	},
	footer: {
		flexDirection: "row",
		alignItems: "center",
		gap: 10,
		paddingHorizontal: 64,
		paddingBottom: 32,
	},
	statusDot: {
		width: RFValue(8),
		height: RFValue(8),
		borderRadius: RFValue(4),
		backgroundColor: "#f1c40f",
	},
	statusDotReady: {
		backgroundColor: "#3ddc84",
	},
	statusDotError: {
		backgroundColor: "#e74c3c",
	},
	footerText: {
		color: "#7a8090",
		fontSize: RFValue(9),
		fontWeight: "500",
		letterSpacing: 0.3,
	},
})
