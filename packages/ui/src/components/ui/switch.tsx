import { cn } from "@/lib/utils";
import * as React from "react";
import { Switch as SwitchPrimitive } from "radix-ui";

import "./switch.css";

function Switch({
  className,
  size = "default",
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root> & {
  size?: "sm" | "default";
}) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      data-size={size}
      className={cn("ui--switch peer group/switch", className)}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="ui--switch-thumb"
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
