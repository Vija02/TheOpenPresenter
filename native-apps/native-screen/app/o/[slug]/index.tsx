import { gql, useQuery } from "@apollo/client"
import { router, useLocalSearchParams } from "expo-router"
import { useState } from "react"
import { Button, Pressable, ScrollView, Text, View } from "react-native"
import { RFValue } from "react-native-responsive-fontsize"

const OrganizationPage = () => {
	const { slug } = useLocalSearchParams()
	const [rendererNumber, setRendererNumber] = useState(1)

	const query = useQuery(
		gql`
			query OrganizationDashboardIndexPage($slug: String!) {
				organizationBySlug(slug: $slug) {
					id
					projects(orderBy: UPDATED_AT_DESC) {
						nodes {
							id
							name
							slug
							category {
								id
								name
							}
							targetDate
							updatedAt
						}
					}
				}
			}
		`,
		{
			variables: {
				slug: slug.toString(),
			},
		},
	)
	if (!query.data?.organizationBySlug) {
		return null
	}

	return (
		<ScrollView style={{ padding: 20 }}>
			<View
				style={{
					flexDirection: "row",
					alignItems: "center",
					paddingBottom: 20,
				}}
			>
				<Text style={{ fontSize: RFValue(14), marginRight: 10 }}>
					Renderer:
				</Text>
				<Pressable
					onPress={() => setRendererNumber((prev) => Math.max(1, prev - 1))}
					style={({ focused }) => ({
						backgroundColor: focused ? "#bbb" : "#f5f5f5",
						padding: 10
					})}
				>
					<Text>-</Text>
				</Pressable>
				<Text style={{ fontSize: RFValue(14), marginHorizontal: 15 }}>
					{rendererNumber}
				</Text>
				<Pressable
					onPress={() => setRendererNumber((prev) => prev + 1)}
					style={({ focused }) => ({
						backgroundColor: focused ? "#bbb" : "#f5f5f5",
						padding: 10
					})}
				>
					<Text>+</Text>
				</Pressable>
			</View>
			<Text style={{ fontSize: RFValue(14), paddingBottom: 10 }}>
				Choose Project
			</Text>
			<View style={{ gap: 5, paddingBottom: 20 }}>
				{query.data.organizationBySlug.projects.nodes.map((project) => (
					<Pressable
						onPress={() => {
							router.push(
								`/o/${slug}/${project.slug}?renderer=${rendererNumber}`,
							)
						}}
						key={project.id}
						style={({ focused }) => ({
							backgroundColor: focused ? "#bbb" : "#f5f5f5",
							borderRadius: 8,
							padding: 12,
							marginBottom: 8,
						})}
					>
						<View style={{ marginTop: 8, gap: 4 }}>
							<Text style={{ fontSize: RFValue(11), color: "#000" }}>
								{project.name}
							</Text>
							{project.category?.name && (
								<Text style={{ fontSize: RFValue(11), color: "#333" }}>
									Category: {project.category.name}
								</Text>
							)}
							{project.targetDate && (
								<Text style={{ fontSize: RFValue(11), color: "#333" }}>
									Target: {new Date(project.targetDate).toLocaleDateString()}
								</Text>
							)}
							<Text style={{ fontSize: RFValue(10), color: "#333" }}>
								Updated: {new Date(project.updatedAt).toLocaleString()}
							</Text>
						</View>
					</Pressable>
				))}
			</View>
		</ScrollView>
	)
}

export default OrganizationPage
