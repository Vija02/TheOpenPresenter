import {
  CSSProperties,
  ReactElement,
  ReactNode,
  cloneElement,
  useState,
} from "react";

import { usePublicAccess } from "./PublicAccess";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "./components/ui/tooltip";

type Controllable = ReactElement<{
  disabled?: boolean;
  style?: CSSProperties;
}>;

type LoginRequiredProps = {
  required?: boolean;
  message?: ReactNode;
  children: Controllable;
};

/** Disables its child for guests, with a tooltip saying to log in. */
export const LoginRequired = ({
  required: requiredProp,
  message = "Log in to use this",
  children,
}: LoginRequiredProps) => {
  const [open, setOpen] = useState(false);
  const isPublicAccess = usePublicAccess();
  const required = requiredProp ?? isPublicAccess;

  if (!required) return children;

  return (
    <Tooltip open={open} onOpenChange={setOpen}>
      <TooltipTrigger asChild>
        <span
          tabIndex={0}
          onClick={() => setOpen(true)}
          className="inline-flex cursor-not-allowed"
          data-testid="login-required"
        >
          {cloneElement(children, {
            disabled: true,
            style: { ...children.props.style, pointerEvents: "none" },
          })}
        </span>
      </TooltipTrigger>
      <TooltipContent>{message}</TooltipContent>
    </Tooltip>
  );
};
