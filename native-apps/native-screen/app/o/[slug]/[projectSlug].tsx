import { useLocalSearchParams } from "expo-router"
import { StyleSheet, View } from "react-native"
import { WebView } from "react-native-webview"
import { getRootUrl } from "../../../utils/rootUrl"

export default function Renderer() {
	const { slug, projectSlug, renderer = "1" } = useLocalSearchParams()

	return (
		<View style={styles.container}>
			<WebView
				source={{
					uri: `${getRootUrl()}/render/${slug}/${projectSlug}?renderer=${renderer}`,
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
		</View>
	)
}

const styles = StyleSheet.create({
	container: { height: "100%" },
})
