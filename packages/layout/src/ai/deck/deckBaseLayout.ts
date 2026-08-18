import { DEFAULT_FONT_STACK } from "../../fonts/registry";
import {
  createLayoutDoc,
  createShapeElement,
  createTextElement,
} from "../../schema/defaults";
import { LayoutDoc } from "../../schema/document";
import { solidPaint } from "../../schema/paint";

/**
 * The base composed slide layouts the deck agent builds from structured
 * content, before any per-slide styling pass.
 *
 * These mirror the slides plugin's starter presets
 */

const DEFAULT_BACKGROUND = "#ffffff";
const DEFAULT_COLOR = "#1a1a1a";

type Common = {
  background?: string;
  color?: string;
};

const backgroundElement = (color: string) =>
  createShapeElement({
    id: "background",
    name: "Background",
    kind: "rect",
    rect: { x: 0, y: 0, w: 100, h: 100 },
    fill: solidPaint(color),
    locked: true,
  });

export const blankSlideDoc = ({ background }: Common = {}): LayoutDoc =>
  createLayoutDoc({
    fitMode: "fluid",
    elements: [backgroundElement(background ?? DEFAULT_BACKGROUND)],
  });

export const titleSlideDoc = ({
  title,
  subtitle,
  background,
  color,
}: Common & { title: string; subtitle?: string | null }): LayoutDoc => {
  const ink = color ?? DEFAULT_COLOR;
  return createLayoutDoc({
    fitMode: "fluid",
    elements: [
      backgroundElement(background ?? DEFAULT_BACKGROUND),
      createTextElement({
        id: "title",
        name: "Title",
        rect: { x: 8, y: 32, w: 84, h: 26 },
        fit: "shrinkToFit",
        content: title,
        hideWhenEmpty: true,
        style: {
          fontFamily: DEFAULT_FONT_STACK,
          fontSize: 9,
          fontWeight: 700,
          color: ink,
          align: "center",
          valign: "center",
          lineHeight: 1.1,
        },
      }),
      createTextElement({
        id: "subtitle",
        name: "Subtitle",
        rect: { x: 8, y: 60, w: 84, h: 12 },
        fit: "shrinkToFit",
        content: subtitle ?? "",
        hideWhenEmpty: true,
        style: {
          fontFamily: DEFAULT_FONT_STACK,
          fontSize: 4,
          fontWeight: 400,
          color: ink,
          align: "center",
          valign: "top",
          lineHeight: 1.3,
        },
      }),
    ],
  });
};

export const sectionSlideDoc = ({
  title,
  background,
  color,
}: Common & { title: string }): LayoutDoc => {
  const ink = color ?? DEFAULT_COLOR;
  return createLayoutDoc({
    fitMode: "fluid",
    elements: [
      backgroundElement(background ?? DEFAULT_BACKGROUND),
      createShapeElement({
        id: "accent",
        name: "Accent bar",
        kind: "rect",
        rect: { x: 8, y: 60, w: 16, h: 1.2 },
        fill: solidPaint("#3b82f6"),
      }),
      createTextElement({
        id: "title",
        name: "Section",
        rect: { x: 8, y: 36, w: 84, h: 20 },
        fit: "shrinkToFit",
        content: title,
        hideWhenEmpty: true,
        style: {
          fontFamily: DEFAULT_FONT_STACK,
          fontSize: 11,
          fontWeight: 700,
          color: ink,
          align: "left",
          valign: "bottom",
          lineHeight: 1.1,
        },
      }),
    ],
  });
};

export const contentSlideDoc = ({
  title,
  body,
  background,
  color,
}: Common & { title: string; body: string }): LayoutDoc => {
  const ink = color ?? DEFAULT_COLOR;
  return createLayoutDoc({
    fitMode: "fluid",
    elements: [
      backgroundElement(background ?? DEFAULT_BACKGROUND),
      createTextElement({
        id: "title",
        name: "Title",
        rect: { x: 8, y: 9, w: 84, h: 16 },
        fit: "shrinkToFit",
        content: title,
        hideWhenEmpty: true,
        style: {
          fontFamily: DEFAULT_FONT_STACK,
          fontSize: 7,
          fontWeight: 700,
          color: ink,
          align: "left",
          valign: "center",
          lineHeight: 1.1,
        },
      }),
      createTextElement({
        id: "body",
        name: "Body",
        rect: { x: 8, y: 29, w: 84, h: 60 },
        fit: "shrinkToFit",
        content: body,
        hideWhenEmpty: true,
        style: {
          fontFamily: DEFAULT_FONT_STACK,
          fontSize: 4.5,
          fontWeight: 400,
          color: ink,
          align: "left",
          valign: "top",
          lineHeight: 1.35,
        },
      }),
    ],
  });
};
