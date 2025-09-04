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
  OptionGroup,
  useOverlayToggle,
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

const sceneCategoriesConfig: Record<SceneCategories, IconType> = {
  Display: PiPresentationChart,
  Media: MdOutlineOndemandVideo,
  Audio: PiMusicNotesSimple,
};

const SidebarAddSceneModal = () => {
  const { isOpen, onToggle, resetData } = useOverlayToggle();

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
          <p className="rt--sidebar-add-scene-modal-description">
            Select a component to add:
          </p>
          <div className="rt--sidebar-add-scene-modal-content">
            <div className="rt--sidebar-add-scene-modal-sidebar">
              <p>Categories</p>
              {["All"].concat(sceneCategories).map((category) => (
                <div
                  key={category}
                  className={cx(
                    "rt--sidebar-add-scene-modal-category",
                    category === selectedCategory &&
                      "rt--sidebar-add-scene-modal-category__active",
                  )}
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
                  <div
                    key={category}
                    className="rt--sidebar-add-scene-modal-category-section"
                  >
                    <div className="rt--sidebar-add-scene-modal-category-header">
                      {React.createElement(sceneCategoriesConfig[category], {
                        fontSize: 20,
                      })}
                      <p>{category}</p>
                    </div>
                    <div className="rt--sidebar-add-scene-modal-plugins">
                      <OptionGroup
                        size="sm"
                        options={pluginMetaData?.pluginMeta.sceneCreator
                          .filter((x) => x.categories.includes(category))
                          .map((sceneCreator) => ({
                            title: (
                              <div className="rt--sidebar-add-scene-modal-plugin-header">
                                {sceneCreator.title}
                                {sceneCreator.isExperimental && (
                                  <Badge size="sm">EXPERIMENTAL</Badge>
                                )}
                                {sceneCreator.isStarred && (
                                  <FaStar className="rt--sidebar-add-scene-modal-star-icon" />
                                )}
                              </div>
                            ),
                            description: sceneCreator.description,
                            value: sceneCreator.pluginName,
                          }))}
                        value={selectedPlugin}
                        onValueChange={(val) => setSelectedPlugin(val)}
                      />
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
