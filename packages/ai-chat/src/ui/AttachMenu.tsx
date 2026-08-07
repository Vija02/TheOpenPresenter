import {
  Button,
  Popover,
  PopoverContent,
  PopoverMenuItem,
  PopoverTrigger,
} from "@repo/ui";
import { useRef } from "react";
import { VscAttach, VscDesktopDownload, VscFileMedia } from "react-icons/vsc";

import { AiChat } from "../useAiChat";

export const AttachMenu = ({ ai }: { ai: AiChat }) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const disabled = ai.pending || ai.attaching;

  const hiddenInput = (
    <input
      ref={fileRef}
      type="file"
      accept="image/*"
      className="hidden"
      onChange={(e) => {
        const file = e.target.files?.[0];
        e.target.value = "";
        if (file) ai.attachImage(file);
      }}
    />
  );

  const trigger = (
    <Button
      variant="ghost"
      size="xs"
      disabled={disabled}
      aria-label="Attach a reference image"
      title="Attach a reference image"
    >
      <VscAttach />
    </Button>
  );

  if (!ai.pickFromLibrary) {
    return (
      <>
        {hiddenInput}
        <Button
          variant="ghost"
          size="xs"
          disabled={disabled}
          onClick={() => fileRef.current?.click()}
          aria-label="Attach a reference image"
          title="Attach a reference image"
        >
          <VscAttach />
        </Button>
      </>
    );
  }

  return (
    <>
      {hiddenInput}
      <Popover>
        <PopoverTrigger asChild>{trigger}</PopoverTrigger>
        <PopoverContent
          align="start"
          side="top"
          hideCloseButton
          hideArrow
          className="w-auto min-w-max p-1"
        >
          <PopoverMenuItem
            label="Upload an image"
            icon={<VscDesktopDownload />}
            onClick={() => fileRef.current?.click()}
          />
          <PopoverMenuItem
            label="Choose from media library"
            icon={<VscFileMedia />}
            onClick={() => ai.pickFromLibrary?.()}
          />
        </PopoverContent>
      </Popover>
    </>
  );
};
