import axios from "axios"
import { useEffect, useRef, useState } from "react"
import {
	Dimensions,
	Text,
	View,
	TouchableOpacity,
	TextInput,
	StyleSheet,
} from "react-native"
import QRCode from "react-native-qrcode-svg"
import EventSource, { EventSourceListener } from "react-native-sse"
import { login } from "../utils/login"
import { RFValue } from "react-native-responsive-fontsize"
import { getRootUrl, setRootUrl, setAutoLogin } from "../utils/rootUrl"
import { queryClient } from "../utils/queryClient"
import { router } from "expo-router"
import { recreateApolloClient } from "../utils/apollo"

const DEFAULT_ROOT_URL = process.env.EXPO_PUBLIC_ROOT_URL || ""

export default function Login() {
	const [qrId, setQRId] = useState<string | null>(null)
	const [showCustomUrl, setShowCustomUrl] = useState(false)
	const [customUrl, setCustomUrl] = useState("")
	const [activeRootUrl, setActiveRootUrl] = useState(getRootUrl)
	const [connectionStatus, setConnectionStatus] = useState<
		"connecting" | "connected" | "error"
	>("connecting")
	const [errorMessage, setErrorMessage] = useState<string | null>(null)
	const [autoLoginError, setAutoLoginError] = useState<string | null>(null)
	const inputRef = useRef<TextInput>(null)

	useEffect(() => {
		if (!activeRootUrl) return

		setConnectionStatus("connecting")
		setErrorMessage(null)

		const url = new URL(`${activeRootUrl}/qr-auth/request`)

		const es = new EventSource(url)

		const listener: EventSourceListener = (event) => {
			if (event.type === "open") {
				// Connection opened, waiting for id message
			} else if (event.type === "message") {
				try {
					const data = JSON.parse(event.data)
					if (data.id) {
						setQRId(data.id)
						setConnectionStatus("connected")
					}
					if (data.done) {
						axios(
							`${activeRootUrl}/qr-auth/login?token=${data.token}&persist-session=1`,
						)
							.then((x) => {
								const setCookieHeader = x.headers["set-cookie"]

								login(setCookieHeader[0], activeRootUrl)
							})
							.catch((e) => {
								console.error(e)
							})
					}
				} catch (e) {
					// Keep alive - likely heartbeat messages
				}
			} else if (event.type === "error") {
				console.error("Connection error:", event.message)
				setErrorMessage(event.message ?? "Connection error")
				setConnectionStatus("error")
			} else if (event.type === "exception") {
				console.error("Error:", event.message, event.error)
				setErrorMessage(event.message ?? "An exception occurred")
				setConnectionStatus("error")
			}
		}

		es.addEventListener("open", listener)
		es.addEventListener("message", listener)
		es.addEventListener("error", listener)

		return () => {
			es.removeAllEventListeners()
			es.close()
		}
	}, [activeRootUrl, setQRId, setConnectionStatus])

	return (
		<View style={{ flexDirection: "row", flex: 1 }}>
			<View>
				<Text>QRID: {qrId}</Text>

				{connectionStatus === "connecting" && (
					<View style={{ height: "70%", padding: 10, paddingLeft: 20 }}>
						<Text style={{ fontSize: RFValue(20), paddingBottom: 20 }}>
							Connecting...
						</Text>
					</View>
				)}

				{connectionStatus === "error" && (
					<View style={{ height: "70%", padding: 10, paddingLeft: 20 }}>
						<Text
							style={{
								fontSize: RFValue(20),
								paddingBottom: 20,
								color: "#f44",
							}}
						>
							Connection failed
						</Text>
						<Text style={{ fontSize: RFValue(12), color: "#aaa" }}>
							Could not connect to {activeRootUrl}
						</Text>
						{errorMessage && (
							<Text
								style={{ fontSize: RFValue(10), color: "#f88", marginTop: 10 }}
							>
								{errorMessage}
							</Text>
						)}
					</View>
				)}

				{connectionStatus === "connected" && qrId && (
					<View style={{ height: "70%", padding: 10, paddingLeft: 20 }}>
						<Text style={{ fontSize: RFValue(20), paddingBottom: 20 }}>
							Login With QR Code
						</Text>
						<QRCode
							size={(Dimensions.get("window").height * 80) / 100}
							value={`${activeRootUrl}/qr-auth/auth?id=${qrId}`}
						/>
					</View>
				)}
			</View>

			<View style={styles.customUrlContainer}>
				<TouchableOpacity
					style={styles.customUrlButton}
					onPress={() => setShowCustomUrl(!showCustomUrl)}
				>
					<Text style={styles.customUrlButtonText}>
						{showCustomUrl ? "Hide Custom URL" : "Use Custom URL"}
					</Text>
				</TouchableOpacity>

				{showCustomUrl && (
					<View style={styles.customUrlInputContainer}>
						<TouchableOpacity
							style={styles.customUrlInputWrapper}
							onPress={() => inputRef.current?.focus()}
						>
							<TextInput
								ref={inputRef}
								style={styles.customUrlInput}
								placeholder="Enter custom root URL"
								placeholderTextColor="#888"
								value={customUrl}
								onChangeText={setCustomUrl}
								autoCapitalize="none"
								autoCorrect={false}
							/>
						</TouchableOpacity>
						<TouchableOpacity
							style={styles.applyButton}
							onPress={() => {
								if (customUrl.trim()) {
									setQRId(null)
									setActiveRootUrl(customUrl.trim())
								}
							}}
						>
							<Text style={styles.applyButtonText}>Apply</Text>
						</TouchableOpacity>
						<TouchableOpacity
							style={styles.autoLoginButton}
							onPress={async () => {
								const urlToUse = customUrl.trim() || activeRootUrl
								if (urlToUse) {
									setAutoLoginError(null)
									try {
										const response = await axios(`${urlToUse}/graphql`, {
											method: "POST",
											headers: {
												"Content-Type": "application/json",
												"X-TOP-CSRF-PROTECTION": "1",
											},
											data: JSON.stringify({ query: "{ currentUser { id } }" }),
										})
										// If we get a successful response with currentUser, auto-login is working
										if (response.data?.data?.currentUser?.id) {
											// Set the root URL and auto-login flag, then recreate Apollo client and redirect
											await setRootUrl(urlToUse)
											await setAutoLogin(true)
											recreateApolloClient()
											queryClient.clear()
											router.replace("/")
										} else {
											setAutoLoginError("Auto-login not enabled on server")
										}
									} catch (e: any) {
										console.error("Auto-login failed:", e)
										const errorMsg =
											e.response?.data?.message ||
											e.response?.data?.error ||
											e.response?.data ||
											e.message ||
											"Auto-login failed"
										setAutoLoginError(
											typeof errorMsg === "string"
												? errorMsg
												: JSON.stringify(errorMsg),
										)
									}
								}
							}}
						>
							<Text style={styles.autoLoginButtonText}>Auto Login</Text>
						</TouchableOpacity>
						{autoLoginError && (
							<Text style={styles.autoLoginErrorText}>{autoLoginError}</Text>
						)}
						{activeRootUrl !== DEFAULT_ROOT_URL && (
							<TouchableOpacity
								style={styles.resetButton}
								onPress={() => {
									setQRId(null)
									setCustomUrl("")
									setActiveRootUrl(DEFAULT_ROOT_URL)
								}}
							>
								<Text style={styles.resetButtonText}>Reset to Default</Text>
							</TouchableOpacity>
						)}
					</View>
				)}

				{activeRootUrl !== DEFAULT_ROOT_URL && (
					<Text style={styles.activeUrlText}>Using: {activeRootUrl}</Text>
				)}
			</View>
		</View>
	)
}

