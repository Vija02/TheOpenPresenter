import React, { useCallback, useRef, useState } from "react";

import { MediaPickerOptionsInternal, MediaPickerResult } from "../../types";
import { MediaPickerContext } from "./MediaPickerContext";
import { MediaPickerModal } from "./MediaPickerModal";

export type MediaPickerProviderProps = {
  children: React.ReactNode;
};

type ModalState = {
  isOpen: boolean;
  options: MediaPickerOptionsInternal;
  resolve?: (result: MediaPickerResult | null) => void;
};

const baseModalState = {
  isOpen: false,
  options: {
    pluginContext: {
      organizationId: "",
      pluginId: "",
      projectId: "",
      sceneId: "",
    },
  },
};

export const MediaPickerProvider: React.FC<MediaPickerProviderProps> = ({
  children,
}) => {
  const [modalState, setModalState] = useState<ModalState>(baseModalState);
  const resolveRef = useRef<
    ((result: MediaPickerResult | null) => void) | null
  >(null);

  const show = useCallback(
    (
      options: MediaPickerOptionsInternal,
    ): Promise<MediaPickerResult | null> => {
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
    setModalState(baseModalState);
  }, []);

  const handleSelect = useCallback((result: MediaPickerResult) => {
    if (resolveRef.current) {
      resolveRef.current(result);
      resolveRef.current = null;
    }
    setModalState(baseModalState);
  }, []);

  return (
    <MediaPickerContext.Provider value={{ show }}>
      {children}
      <MediaPickerModal
        isOpen={modalState.isOpen}
        onClose={handleClose}
        onSelect={handleSelect}
        options={modalState.options}
      />
    </MediaPickerContext.Provider>
  );
};
