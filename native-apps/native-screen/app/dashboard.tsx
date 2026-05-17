import { gql, useQuery } from "@apollo/client"
import { router } from "expo-router"
import { Button, Text, View } from "react-native"
import { useCookie } from "../api/useCookie"
import { logout } from "../utils/logout"
import { RFValue } from "react-native-responsive-fontsize"
import { useUpdates, reloadAsync, checkForUpdateAsync } from "expo-updates"
import { isAutoLogin } from "../utils/rootUrl"

export default function Dashboard() {
	const { data: cookie } = useCookie()

	const { downloadedUpdate, isUpdateAvailable } = useUpdates()

	const autoLogin = isAutoLogin()
	
	const { data, loading: dataLoading } = useQuery(
		gql`
			query Shared {
				currentUser {
					id
					name
					username
					avatarUrl
					isAdmin
					isVerified
					organizationMemberships(first: 20) {
						nodes {
							id
							isOwner
							isBillingContact
							organization {
								id
								name
								slug
							}
						}
					}
				}
			}
		`,
		{
			// Don't pass cookie header in auto-login mode - server handles auth automatically
			context: autoLogin ? {} : { headers: { Cookie: `${cookie?.name}=${cookie?.value}` } },
			skip: !cookie,
		},
	)

	if (dataLoading) {
		return (
			<View style={{ padding: 20 }}>
				<Text style={{ fontSize: RFValue(14), paddingBottom: 20 }}>
					Loading
				</Text>
			</View>
		)
	}

	if (data && !dataLoading && !data.currentUser) {
		logout()
		return (
			<View style={{ padding: 20 }}>
				<Text style={{ fontSize: RFValue(14), paddingBottom: 20 }}>
					Logging out
				</Text>
			</View>
		)
	}

	if (!cookie) {
		logout()
		return null
	}

	return (
		<View style={{ padding: 20 }}>
			<Text style={{ fontSize: RFValue(14), paddingBottom: 20 }}>
				Choose Organization
			</Text>

			<View style={{ gap: 10, paddingBottom: 20 }}>
				{data.currentUser.organizationMemberships.nodes.map((org) => (
					<Button
						key={org.id}
						title={org.organization.name}
						onPress={() => {
							router.push(`/o/${org.organization.slug}`)
						}}
					/>
				))}
			</View>

			<Button
				title="Manually check update"
				onPress={() => {
					checkForUpdateAsync()
				}}
			/>
			<Text>Version: 1.0.0 {isUpdateAvailable && "(Update available)"}</Text>
			{downloadedUpdate && (
				<>
					<Text>New update available</Text>
					<Button
						title="Restart now"
						onPress={() => {
							reloadAsync()
						}}
					/>
				</>
			)}

			<Button
				onPress={() => {
					logout()
				}}
				title="Logout"
			/>
		</View>
	)
}
