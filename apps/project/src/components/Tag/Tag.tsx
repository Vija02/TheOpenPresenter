import { TagFragment } from "@repo/graphql";
import { Tooltip, TooltipContent, TooltipTrigger } from "@repo/ui";
import React from "react";
import { FiX } from "react-icons/fi";

import useCalculatedColor from "./useCalculatedColor";

export type TagPropTypes = {
  tag: Pick<
    TagFragment,
    "name" | "description" | "backgroundColor" | "foregroundColor" | "variant"
  >;
  placeholder?: string;
  showRemove?: boolean;
  onRemove?: React.MouseEventHandler<HTMLDivElement>;
};

export function Tag({
  tag,
  placeholder = "",
  showRemove = false,
  onRemove,
}: TagPropTypes) {
  const { name, description, backgroundColor, foregroundColor, variant } = tag;

  const {
    backgroundColor: calculatedBackgroundColor,
    foregroundColor: calculatedForegroundColor,
  } = useCalculatedColor(backgroundColor, foregroundColor);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          title={description || undefined}
          className={`
        inline-flex items-stretch text-xs rounded-xs overflow-hidden
        ${
          variant === "outline"
            ? `border border-solid bg-transparent`
            : `border-0`
        }
      `}
          style={{
            backgroundColor:
              variant === "outline" ? "transparent" : calculatedBackgroundColor,
            borderColor: calculatedBackgroundColor,
          }}
        >
          <div className="flex items-center overflow-hidden">
            <span
              className="px-2 py-1 whitespace-nowrap text-ellipsis overflow-hidden text-xs"
              style={{ color: calculatedForegroundColor }}
            >
              {!!name && name !== "" ? name : placeholder}
            </span>
          </div>
          {showRemove && (
            <div
              className="flex items-center px-2 hover:bg-black hover:opacity-30 cursor-pointer"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={onRemove}
            >
              <FiX color={calculatedForegroundColor} />
            </div>
          )}
        </div>
      </TooltipTrigger>
      {description && (
        <TooltipContent>
          <p>{description}</p>
        </TooltipContent>
      )}
    </Tooltip>
  );
}
