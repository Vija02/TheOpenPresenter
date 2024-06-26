import PageHeader from "@/components/page-header"
import ViewOnGithub from "@/components/view-on-github"

export default function Home() {
	return (
		<section>
			<div className="pt-64 pb-12 md:pt-80 md:pb-20">
				<div className="px-4 sm:px-6">
					<PageHeader
						className="mb-12"
						title="Present everything with a few clicks"
						description="Present your slides, videos, websites, music and more seamlessly"
					>
						Coming Soon
					</PageHeader>

					<ViewOnGithub />
				</div>
			</div>
		</section>
	)
}
