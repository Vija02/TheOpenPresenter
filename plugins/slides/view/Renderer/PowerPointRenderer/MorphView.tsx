import { morphLayers, morphTransform } from "../../../src/office/morph";
import type {
  OfficeDeck,
  OfficeMorphFrame,
  OfficeMorphPair,
  OfficeSlide,
  OfficeSprite,
} from "../../../src/office/types";
import {
  type ResolveImage,
  SlideBackground,
  SlideStage,
  Sprite,
} from "./OfficeSlideView";

type Side = { slide: OfficeSlide; resolveImage: ResolveImage };

/** The sprites a morph frame names on its slide */
const frameSprites = (
  frame: OfficeMorphFrame,
  slide: OfficeSlide,
): OfficeSprite[] =>
  frame.shapes.flatMap(({ id, pieces }) => {
    const shape = slide.shapes.find((s) => s.id === id);
    if (!shape) return [];
    if (pieces) {
      return pieces.flatMap((i) =>
        shape.children[i] ? [shape.children[i]] : [],
      );
    }
    return shape.region
      ? [{ x: shape.x, y: shape.y, region: shape.region }]
      : shape.children;
  });

/**
 * The Morph transition from `from` to `to` at `t` (0..1): backgrounds
 * crossfade while each matched object glides to its new place.
 */
export const MorphView = ({
  deck,
  pairs,
  from,
  to,
  t,
}: {
  deck: Pick<OfficeDeck, "width" | "height">;
  pairs: OfficeMorphPair[];
  from: Side;
  to: Side;
  t: number;
}) => (
  <SlideStage deck={deck}>
    <SlideBackground slide={from.slide} resolveImage={from.resolveImage} />
    <SlideBackground
      slide={to.slide}
      resolveImage={to.resolveImage}
      style={{ opacity: t }}
    />
    {morphLayers(pairs, t).map((layer, index) => {
      const side = layer.side === "from" ? from : to;
      return (
        <div
          key={index}
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: deck.width,
            height: deck.height,
            transformOrigin: "0 0",
            transform: morphTransform(layer.frame, layer.box),
            opacity: layer.opacity,
            pointerEvents: "none",
          }}
        >
          {frameSprites(layer.frame, side.slide).map((sprite, i) => (
            <Sprite
              key={i}
              sprite={sprite}
              state={null}
              resolveImage={side.resolveImage}
            />
          ))}
        </div>
      );
    })}
  </SlideStage>
);
