import { Scene, SceneCategories, sceneCategories } from "@repo/base-plugin";
import { usePluginData, usePluginMetaData } from "@repo/shared";
import { Badge, OptionGroup } from "@repo/ui";
import React from "react";
import { FaStar } from "react-icons/fa";
import { IconType } from "react-icons/lib";
import { MdOutlineOndemandVideo } from "react-icons/md";
import { PiMusicNotesSimple, PiPresentationChart } from "react-icons/pi";
import { typeidUnboxed } from "typeid-js";

import { useNavigateWithParams } from "../../../src/hooks/useNavigateWithParams";

// grab the same icons from the modal
const sceneCategoriesConfig: Record<SceneCategories, IconType> = {
  Display: PiPresentationChart,
  Media: MdOutlineOndemandVideo,
  Audio: PiMusicNotesSimple,
};

export const EmptyScene = () => {
  const navigate = useNavigateWithParams();
  const mainState = usePluginData().mainState!;

  const { pluginMeta, organizationType, experimentalFeaturesEnabled } = usePluginMetaData();

  const remotePluginMeta =
    pluginMeta && "registeredRemoteView" in pluginMeta ? pluginMeta : null;

  const visibleSceneCreators =
    remotePluginMeta?.sceneCreator.filter((x) => {
      const matchesOrg =
        !organizationType ||
        !x.organizationTypes ||
        x.organizationTypes.length === 0 ||
        x.organizationTypes.includes(organizationType);

      const matchExperimentalOnlyWhenEnabled = !x.isExperimental || experimentalFeaturesEnabled;

      return matchesOrg && matchExperimentalOnlyWhenEnabled;
    }) ?? [];

  const addPlugin = (pluginName: string, pluginTitle: string) => {
    const sceneId = typeidUnboxed("scene");
    
    mainState.data[sceneId] = {
      name: pluginTitle,
      order:
        (Math.max(0, ...Object.values(mainState.data).map((x) => x.order)) ?? 0) + 1,
      type: "scene",
      children: {
        [typeidUnboxed("plugin")]: {
          plugin: pluginName,
          order: 1,
          pluginData: {},
        },
      },
    } as Scene;

    navigate(`/${sceneId}`);
  };

  return (
    <div className="p-4 prose max-w-none">
      <h2 className="mt-2">Add component</h2>
      <p>
        There is nothing in your project yet. Select a component below to start
        presenting.
      </p>

      {/* keep the menu from getting too wide on big screens */}
      <div className="not-prose my-8 flex flex-col gap-8 max-w-5xl">
        {sceneCategories.map((category) => {
          const categoryPlugins = visibleSceneCreators.filter((creator) =>
            creator.categories.includes(category)
          );

          if (categoryPlugins.length === 0) return null;

          return (
            <div key={category} className="flex flex-col gap-3">
              <div className="flex items-center gap-2 text-xl font-bold text-gray-800">
                {React.createElement(sceneCategoriesConfig[category], {
                  fontSize: 24,
                })}
                <h3>{category}</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 auto-rows-fr">
                {categoryPlugins.map((sceneCreator) => (
                  <div 
                    key={sceneCreator.pluginName} 
                    className="flex flex-col h-full [&>div]:flex-1 [&_[role=radio]]:h-full [&_label]:h-full [&_button]:h-full"
                  >
                    {/* put exactly 1 option per OptionGroup so it fills the cell perfectly */}
                    <OptionGroup
                      size="sm"
                      options={[
                        {
                          title: (
                            <div className="flex items-center gap-2">
                              {sceneCreator.title}
                              {sceneCreator.isExperimental && (
                                <Badge size="sm">EXPERIMENTAL</Badge>
                              )}
                              {sceneCreator.isStarred && (
                                <FaStar className="text-yellow-400" />
                              )}
                            </div>
                          ),
                          description: sceneCreator.description,
                          value: sceneCreator.pluginName,
                        },
                      ]}
                      onValueChange={() => {
                        addPlugin(sceneCreator.pluginName, sceneCreator.title);
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <h4>Next steps</h4>
      <p>
        Afterwards, click on the "Present" button on the device you want the
        presentation to be shown.
      </p>
    </div>
  );
};