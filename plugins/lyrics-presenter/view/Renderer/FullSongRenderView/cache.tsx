import { memoize } from "lodash-es";
import { objectHash } from "ohash";

import { SlideStyle } from "../../../src";

export const getSvgMeasurement = memoize(measureSVGText, (props) =>
  objectHash(props),
);

function measureSVGText({
  slideStyle,
  heading,
  textLines,
}: {
  slideStyle: Required<SlideStyle>;
  heading: string;
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
  textElement.style.fontStyle = slideStyle.fontStyle;
  textElement.style.fontFamily = slideStyle.fontFamily;

  const headingEl = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "tspan",
  );
  headingEl.setAttribute("x", "0%");
  headingEl.setAttribute("dy", "2rem");
  headingEl.setAttribute("font-size", "0.6rem");
  headingEl.textContent = heading;
  textElement.appendChild(headingEl);
  for (const [index, line] of textLines.entries()) {
    const el = document.createElementNS("http://www.w3.org/2000/svg", "tspan");
    el.setAttribute("x", "0%");
    el.setAttribute(
      "dy",
      index === 0 ? "1.2rem" : slideStyle.lineHeight + "em",
    );
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
