import { memoize } from "lodash-es";
import { objectHash } from "ohash";

import { SlideStyle } from "../../../src";

export const getSvgMeasurement = memoize(measureSVGText, (props) =>
  objectHash(props),
);

function measureSVGText({
  slideStyle,
  textLines,
}: {
  slideStyle: Required<SlideStyle>;
  textLines: string[];
}) {
  // Create an offscreen SVG element
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");

  svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  svg.setAttribute("width", "0");
  svg.setAttribute("height", "0");
  svg.style.position = "absolute";
  svg.style.top = "-9999px";
  svg.style.left = "-9999px";

  // Create a text element
  const textElement = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "text",
  );

  textElement.setAttribute("x", "0");
  textElement.setAttribute("y", "0");
  textElement.style.fontSize = "1rem";
  textElement.style.fontWeight = slideStyle.fontWeight.toString();
  textElement.style.fontFamily = `-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"`;

  for (const line of textLines) {
    const el = document.createElementNS("http://www.w3.org/2000/svg", "tspan");
    el.setAttribute("x", "50%");
    el.setAttribute("dy", "1em");
    el.textContent = line;

    textElement.appendChild(el);
  }

  // Append the text element to the SVG
  svg.appendChild(textElement);
  document.body.appendChild(svg);

  // Get the bounding box of the text element
  const bbox = textElement.getBBox();
  const roundedBBox = svg.createSVGRect();

  roundedBBox.width = Math.ceil(bbox.width);
  roundedBBox.height = Math.ceil(bbox.height);

  // Remove the SVG element from the DOM
  document.body.removeChild(svg);

  return roundedBBox;
}
