import {
  NumberDecrementStepper,
  NumberIncrementStepper,
  NumberInput,
  NumberInputField,
  NumberInputProps,
  NumberInputStepper,
  Stack,
  Text,
} from "@chakra-ui/react";
import { useField, useFormikContext } from "formik";
import { BaseProps, FormControl } from "formik-chakra-ui";
import React, { FC } from "react";

export type NumberInputControlWithUnitProps = BaseProps & {
  numberInputProps?: NumberInputProps;
  showStepper?: boolean;
  children?: React.ReactNode;
  unit?: string;
};

export const NumberInputControlWithUnit: FC<NumberInputControlWithUnitProps> =
  React.forwardRef(
    (
      props: NumberInputControlWithUnitProps,
      ref: React.ForwardedRef<HTMLInputElement>,
    ) => {
      const {
        name,
        label,
        showStepper = true,
        children,
        numberInputProps,
        unit,
        ...rest
      } = props;
      const [field, { error, touched }] = useField(name);
      const { setFieldValue, isSubmitting } = useFormikContext();

      const $setFieldValue = (name: string) => (value: any) =>
        setFieldValue(name, value);

      return (
        <FormControl name={name} label={label} {...rest}>
          <Stack direction="row" alignItems="center">
            <NumberInput
              {...field}
              id={name}
              onChange={$setFieldValue(name)}
              isInvalid={!!error && touched}
              isDisabled={isSubmitting}
              {...numberInputProps}
            >
              <NumberInputField name={name} ref={ref} />
              {showStepper && (
                <NumberInputStepper>
                  <NumberIncrementStepper />
                  <NumberDecrementStepper />
                </NumberInputStepper>
              )}
              {children}
            </NumberInput>
            <Text fontSize="lg" fontWeight="medium">
              {unit}
            </Text>
          </Stack>
        </FormControl>
      );
    },
  );

export default NumberInputControlWithUnit;
