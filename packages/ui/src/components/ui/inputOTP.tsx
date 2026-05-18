import { cn } from "@/lib/utils";
import { OTPInput, OTPInputContext } from "input-otp";
import { MinusIcon } from "lucide-react";
import * as React from "react";
import { Control } from "react-hook-form";

import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "./form";
import "./inputOTP.css";

function InputOTP({
  className,
  containerClassName,
  ...props
}: React.ComponentProps<typeof OTPInput> & {
  containerClassName?: string;
}) {
  return (
    <OTPInput
      data-slot="input-otp"
      containerClassName={cn("ui--otp", containerClassName)}
      className={cn("ui--otp-input", className)}
      {...props}
    />
  );
}

function InputOTPGroup({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="input-otp-group"
      className={cn("ui--otp-group", className)}
      {...props}
    />
  );
}

function InputOTPSlot({
  index,
  className,
  ...props
}: React.ComponentProps<"div"> & { index: number }) {
  const inputOTPContext = React.useContext(OTPInputContext);
  const { char, hasFakeCaret, isActive } =
    inputOTPContext?.slots[index] ?? {};

  return (
    <div
      data-slot="input-otp-slot"
      data-active={isActive}
      className={cn("ui--otp-slot", className)}
      {...props}
    >
      {char}
      {hasFakeCaret && (
        <div className="ui--otp-caret">
          <div className="ui--otp-caret-bar" />
        </div>
      )}
    </div>
  );
}

function InputOTPSeparator({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="input-otp-separator"
      role="separator"
      className={cn("ui--otp-separator", className)}
      {...props}
    >
      <MinusIcon />
    </div>
  );
}

function InputOTPControl({
  control,
  name,
  label,
  description,
  maxLength,
  children,
  containerClassName,
  className,
  ...props
}: Omit<React.ComponentProps<typeof OTPInput>, "render"> & {
  name: string;
  label?: string;
  description?: string;
  control: Control<any, any, any>;
  children?: React.ReactNode;
  containerClassName?: string;
}) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          {label && <FormLabel>{label}</FormLabel>}
          <FormControl>
            <InputOTP
              maxLength={maxLength}
              containerClassName={containerClassName}
              className={className}
              {...field}
              {...props}
            >
              {children}
            </InputOTP>
          </FormControl>
          {description && <FormDescription>{description}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

export {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
  InputOTPSeparator,
  InputOTPControl,
};
