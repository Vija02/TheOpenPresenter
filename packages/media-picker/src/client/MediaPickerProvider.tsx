import {
  MediaListOptions,
  MediaPickerOptionsInternal,
  MediaPickerResult,
} from "@repo/base-plugin";
import { MediaPickerContext } from "@repo/base-plugin/client";
import {
  OrganizationMediaForPickerDocument,
  OrganizationMediaForPickerQuery,
  OrganizationMediaForPickerQueryVariables,
} from "@repo/graphql";
import { isMediaReady } from "@repo/lib";
import React, { useCallback, useMemo, useRef, useState } from "react";
import { useClient } from "urql";

import { MediaPickerModal } from "./MediaPickerModal";
import { MediaWithMetadata } from "./types";
import { buildMediaPickerResult, filterMediaByType } from "./utils";

export type MediaPickerProviderProps = {
  children: React.ReactNode;
  isPublicAccess?: boolean;
};

type ModalState = {
  isOpen: boolean;
  options: MediaPickerOptionsInternal;
  resolve?: (result: MediaPickerResult | null) => void;
};

const baseModalState: ModalState = {
  isOpen: false,
  options: {
    pluginContext: {
      organizationId: "",
      pluginId: "",
      projectId: "",
      sceneId: "",
    },
    portalContainer: null,
  },
};

export const MediaPickerProvider: React.FC<MediaPickerProviderProps> = ({
  children,
  isPublicAccess = false,
}) => {
  const [modalState, setModalState] = useState<ModalState>(baseModalState);
  const resolveRef = useRef<
    ((result: MediaPickerResult[] | null) => void) | null
  >(null);

  const show = useCallback(
    (
      options: MediaPickerOptionsInternal,
    ): Promise<MediaPickerResult[] | null> => {
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

  const handleSelect = useCallback((results: MediaPickerResult[]) => {
    if (resolveRef.current) {
      resolveRef.current(results);
      resolveRef.current = null;
    }
    setModalState(baseModalState);
  }, []);

  const client = useClient();

  // Fresh each call, so uploads and finished processing show up
  const list = useCallback(
    async ({
      type = "all",
      pluginContext,
    }: MediaListOptions): Promise<MediaPickerResult[]> => {
      const result = await client
        .query<
          OrganizationMediaForPickerQuery,
          OrganizationMediaForPickerQueryVariables
        >(
          OrganizationMediaForPickerDocument,
          {
            organizationId: pluginContext.organizationId,
            condition: { isUserUploaded: true },
          },
          { requestPolicy: "network-only" },
        )
        .toPromise();
      // urql reports failures here rather than throwing
      if (result.error) throw result.error;

      const media = (result.data?.organization?.medias.nodes ??
        []) as MediaWithMetadata[];
      return filterMediaByType(media, type)
        .filter(isMediaReady)
        .map(buildMediaPickerResult);
    },
    [client],
  );

  // Public visitors have no library, so browsing in place hides entirely
  const value = useMemo(
    () => ({
      show,
      close: handleClose,
      list: isPublicAccess ? undefined : list,
    }),
    [show, handleClose, list, isPublicAccess],
  );

  return (
    <MediaPickerContext.Provider value={value}>
      {children}
      <MediaPickerModal
        isOpen={modalState.isOpen}
        onClose={handleClose}
        onSelect={handleSelect}
        options={modalState.options}
        isPublicAccess={isPublicAccess}
      />
    </MediaPickerContext.Provider>
  );
};
