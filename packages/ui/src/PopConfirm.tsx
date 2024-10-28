import {
  Button,
  ButtonProps,
  Group,
  HStack,
  PopoverRootProps,
  Text,
  useToken,
} from "@chakra-ui/react";
import React from "react";
import { FiAlertTriangle } from "react-icons/fi";

import {
  PopoverArrow,
  PopoverBody,
  PopoverCloseTrigger,
  PopoverContent,
  PopoverFooter,
  PopoverHeader,
  PopoverRoot,
  PopoverTrigger,
} from "./Chakra";

export interface PopConfirmProps {
  title: React.ReactNode;
  placement?: PopoverRootProps["positioning"];
  onConfirm?: (e?: React.MouseEvent<HTMLElement>) => void;
  onCancel?: (e?: React.MouseEvent<HTMLElement>) => void;
  okText?: React.ReactNode;
  cancelText?: React.ReactNode;
  okButtonProps?: ButtonProps;
  cancelButtonProps?: ButtonProps;
  onVisibleChange?: (visible: boolean) => void;
  children?: React.ReactNode;
}

export function PopConfirm({
  title,
  placement = "bottom-end",
  onConfirm,
  onCancel,
  okText = "No",
  cancelText = "Yes",
  okButtonProps,
  cancelButtonProps,
  onVisibleChange = () => {},
  children,
}: PopConfirmProps) {
  const [red400] = useToken("colors", ["red.400"]);

  return (
    <PopoverRoot
      positioning={{ placement }}
      closeOnBlur
      boundary="scrollParent"
      isLazy
      onOpen={() => onVisibleChange(true)}
      onClose={() => onVisibleChange(false)}
    >
      <>
        <PopoverTrigger>{children}</PopoverTrigger>
        <PopoverContent borderColor="red.400" _focus={{ boxShadow: "none" }}>
          <PopoverHeader pt={4} fontWeight="bold" border="0">
            <HStack justifyContent="center">
              <FiAlertTriangle color={red400} /> <Text>Are you sure?</Text>
            </HStack>
          </PopoverHeader>
          <PopoverArrow
            borderTop="1px solid"
            borderLeft="1px solid"
            borderColor="red.400"
          />
          <PopoverCloseTrigger
          // onClick={(e) => {
          //   onClose();
          //   if (onCancel) onCancel(e);
          // }}
          />
          <PopoverBody color="black">{title}</PopoverBody>
          <PopoverFooter
            border="0"
            display="flex"
            alignItems="center"
            justifyContent="center"
            pb={4}
          >
            <Group attached>
              {/* <Button
                size="sm"
                onClick={(e) => {
                  onClose();
                  if (onCancel) onCancel(e);
                }}
                variant="outline"
                {...cancelButtonProps}
              >
                {cancelText}
              </Button> */}
              <Button
                size="sm"
                colorScheme="red"
                onClick={onConfirm}
                {...okButtonProps}
              >
                {okText}
              </Button>
            </Group>
          </PopoverFooter>
        </PopoverContent>
      </>
    </PopoverRoot>
  );
}