const styles = StyleSheet.create({
	customUrlContainer: {
		position: "absolute",
		bottom: 20,
		right: 20,
		width: 250,
	},
	customUrlButton: {
		backgroundColor: "#333",
		padding: 8,
		borderRadius: 6,
		alignItems: "center",
	},
	customUrlButtonText: {
		color: "#fff",
		fontSize: RFValue(8),
	},
	customUrlInputContainer: {
		marginTop: 8,
		backgroundColor: "#222",
		padding: 10,
		borderRadius: 6,
	},
	customUrlInputWrapper: {
		marginBottom: 8,
	},
	customUrlInput: {
		backgroundColor: "#444",
		color: "#fff",
		padding: 8,
		borderRadius: 4,
		fontSize: RFValue(8),
	},
	applyButton: {
		backgroundColor: "#0066cc",
		padding: 8,
		borderRadius: 4,
		alignItems: "center",
	},
	applyButtonText: {
		color: "#fff",
		fontSize: RFValue(8),
		fontWeight: "bold",
	},
	autoLoginButton: {
		backgroundColor: "#228822",
		padding: 8,
		borderRadius: 4,
		alignItems: "center",
		marginTop: 6,
	},
	autoLoginButtonText: {
		color: "#fff",
		fontSize: RFValue(8),
		fontWeight: "bold",
	},
	autoLoginErrorText: {
		color: "#f44",
		fontSize: RFValue(7),
		marginTop: 4,
		textAlign: "center",
	},
	resetButton: {
		backgroundColor: "#666",
		padding: 8,
		borderRadius: 4,
		alignItems: "center",
		marginTop: 6,
	},
	resetButtonText: {
		color: "#fff",
		fontSize: RFValue(8),
	},
	activeUrlText: {
		color: "#0a0",
		fontSize: RFValue(6),
		marginTop: 6,
		textAlign: "center",
	},
})
