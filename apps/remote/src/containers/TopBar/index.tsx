import { appData } from "@repo/lib";
import { useData, usePluginData, usePluginMetaData } from "@repo/shared";
import { Button, Link, OverlayToggle, PopConfirm } from "@repo/ui";
import { cx } from "class-variance-authority";
import { useMemo } from "react";
import { RxCross1 } from "react-icons/rx";
import { VscArrowLeft, VscSettingsGear, VscTrash } from "react-icons/vsc";
import { useLocation } from "wouter";

import ProjectSettingsModal from "../ProjectSettingsModal";
import SceneSettingsModal from "../SceneSettingsModal";
import "./index.css";

export const TopBar = () => {
  const [location] = useLocation();
  const { orgSlug, pluginMetaData } = usePluginMetaData();

  // When in proxy mode, use the cloud org slug for navigation back to projects
  const proxyConfig = appData.getProxyConfig();
  const projectsOrgSlug = proxyConfig.isProxy
    ? proxyConfig.cloudOrgSlug
    : orgSlug;

  const data = useData();
  const mainState = usePluginData().mainState!;

  const selectedScene = useMemo(
    () => (data.data[location.slice(1)] ? location.slice(1) : null),
    [data.data, location],
  );

  const project = useMemo(
    () => pluginMetaData?.organizationBySlug?.projects.nodes[0],
    [pluginMetaData?.organizationBySlug?.projects.nodes],
  );

  return (
    <div className="rt--top-bar">
      <div className="rt--top-bar--left">
        <div className="rt--top-bar--breadcrumb">
          <Link
            href={`/o/${projectsOrgSlug}`}
            className="rt--top-bar--breadcrumb-link"
          >
            Projects
          </Link>
          <span className="text-tertiary">/</span>
          <OverlayToggle
            toggler={({ onToggle }) => (
              <span
                className="rt--top-bar--project-name group"
                onClick={onToggle}
              >
                {project?.name}
                <VscSettingsGear className="rt--top-bar--project-settings-icon" />
              </span>
            )}
          >
            <ProjectSettingsModal />
          </OverlayToggle>
        </div>
        <Link href={`/o/${projectsOrgSlug}`} className="rt--top-bar--back-link">
          <VscArrowLeft />
        </Link>
        {selectedScene && (
          <>
            <p
              className="rt-top-bar--scene-name"
              title={data.data[selectedScene]?.name}
            >
              {data.data[selectedScene]?.name}
            </p>
            <div className="rt-top-bar--toolbar">
              <OverlayToggle
                toggler={({ onToggle }) => (
                  <Button
                    size="sm"
                    variant="ghost"
                    role="group"
                    onClick={onToggle}
                  >
                    <VscSettingsGear className="rt--top-bar--scene-settings-icon" />
                  </Button>
                )}
              >
                <SceneSettingsModal selectedScene={selectedScene} />
              </OverlayToggle>
              <PopConfirm
                onConfirm={() => {
                  delete mainState.data[selectedScene];
                  if (mainState.renderer["1"]?.currentScene === selectedScene) {
                    mainState.renderer["1"]!.currentScene = null;
                  }
                }}
              >
                <Button size="sm" variant="ghost" role="group">
                  <VscTrash className="rt--top-bar--delete-icon" />
                </Button>
              </PopConfirm>
            </div>
          </>
        )}
      </div>
      <div className="rt--top-bar--right">
        <Button
          size="sm"
          className={cx(
            "rt--top-bar--overlay-btn",
            data.renderer["1"]!.overlay?.type === "black" &&
              "rt--top-bar--selected",
          )}
          onClick={() => {
            if (mainState.renderer["1"]!.overlay?.type === "black") {
              mainState.renderer["1"]!.overlay = null;
            } else {
              mainState.renderer["1"]!.overlay = { type: "black" };
            }
          }}
          data-testid=""
        >
          Black
        </Button>
        {mainState.renderer["1"]!.overlay !== null && (
          <Button
            size="sm"
            onClick={() => {
              mainState.renderer["1"]!.overlay = null;
            }}
          >
            <RxCross1 />
          </Button>
        )}
      </div>
    </div>
  );
};
