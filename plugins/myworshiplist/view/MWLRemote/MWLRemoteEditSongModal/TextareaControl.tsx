import { Textarea, TextareaProps } from "@chakra-ui/react";
import { useField, useFormikContext } from "formik";
import { BaseProps, FormControl } from "formik-chakra-ui";
import React, { FC } from "react";

export type TextareaControlProps = BaseProps & {
  textareaProps?: TextareaProps;
};

export const TextareaControl: FC<TextareaControlProps> = React.forwardRef(
  (
    props: TextareaControlProps,
    ref: React.ForwardedRef<HTMLTextAreaElement>,
  ) => {
    const { name, label, textareaProps, ...rest } = props;
    const [field] = useField(name);
    const { isSubmitting } = useFormikContext();

    return (
      <FormControl name={name} label={label} {...rest}>
        <div
          className="text-area-grow"
          data-replicated-value={field.value + "\n"}
        >
          <Textarea
            {...field}
            id={name}
            isDisabled={isSubmitting}
            ref={ref}
            {...textareaProps}
          />
        </div>
      </FormControl>
    );
  },
);

export default TextareaControl;
