import { SharedLayoutLoggedIn } from "@/components/SharedLayoutLoggedIn";
import { useOrganizationOverviewIndexPageQuery } from "@repo/graphql";
import { Link, Option } from "@repo/ui";
import { Link as WouterLink } from "wouter";

const OrganizationOverview = () => {
  const query = useOrganizationOverviewIndexPageQuery();

  return (
    <SharedLayoutLoggedIn
      title="Organization Overview"
      query={query}
      noHandleErrors
    >
      <h1 className="text-2xl font-bold mb-4">Your Organizations</h1>
      <div>
        <div className="stack-row items-start mb-2 flex-wrap">
          {query.data?.currentUser?.organizationMemberships.nodes.map(
            (membership) => (
              <WouterLink
                key={membership.id}
                href={"/o/" + membership.organization?.slug}
                className="text-primary no-underline w-full max-w-[200px]"
              >
                <Option
                  title={membership.organization?.name}
                  description={`${membership.organization?.projects.totalCount} projects`}
                />
              </WouterLink>
            ),
          )}
        </div>
        {query.data?.currentUser?.organizationMemberships.nodes.length ===
          0 && (
          <p>
            You are not part of any organization. <br />
            To get started with TheOpenPresenter, please{" "}
            <Link asChild>
              <WouterLink href="/org/create-organization">
                create a new organization
              </WouterLink>
            </Link>
          </p>
        )}
      </div>
    </SharedLayoutLoggedIn>
  );
};

export default OrganizationOverview;
