import { FourOhFour } from "@repo/ui";
import NProgress from "nprogress";
import { useEffect } from "react";
import { Redirect, Route, Switch, useLocation, useSearchParams } from "wouter";

import ForgotPage from "./pages/forgot";
import InvitationsAcceptPage from "./pages/invitations/accept";
import LoginPage from "./pages/login";
import OrganizationPage from "./pages/o";
import OrganizationSlugPage from "./pages/o/[slug]";
import OrganizationSlugMediaPage from "./pages/o/[slug]/media";
import OrganizationSlugSettingsCategoriesPage from "./pages/o/[slug]/settings/categories";
import OrganizationSlugSettingsDeletePage from "./pages/o/[slug]/settings/delete";
import OrganizationSlugSettingsGeneralPage from "./pages/o/[slug]/settings/general";
import OrganizationSlugSettingsLeavePage from "./pages/o/[slug]/settings/leave";
import OrganizationSlugSettingsMembersPage from "./pages/o/[slug]/settings/members";
import OrganizationSlugSettingsTagsPage from "./pages/o/[slug]/settings/tags";
import OrgCreateOrganizationPage from "./pages/org/create-organization";
import OrgJoinOrganizationPage from "./pages/org/join-organization";
import OrgJoinOrganizationAcceptPage from "./pages/org/join-organization/accept";
import OrgOverviewPage from "./pages/org/overview";
import RegisterPage from "./pages/register";
import ResetPage from "./pages/reset";
import SettingsDeletePage from "./pages/settings/delete";
import SettingsEmailsPage from "./pages/settings/emails";
import SettingsProfilePage from "./pages/settings/profile";
import SettingsSecurityPage from "./pages/settings/security";
import VerifyPage from "./pages/verify";

// ========================================================================== //
// ===============================! IMPORTANT !============================== //
// ========================================================================== //
/**
 * If adding a base route to this, we'll also need to add it to the `installProjectManagement.ts` file
 */
function App() {
  return (
    <>
      <LocationHandler />
      <Switch>
        <Route path="/invitations/*?">
          <Switch>
            <Route path="/invitations/accept">
              <InvitationsAcceptPage />
            </Route>
            <Route>
              <FourOhFour />
            </Route>
          </Switch>
        </Route>
        <Route path="/o/*?">
          <Switch>
            <Route path="/o/:slug/settings/*?">
              {({ slug }) => (
                <Switch>
                  <Route path="/o/:slug/settings/categories">
                    <OrganizationSlugSettingsCategoriesPage />
                  </Route>
                  <Route path="/o/:slug/settings/delete">
                    <OrganizationSlugSettingsDeletePage />
                  </Route>
                  <Route path="/o/:slug/settings/general">
                    <OrganizationSlugSettingsGeneralPage />
                  </Route>
                  <Route path="/o/:slug/settings/leave">
                    <OrganizationSlugSettingsLeavePage />
                  </Route>
                  <Route path="/o/:slug/settings/members">
                    <OrganizationSlugSettingsMembersPage />
                  </Route>
                  <Route path="/o/:slug/settings/tags">
                    <OrganizationSlugSettingsTagsPage />
                  </Route>
                  <Route>
                    <Redirect href={`/o/${slug}/settings/general`} />
                  </Route>
                </Switch>
              )}
            </Route>
            <Route path="/o/:slug/media">
              <OrganizationSlugMediaPage />
            </Route>
            <Route path="/o/:slug">
              <OrganizationSlugPage />
            </Route>
            <Route>
              <OrganizationPage />
            </Route>
          </Switch>
        </Route>
        <Route path="/org/*?">
          <Switch>
            <Route path="/org/create-organization">
              <OrgCreateOrganizationPage />
            </Route>
            <Route path="/org/join-organization/*?">
              <Switch>
                <Route path="/org/join-organization/accept">
                  <OrgJoinOrganizationAcceptPage />
                </Route>
                <Route path="/org/join-organization">
                  <OrgJoinOrganizationPage />
                </Route>
                <Route>
                  <Redirect href="/org/join-organization" />
                </Route>
              </Switch>
            </Route>
            <Route path="/org/overview">
              <OrgOverviewPage />
            </Route>
            <Route>
              <Redirect href="/org/overview" />
            </Route>
          </Switch>
        </Route>
        <Route path="/settings/*?">
          <Switch>
            <Route path="/settings/delete">
              <SettingsDeletePage />
            </Route>
            <Route path="/settings/emails">
              <SettingsEmailsPage />
            </Route>
            <Route path="/settings/profile">
              <SettingsProfilePage />
            </Route>
            <Route path="/settings/security">
              <SettingsSecurityPage />
            </Route>
            <Route>
              <Redirect href="/settings/profile" />
            </Route>
          </Switch>
        </Route>
        <Route path="/forgot">
          <ForgotPage />
        </Route>
        <Route path="/login">
          <LoginPage />
        </Route>
        <Route path="/register">
          <RegisterPage />
        </Route>
        <Route path="/reset">
          <ResetPage />
        </Route>
        <Route path="/verify">
          <VerifyPage />
        </Route>
        {/* !! IMPORTANT !! */}
        {/* Read the notice on the top of this file */}
        <Route>
          {/* Reload so that we hit express */}
          <Reload />
        </Route>
      </Switch>
    </>
  );
}

const Reload = () => {
  const [searchParams] = useSearchParams();
  if (searchParams.get("ref") === "p") {
    return <FourOhFour />;
  }

  useEffect(() => {
    const currentUrl = new window.URL(window.location.href);
    // Set this param so that we don't go into infinite loop
    currentUrl.searchParams.set("ref", "p");
    window.location.href = currentUrl.toString();
  });
  return null;
};

function LocationHandler() {
  const [location] = useLocation();

  useEffect(() => {
    NProgress.start();
    NProgress.done();
  }, [location]);

  return null;
}

export default App;
