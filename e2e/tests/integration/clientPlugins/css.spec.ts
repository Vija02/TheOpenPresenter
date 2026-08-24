import { expect, test } from "../../../fixtures/clientPluginFixture";
import { sourceWithMarker } from "./clientPluginSource";

/**
 * The compiled CSS, fetched as the browser fetches it and then checked where it
 * has to work: on the mounted plugin.
 *
 * Two bugs live here historically. First, plugin CSS was never run through
 * Tailwind, so `desktop:flex-row` produced nothing. Second, the scope selector
 * was version-free while the container id was versioned, so every rule matched
 * nothing and the plugin rendered unstyled. Both were invisible: the stylesheet
 * existed and the build passed.
 */

test.describe("client plugin CSS", () => {
  test("compiles Tailwind, scopes it to the version, and applies it in the app", async ({
    page,
    cplugin,
  }) => {
    const { versionId } = await cplugin.seedPlugin({
      label: "css",
      title: "CSS Plugin",
      source: sourceWithMarker("CSS-CHECK"),
    });

    const view = (await cplugin.api.views()).find(
      (v) => v.versionId === versionId,
    );
    expect(view).toBeDefined();
    expect(view!.remoteCss.length).toBeGreaterThan(0);

    // Fetch the artifact the browser would load.
    const res = await cplugin.api.request.get(view!.remoteCss[0]!);
    expect(res.ok()).toBe(true);
    const css = await res.text();

    // Tailwind really ran: a responsive variant and its media query exist.
    expect(css).toContain("desktop\\:flex-row");
    expect(css).toContain("48rem");
    // A utility from the plugin's own source.
    expect(css).toContain("tracking-wide");

    // Scoped to the element the apps render, which carries the VERSIONED name.
    const scope = `#pl-${view!.pluginName}`;
    expect(css).toContain(scope);
    // A version-free scope would select nothing.
    expect(css).not.toContain(`#pl-${view!.pluginFamily} .`);

    // Theme variables must not leak onto the host document.
    expect(css).not.toMatch(/(^|[\s,{])(:root|:host)\b/m);

    // The part the artifact check cannot prove: the rules actually match the
    // mounted plugin, rather than a container the scope never selects.
    await cplugin.gotoProject();
    await cplugin.addScene("CSS Plugin");
    await expect(page.getByTestId("cplugin-marker")).toHaveText("CSS-CHECK", {
      timeout: 60_000,
    });

    const spacing = await page
      .getByTestId("cplugin-marker")
      .evaluate((el) => getComputedStyle(el.parentElement!).letterSpacing);
    // tracking-wide, not the browser default of "normal".
    expect(spacing).not.toBe("normal");
  });

  test("gives each version its own scope so two can coexist", async ({
    cplugin,
  }) => {
    const { pluginId, versionId: v1 } = await cplugin.seedPlugin({
      label: "cssversions",
      title: "CSS Versions Plugin",
      version: "1.0.0",
      source: sourceWithMarker("CSS-V1"),
    });
    const v2 = await cplugin.api.publish({
      clientPluginId: pluginId,
      version: "2.0.0",
      source: sourceWithMarker("CSS-V2"),
    });

    const views = await cplugin.api.views();
    const first = views.find((v) => v.versionId === v1)!;
    const second = views.find((v) => v.versionId === v2)!;

    const cssOf = async (url: string) => {
      const res = await cplugin.api.request.get(url);
      expect(res.ok()).toBe(true);
      return res.text();
    };

    const firstCss = await cssOf(first.remoteCss[0]!);
    const secondCss = await cssOf(second.remoteCss[0]!);

    // Each stylesheet targets only its own container, so an old pinned scene
    // keeps its styling after a newer version is published.
    expect(firstCss).toContain(`#pl-${first.pluginName}`);
    expect(firstCss).not.toContain(`#pl-${second.pluginName}`);
    expect(secondCss).toContain(`#pl-${second.pluginName}`);
    expect(secondCss).not.toContain(`#pl-${first.pluginName}`);
  });
});
