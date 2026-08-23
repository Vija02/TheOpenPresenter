import { describe, expect, it } from "vitest";

import {
  clientPluginVersionName,
  findClientPluginView,
  isClientPluginName,
  remoteTag,
  rendererTag,
  runtimePluginName,
} from "../naming";

const PLUGIN_ID = "f5ca7764-a5be-45fe-b8d8-8b773c239a2a";
const V1 = "9231d713-2269-4804-be15-0a8c22111a92";
const V2 = "11111111-2222-3333-4444-555555555555";

describe("client plugin naming", () => {
  it("gives each version its own persisted name, so a scene pins itself", () => {
    // The scene stores this name, so it must differ per version: that is what
    // stops a published update from moving an existing scene.
    expect(clientPluginVersionName(PLUGIN_ID, V1)).not.toBe(
      clientPluginVersionName(PLUGIN_ID, V2),
    );
    // Every version still shares one family key.
    expect(clientPluginVersionName(PLUGIN_ID, V1)).toContain(
      runtimePluginName(PLUGIN_ID),
    );
  });

  it("gives each version its own web component tags", () => {
    // customElements.define throws on a duplicate tag, and two versions can be
    // loaded in one page.
    expect(remoteTag(PLUGIN_ID, V1)).not.toBe(remoteTag(PLUGIN_ID, V2));
    expect(rendererTag(PLUGIN_ID, V1)).not.toBe(remoteTag(PLUGIN_ID, V1));
    expect(remoteTag(PLUGIN_ID, V1)).toBe(
      `${clientPluginVersionName(PLUGIN_ID, V1)}-remote`,
    );
  });

  it("keeps a scene on its own version when a newer one is published", () => {
    const v1View = {
      pluginName: clientPluginVersionName(PLUGIN_ID, V1),
      pluginFamily: runtimePluginName(PLUGIN_ID),
      isInstallDefault: false,
    };
    const v2View = {
      pluginName: clientPluginVersionName(PLUGIN_ID, V2),
      pluginFamily: runtimePluginName(PLUGIN_ID),
      isInstallDefault: true,
    };
    const views = [v1View, v2View];

    // The scene was created on v1, and v2 is now the install default.
    expect(findClientPluginView(views, v1View.pluginName)).toBe(v1View);
    expect(findClientPluginView(views, v2View.pluginName)).toBe(v2View);
  });

  it("falls back to the install default for a version-free stored name", () => {
    const views = [
      {
        pluginName: clientPluginVersionName(PLUGIN_ID, V1),
        pluginFamily: runtimePluginName(PLUGIN_ID),
        isInstallDefault: false,
      },
      {
        pluginName: clientPluginVersionName(PLUGIN_ID, V2),
        pluginFamily: runtimePluginName(PLUGIN_ID),
        isInstallDefault: true,
      },
    ];

    // No version recorded, so there is nothing to honour.
    expect(findClientPluginView(views, runtimePluginName(PLUGIN_ID))).toBe(
      views[1],
    );
    // A different plugin must never match.
    expect(
      findClientPluginView(views, runtimePluginName("other")),
    ).toBeUndefined();
  });

  it("recognises client plugin names and not native ones", () => {
    expect(isClientPluginName(runtimePluginName(PLUGIN_ID))).toBe(true);
    expect(isClientPluginName("bible")).toBe(false);
  });
});
