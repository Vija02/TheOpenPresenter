import { ModalProps, useDisclosure } from "@chakra-ui/react";
import { cloneElement, useCallback, useState } from "react";

/**
 * This is the minimum props the overlay component needs to have
 */
export type OverlayToggleComponentProps = {
  isOpen: ModalProps["isOpen"];

  /** Function to call from modal component to toggle `isOpen` */
  onToggle?: () => void;

  /** Function to remount the modal component */
  resetData?: () => void;
};

/**
 * These props will be exposed to the toggler function
 */
export type OverlayToggleTogglerFunctionProps = {
  onOpen: () => void;
  onToggle: () => void;
};

export type OverlayTogglePropTypes = {
  /** The function returning ReactNode that will toggle the Overlay component */
  toggler: (_prop: OverlayToggleTogglerFunctionProps) => React.ReactNode;
  /** The Overlay component (Eg: Modal, Drawer) */
  children: React.ReactElement<OverlayToggleComponentProps>;
};

/**
 * This component lets us render a overlay component alongside a custom toggler
 * Doing this offloads the `isOpen` state to this component, reducing unnecessary re-renders
 */
export const OverlayToggle = ({
  toggler,
  children,
}: OverlayTogglePropTypes) => {
  const { isOpen, onToggle, onOpen } = useDisclosure();
  const [key, setKey] = useState(0);

  const resetData = useCallback(() => {
    setKey((x) => x + 1);
  }, []);

  return (
    <>
      {toggler({ onOpen, onToggle })}
      {cloneElement(children, {
        key,
        isOpen,
        onToggle,
        resetData,
      })}
    </>
  );
};
