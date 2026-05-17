import React, { Component, ErrorInfo, ReactNode } from "react"
import { ScrollView, Text, View } from "react-native"
import { RFValue } from "react-native-responsive-fontsize"

interface Props {
	children: ReactNode
}

interface State {
	hasError: boolean
	error: Error | null
	errorInfo: ErrorInfo | null
}

export class ErrorBoundary extends Component<Props, State> {
	constructor(props: Props) {
		super(props)
		this.state = { hasError: false, error: null, errorInfo: null }
	}

	static getDerivedStateFromError(error: Error): Partial<State> {
		return { hasError: true, error }
	}

	componentDidCatch(error: Error, errorInfo: ErrorInfo) {
		this.setState({ error, errorInfo })
		console.error("ErrorBoundary caught:", error, errorInfo)
	}

	render() {
		if (this.state.hasError) {
			return (
				<ScrollView style={{ flex: 1, padding: 20, backgroundColor: "#1a0000" }}>
					<Text style={{ fontSize: RFValue(14), color: "#ff6b6b", paddingBottom: 10 }}>
						Something went wrong
					</Text>
					<Text style={{ fontSize: RFValue(10), color: "#ff8888", paddingBottom: 20 }}>
						{this.state.error?.message}
					</Text>
					<Text style={{ fontSize: RFValue(8), color: "#888", paddingBottom: 10 }}>
						Stack trace:
					</Text>
					<Text style={{ fontSize: RFValue(6), color: "#666", fontFamily: "monospace" }}>
						{this.state.error?.stack}
					</Text>
					{this.state.errorInfo && (
						<>
							<Text style={{ fontSize: RFValue(8), color: "#888", paddingTop: 20, paddingBottom: 10 }}>
								Component stack:
							</Text>
							<Text style={{ fontSize: RFValue(6), color: "#666", fontFamily: "monospace" }}>
								{this.state.errorInfo.componentStack}
							</Text>
						</>
					)}
				</ScrollView>
			)
		}

		return this.props.children
	}
}
