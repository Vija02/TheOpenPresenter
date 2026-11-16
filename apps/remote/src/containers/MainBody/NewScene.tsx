import { Scene } from "@repo/base-plugin";
import { captureEvent } from "@repo/observability/initAnalytics";
import { usePluginData, usePluginMetaData } from "@repo/shared";
import { Badge, Option, cn } from "@repo/ui";
import React from "react";
import { typeidUnboxed } from "typeid-js";

import { useNavigateWithParams } from "../../hooks/useNavigateWithParams";
import {
  type SceneCreatorTier,
  getSceneCreatorStyle,
} from "./sceneCreatorStyles";
import { getSceneIcon } from "./sceneIcons";

type SceneCreator = {
  pluginName: string;
  title: string;
  description: string;
  icon?: string | null;
  isExperimental?: boolean | null;
};

export const NewScene = () => {
  const navigate = useNavigateWithParams();
  const mainState = usePluginData().mainState!;

  const { pluginMeta, organizationType, experimentalFeaturesEnabled } =
    usePluginMetaData();

  const remotePluginMeta =
    pluginMeta && "registeredRemoteView" in pluginMeta ? pluginMeta : null;

  const clientPluginCreators =
    remotePluginMeta?.clientPluginViews
      .filter((x) => x.isInstallDefault)
      .map((x) => ({
        pluginName: x.pluginName,
        title: x.title,
        description: x.description,
        categories: ["Custom"] as string[],
        icon: null as string | null,
        organizationTypes: null as string[] | null,
        isExperimental: false as boolean | null,
        isStarred: false as boolean | null,
        initialPluginData: x.initialPluginData ?? {},
        initialRendererData: x.initialRendererData ?? {},
      })) ?? [];

  const initialDataByName = new Map(
    clientPluginCreators.map((x) => [
      x.pluginName,
      {
        pluginData: x.initialPluginData,
        rendererData: x.initialRendererData,
      },
    ]),
  );

  const visibleSceneCreators: SceneCreator[] =
    [...(remotePluginMeta?.sceneCreator ?? []), ...clientPluginCreators].filter(
      (x) => {
        const matchesOrg =
          !organizationType ||
          !x.organizationTypes ||
          x.organizationTypes.length === 0 ||
          x.organizationTypes.includes(organizationType);

        const matchExperimentalOnlyWhenEnabled =
          !x.isExperimental || experimentalFeaturesEnabled;

        return matchesOrg && matchExperimentalOnlyWhenEnabled;
      },
    ) ?? [];

  const addPlugin = (pluginName: string, pluginTitle: string) => {
    const sceneId = typeidUnboxed("scene");

    mainState.data[sceneId] = {
      name: pluginTitle,
      order:
        (Math.max(0, ...Object.values(mainState.data).map((x) => x.order)) ??
          0) + 1,
      type: "scene",
      children: {
        [typeidUnboxed("plugin")]: {
          plugin: pluginName,
          order: 1,
          // This seeding is just for client plugin
          pluginData: {
            ...(initialDataByName.get(pluginName)?.pluginData ?? {}),
            ...(initialDataByName.has(pluginName)
              ? {
                  // Store this here since we don't have a backend to handle it
                  __initialRendererData:
                    initialDataByName.get(pluginName)?.rendererData ?? {},
                }
              : {}),
          },
        },
      },
    } as Scene;

    captureEvent("scene_created", {
      plugin_name: pluginName,
      is_client_plugin: initialDataByName.has(pluginName),
      scene_count: Object.keys(mainState.data).length,
    });

    navigate(`/${sceneId}`);
  };

  const creatorsWithStyle = visibleSceneCreators
    .map((creator) => ({
      creator,
      style: getSceneCreatorStyle(creator.pluginName),
    }))
    .sort((a, b) => a.style.rank - b.style.rank);

  const byTier = (tier: SceneCreatorTier) =>
    creatorsWithStyle.filter((x) => x.style.tier === tier);

  const popular = byTier("popular");
  const more = byTier("more");
  const other = byTier("other");

  const renderTitle = (sceneCreator: SceneCreator) => (
    <span className="flex items-center gap-2">
      <span className="ui--option__title">{sceneCreator.title}</span>
      {sceneCreator.isExperimental && <Badge size="sm">EXPERIMENTAL</Badge>}
    </span>
  );

  const sectionHeadingClassName =
    "text-xs font-semibold uppercase tracking-wider text-secondary";

  const cardClassName = cn(
    "text-left rounded-sm border border-stroke bg-surface-primary cursor-pointer transition-colors",
    "hover:border-accent",
    "focus-visible:outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50",
  );

  return (
    <div className="p-4 max-[399px]:pt-3 prose max-w-none">
      <h2 className="mt-2 mb-2 max-[399px]:mt-0">Add component</h2>
      <p>Select a component below to add it to your project.</p>

      {/* stop the menu from stretching on big monitors */}
      <div className="mt-6 not-prose my-8 flex flex-col gap-8 max-w-5xl">
        {popular.length > 0 && (
          <section className="flex flex-col gap-3">
            <h3 className={sectionHeadingClassName}>Most used</h3>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {popular.map(({ creator, style }) => {
                const Preview = style.preview;
                const Icon = getSceneIcon(creator.icon);
                return (
                  <button
                    type="button"
                    key={creator.pluginName}
                    data-testid={`scene-creator-${creator.pluginName}`}
                    onClick={() => addPlugin(creator.pluginName, creator.title)}
                    className={cn(
                      cardClassName,
                      "flex flex-col overflow-hidden",
                    )}
                  >
                    <div className="relative w-full">
                      <div className="aspect-[2/1] w-full overflow-hidden border-b border-stroke bg-surface-secondary">
                        {Preview && <Preview />}
                      </div>
                      <span className="absolute left-3 bottom-0 translate-y-1/2 flex items-center justify-center size-9 rounded-xs border border-stroke bg-surface-primary text-secondary text-lg shadow-xs">
                        <Icon />
                      </span>
                    </div>
                    <div className="px-3 pt-6 pb-3">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-primary leading-snug">
                          {renderTitle(creator)}
                        </div>
                        <p className="text-xs text-secondary mt-0.5 leading-snug">
                          {style.tagline ?? creator.description}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {more.length > 0 && (
          <section className="flex flex-col gap-3">
            <h3 className={sectionHeadingClassName}>More</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {more.map(({ creator }) => {
                const Icon = getSceneIcon(creator.icon);
                return (
                  <button
                    type="button"
                    key={creator.pluginName}
                    data-testid={`scene-creator-${creator.pluginName}`}
                    onClick={() => addPlugin(creator.pluginName, creator.title)}
                    className={cn(
                      cardClassName,
                      "flex items-center gap-3 p-2.5",
                    )}
                  >
                    <span className="shrink-0 flex items-center justify-center size-9 rounded-xs border border-stroke bg-surface-secondary text-secondary text-lg">
                      <Icon />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-primary leading-snug">
                        {renderTitle(creator)}
                      </span>
                      <span className="block text-xs text-secondary mt-0.5 leading-snug">
                        {creator.description}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {other.length > 0 && (
          <section className="flex flex-col gap-3">
            <h3 className={sectionHeadingClassName}>Other tools</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 auto-rows-fr">
              {other.map(({ creator }) => (
                <Option
                  key={creator.pluginName}
                  testId={`scene-creator-${creator.pluginName}`}
                  onClick={() => addPlugin(creator.pluginName, creator.title)}
                  title={
                    <span className="flex items-center gap-2">
                      {creator.title}
                      {creator.isExperimental && (
                        <Badge size="sm">EXPERIMENTAL</Badge>
                      )}
                    </span>
                  }
                  icon={React.createElement(getSceneIcon(creator.icon))}
                  size="sm"
                  description={creator.description}
                />
              ))}
            </div>
          </section>
        )}
      </div>

      <h4>Next steps</h4>
      <p>
        Afterwards, click on the "Present" button on the device you want the
        presentation to be shown.
      </p>
    </div>
  );
};
