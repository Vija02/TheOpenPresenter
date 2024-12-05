const minRange = 120;
const maxRange = 700;

export const mapZoomToRange = (zoomLevel: number, maxWidth: number) => {
  return Math.min((maxRange - minRange) * zoomLevel + minRange, maxWidth);
};
