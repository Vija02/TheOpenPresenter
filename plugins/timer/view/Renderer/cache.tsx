import { memoize } from "lodash-es";
import { hash } from "ohash";

export type TimerTextStyle = {
  fontFamily: string;
  fontWeight: string | number;
};

export type TextLine = {
  text: string;
  fontSize: string;
  dy: string; // e.g., "1em", "1.2em"
};

export type MeasurementInput = {
  lines: TextLine[];
  style: TimerTextStyle;
};

export const getSvgMeasurement = memoize(measureSVGText, (props) =>
  hash(props),
);

function measureSVGText({ lines, style }: MeasurementInput) {
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
  textElement.style.fontWeight = style.fontWeight.toString();
  textElement.style.fontFamily = style.fontFamily;
  textElement.style.textAnchor = "middle";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const el = document.createElementNS("http://www.w3.org/2000/svg", "tspan");
    el.setAttribute("x", "50%");
    el.setAttribute("dy", line.dy);
    el.style.fontSize = line.fontSize;
    el.textContent = line.text;

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
