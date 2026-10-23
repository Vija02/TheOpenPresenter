import { OrganizationType } from "@repo/graphql";
import { projectTitle } from "@repo/lib";
import { useData, usePluginData, usePluginMetaData } from "@repo/shared";
import { Button, Link, OverlayToggle, PopConfirm } from "@repo/ui";
import { cx } from "class-variance-authority";
import { useMemo } from "react";
import { RxCross1 } from "react-icons/rx";
import {
  VscArrowLeft,
  VscMenu,
  VscSettingsGear,
  VscTrash,
} from "react-icons/vsc";
import { useLocation } from "wouter";

import { useMobileSidebar } from "../../contexts/mobileSidebar";
import { useRendererSelection } from "../../contexts/rendererSelection";
import { useBackLink } from "../../hooks/useBackLink";
import { useIsSmallPhone } from "../../hooks/useIsSmallPhone";
import { deleteScene } from "../../util/sceneActions";
import ProjectSettingsModal from "../ProjectSettingsModal";
import SceneSettingsModal from "../SceneSettingsModal";
import { PresentButton } from "../Sidebar/PresentButton";
import "./index.css";

export const TopBar = () => {
  const [location] = useLocation();
  const { project, organizationType } = usePluginMetaData();
  const { selectedRendererId } = useRendererSelection();
  const { open: openSidebar } = useMobileSidebar();
  const isSmallPhone = useIsSmallPhone();

  const { href: backHref, label: backLabel } = useBackLink();

  const data = useData();
  const mainState = usePluginData().mainState!;

  const selectedScene = useMemo(
    () => (data.data[location.slice(1)] ? location.slice(1) : null),
    [data.data, location],
  );

  return (
    <div className={cx("rt--top-bar", isSmallPhone && "rt--top-bar__compact")}>
      <div className="rt--top-bar--left">
        <div className="rt--top-bar--breadcrumb">
          <Link href={backHref} className="rt--top-bar--breadcrumb-link">
            {backLabel}
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
        {isSmallPhone ? (
          <Button
            size="sm"
            variant="ghost"
            className="rt--top-bar--menu"
            aria-label="Menu"
            title="Menu"
            onClick={openSidebar}
          >
            <VscMenu />
          </Button>
        ) : (
          <Link href={backHref} className="rt--top-bar--back-link">
            <VscArrowLeft />
          </Link>
        )}
        {isSmallPhone && (
          <div className="rt--top-bar--titles">
            <p>{project ? projectTitle(project) : ""}</p>
            {selectedScene && <p>{data.data[selectedScene]?.name}</p>}
          </div>
        )}
        {!isSmallPhone && selectedScene && (
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
                onConfirm={() => deleteScene(mainState, selectedScene)}
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
        <PresentButton size="sm" className="rt--top-bar--present" />
        {organizationType !== OrganizationType.Venue && (
          <Button
            size="sm"
            className={cx(
              "rt--top-bar--overlay-btn",
              data.renderer[selectedRendererId]?.overlay?.type === "clear" &&
                "rt--top-bar--selected",
            )}
            onClick={() => {
              if (
                mainState.renderer[selectedRendererId]?.overlay?.type ===
                "clear"
              ) {
                mainState.renderer[selectedRendererId]!.overlay = null;
              } else {
                mainState.renderer[selectedRendererId]!.overlay = {
                  type: "clear",
                };
              }
            }}
          >
            Clear
          </Button>
        )}

        <Button
          size="sm"
          className={cx(
            "rt--top-bar--overlay-btn",
            data.renderer[selectedRendererId]?.overlay?.type === "black" &&
              "rt--top-bar--selected",
          )}
          onClick={() => {
            if (
              mainState.renderer[selectedRendererId]?.overlay?.type === "black"
            ) {
              mainState.renderer[selectedRendererId]!.overlay = null;
            } else {
              mainState.renderer[selectedRendererId]!.overlay = {
                type: "black",
              };
            }
          }}
          data-testid=""
        >
          Black
        </Button>
        {mainState.renderer[selectedRendererId]?.overlay !== null && (
          <Button
            size="sm"
            onClick={() => {
              mainState.renderer[selectedRendererId]!.overlay = null;
            }}
          >
            <RxCross1 />
          </Button>
        )}
      </div>
    </div>
  );
};
