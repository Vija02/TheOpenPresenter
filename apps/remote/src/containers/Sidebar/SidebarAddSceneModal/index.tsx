import { Scene, SceneCategories, sceneCategories } from "@repo/base-plugin";
import { RemoteBasePluginQuery } from "@repo/graphql";
import { usePluginData, usePluginMetaData } from "@repo/shared";
import {
  Badge,
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  OverlayToggleComponentProps,
} from "@repo/ui";
import { cx } from "class-variance-authority";
import React, { useState } from "react";
import { FaStar } from "react-icons/fa";
import { IconType } from "react-icons/lib";
import { MdOutlineOndemandVideo } from "react-icons/md";
import { PiMusicNotesSimple, PiPresentationChart } from "react-icons/pi";
import { typeidUnboxed } from "typeid-js";
import { useLocation } from "wouter";

import "./index.css";

export type SidebarAddSceneModalPropTypes =
  Partial<OverlayToggleComponentProps>;

const sceneCategoriesConfig: Record<SceneCategories, IconType> = {
  Display: PiPresentationChart,
  Media: MdOutlineOndemandVideo,
  Audio: PiMusicNotesSimple,
};

const SidebarAddSceneModal = ({
  isOpen,
  onToggle,
  resetData,
}: SidebarAddSceneModalPropTypes) => {
  const [, navigate] = useLocation();

  const [selectedCategory, setSelectedCategory] = useState("All");

  const mainState = usePluginData().mainState!;
  const pluginMetaData = usePluginMetaData()
    .pluginMetaData as RemoteBasePluginQuery;

  const [selectedPlugin, setSelectedPlugin] = useState<string | null>(null);
  const selectedSceneCreator = pluginMetaData?.pluginMeta.sceneCreator.find(
    (x) => x.pluginName === selectedPlugin,
  );

  const addPlugin = () => {
    const sceneId = typeidUnboxed("scene");
    mainState.data[sceneId] = {
      name: selectedSceneCreator?.title,
      order:
        (Math.max(0, ...Object.values(mainState.data).map((x) => x.order)) ??
          0) + 1,
      type: "scene",
      children: {
        [typeidUnboxed("plugin")]: {
          plugin: selectedPlugin,
          order: 1,
          pluginData: {},
        },
      },
    } as Scene;

    navigate(`/${sceneId}`);

    onToggle?.();
    resetData?.();
  };

  return (
    <Dialog open={isOpen ?? false} onOpenChange={onToggle ?? (() => {})}>
      <DialogContent size="xl">
        <DialogHeader>
          <DialogTitle>Add scene</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <p className="font-bold">Select a component to add:</p>
          <div className="flex">
            <div className="stack-col items-stretch pr-4 gap-0 border-r-stroke border-r-1">
              <p className="font-bold mb-2">Categories</p>
              {["All"].concat(sceneCategories).map((category) => (
                <div
                  key={category}
                  className={cx("px-2 py-1 cursor-pointer hover:bg-blue-100", {
                    "bg-blue-100": category === selectedCategory,
                  })}
                  onClick={() => {
                    setSelectedCategory(category);
                  }}
                >
                  <p>{category}</p>
                </div>
              ))}
            </div>
            <div className="rt--sidebar-add-scene-modal-body">
              {sceneCategories
                .filter(
                  (x) => selectedCategory === "All" || selectedCategory === x,
                )
                .map((category) => (
                  <div key={category} className="w-full">
                    <div className="stack-row">
                      {React.createElement(sceneCategoriesConfig[category], {
                        fontSize: 20,
                      })}
                      <p className="font-bold text-xl mb-1">{category}</p>
                    </div>
                    <div className="stack-col gap-1 items-stretch">
                      {pluginMetaData?.pluginMeta.sceneCreator
                        .filter((x) => x.categories.includes(category))
                        .map((sceneCreator) => (
                          <div
                            key={sceneCreator.pluginName}
                            className={cx(
                              "cursor-pointer border-1 border-stroke p-2 hover:border-blue-400",
                              selectedPlugin === sceneCreator.pluginName
                                ? "bg-gray-100"
                                : "",
                            )}
                            onClick={() => {
                              setSelectedPlugin(sceneCreator.pluginName);
                            }}
                          >
                            <div className="stack-row">
                              <p className="font-bold">{sceneCreator.title}</p>
                              {sceneCreator.isExperimental && (
                                <Badge variant="info">EXPERIMENTAL</Badge>
                              )}
                              {sceneCreator.isStarred && (
                                <FaStar className="text-yellow-400" />
                              )}
                            </div>
                            <p>{sceneCreator.description}</p>
                          </div>
                        ))}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </DialogBody>
        <DialogFooter>
          <Button
            variant="success"
            disabled={selectedPlugin === null}
            onClick={() => {
              addPlugin();
            }}
          >
            Add Scene
          </Button>
          <Button variant="outline" onClick={onToggle}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SidebarAddSceneModal;
