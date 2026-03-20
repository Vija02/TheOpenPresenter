import React, { useCallback, useRef, useState } from "react";

import { MediaPickerOptions, MediaPickerResult } from "../../types";
import { MediaPickerContext } from "./MediaPickerContext";
import { MediaPickerModal } from "./MediaPickerModal";

export type MediaPickerProviderProps = {
  children: React.ReactNode;
  organizationId: string;
};

type ModalState = {
  isOpen: boolean;
  options?: MediaPickerOptions;
  resolve?: (result: MediaPickerResult | null) => void;
};

export const MediaPickerProvider: React.FC<MediaPickerProviderProps> = ({
  children,
  organizationId,
}) => {
  const [modalState, setModalState] = useState<ModalState>({ isOpen: false });
  const resolveRef = useRef<
    ((result: MediaPickerResult | null) => void) | null
  >(null);

  const show = useCallback(
    (options?: MediaPickerOptions): Promise<MediaPickerResult | null> => {
      return new Promise((resolve) => {
        resolveRef.current = resolve;
        setModalState({
          isOpen: true,
          options,
        });
      });
    },
    [],
  );

  const handleClose = useCallback(() => {
    if (resolveRef.current) {
      resolveRef.current(null);
      resolveRef.current = null;
    }
    setModalState({ isOpen: false });
  }, []);

  const handleSelect = useCallback((result: MediaPickerResult) => {
    if (resolveRef.current) {
      resolveRef.current(result);
      resolveRef.current = null;
    }
    setModalState({ isOpen: false });
  }, []);

  return (
    <MediaPickerContext.Provider value={{ show }}>
      {children}
      <MediaPickerModal
        isOpen={modalState.isOpen}
        onClose={handleClose}
        onSelect={handleSelect}
        organizationId={organizationId}
        options={modalState.options}
      />
    </MediaPickerContext.Provider>
  );
};
