import axios from "axios"
import NitroCookies from "react-native-nitro-cookies"

/**
 * Minimal raw GraphQL fetch — no urql / codegen dependency.
 * Mirrors the renderer's RendererScreen query but only asks for `code`.
 */
const RENDERER_SCREEN_CODE_QUERY = `
	query RendererScreenCode($orgSlug: String!, $screenSlug: String!) {
		organizationBySlug(slug: $orgSlug) {
			id
			screens(condition: { slug: $screenSlug }) {
				nodes {
					id
					code
				}
			}
		}
	}
`

export async function fetchScreenCode(
	rootUrl: string,
	orgSlug: string,
	screenSlug: string,
): Promise<string | null> {
	try {
		// Read the session cookie explicitly — axios on RN doesn't reliably auto-attach
		// platform cookies, so we forward it ourselves.
		const cookies = await NitroCookies.get(rootUrl)
		const sid = cookies?.["connect.sid"]

		const res = await axios.post(
			`${rootUrl}/graphql`,
			{
				query: RENDERER_SCREEN_CODE_QUERY,
				variables: { orgSlug, screenSlug },
			},
			{
				withCredentials: true,
				headers: {
					"x-top-csrf-protection": "1",
					...(sid ? { Cookie: `connect.sid=${sid}` } : {}),
				},
			},
		)
		const code =
			res.data?.data?.organizationBySlug?.screens?.nodes?.[0]?.code
		return typeof code === "string" ? code : null
	} catch (e) {
		console.error("fetchScreenCode failed", e)
		return null
	}
}
