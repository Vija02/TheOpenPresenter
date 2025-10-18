import { AwarenessStore } from "@repo/base-plugin/client";
import { Button, PopConfirm } from "@repo/ui";
import { useCallback, useMemo } from "react";
import { VscTrash } from "react-icons/vsc";

import { Recording } from "../../../src";
import { usePluginAPI } from "../../pluginApi";

export const NotUploaded = ({ recording }: { recording: Recording }) => {
  const pluginApi = usePluginAPI();
  const mutableSceneData = pluginApi.scene.useValtioData();

  const handleRemove = useCallback(async () => {
    await pluginApi.media.permanentlyDeleteMedia(recording.mediaId + ".mp3");

    const index = mutableSceneData.pluginData.recordings.findIndex(
      (x) => x.mediaId === recording.mediaId,
    );
    mutableSceneData.pluginData.recordings.splice(index, 1);
  }, [
    mutableSceneData.pluginData.recordings,
    pluginApi.media,
    recording.mediaId,
  ]);

  if (recording.streamUploadFailed) {
    return (
      <StreamUploadFailed recording={recording} handleRemove={handleRemove} />
    );
  }

  return <StreamUploading handleRemove={handleRemove} />;
};

const StreamUploadFailed = ({
  recording,
  handleRemove,
}: {
  recording: Recording;
  handleRemove: () => void;
}) => {
  const pluginApi = usePluginAPI();

  const mutableSceneData = pluginApi.scene.useValtioData();

  // Check awareness for whoever holds the data for this recording
  const awareness = pluginApi.awareness.useAwarenessData();
  const availableMedias = useMemo(
    () =>
      awareness
        .map((x: AwarenessStore<Record<string, any>>) => ({
          awarenessUserId: x.user.id,
          media: x?.[pluginApi.pluginContext.pluginId]?.availableMedias ?? [],
        }))
        .filter((x) => !!x),
    [awareness, pluginApi.pluginContext.pluginId],
  );

  const flattened = useMemo(
    () =>
      availableMedias
        .map((media) =>
          media.media.map((x: any) => ({
            ...x,
            awarenessUserId: media.awarenessUserId,
          })),
        )
        .flat(),
    [availableMedias],
  );
  const foundIndex = useMemo(
    () => flattened.findIndex((x) => x.name === `${recording.mediaId}.mp3`),
    [flattened, recording.mediaId],
  );

  const onUpload = useCallback(() => {
    const index = mutableSceneData.pluginData.recordings.findIndex(
      (x) => x.mediaId === recording.mediaId,
    );
    mutableSceneData.pluginData.recordings[index]!.awarenessUserToRetry =
      flattened[foundIndex].awarenessUserId;
  }, [
    flattened,
    foundIndex,
    mutableSceneData.pluginData.recordings,
    recording.mediaId,
  ]);

  const onComplete = useCallback(async () => {
    await pluginApi.media.completeMedia(`${recording.mediaId}.mp3`);

    const index = mutableSceneData.pluginData.recordings.findIndex(
      (x) => x.mediaId === recording.mediaId,
    );
    mutableSceneData.pluginData.recordings[index]!.isUploaded = true;
  }, [
    mutableSceneData.pluginData.recordings,
    pluginApi.media,
    recording.mediaId,
  ]);

  return (
    <div className="stack-row border border-stroke-emphasis p-2 justify-between">
      <div className="flex flex-col">
        <span className="font-bold">
          Your recording has not been successfully uploaded
        </span>
        {foundIndex > -1 && (
          <Button
            onClick={onUpload}
            className="mt-2"
            size="sm"
            variant="success"
            isLoading={!!recording.awarenessUserToRetry}
          >
            Re-Upload
          </Button>
        )}
        {foundIndex === -1 && (
          <div>
            <span>
              To reupload, open the device that the audio was recorded in
            </span>
          </div>
        )}
        <Button
          onClick={onComplete}
          className="mt-2"
          size="sm"
          variant="success"
        >
          Complete
        </Button>
      </div>
      <PopConfirm
        title={`Are you sure you want to remove this recording?`}
        onConfirm={handleRemove}
        okText="Yes"
        cancelText="No"
        key="remove"
      >
        <Button size="sm" variant="ghost">
          <VscTrash />
        </Button>
      </PopConfirm>
    </div>
  );
};

const StreamUploading = ({ handleRemove }: { handleRemove: () => void }) => {
  return (
    <div className="stack-row border border-stroke-emphasis p-2 justify-between">
      <div className="flex flex-col">
        <span className="font-bold">Your recording is being uploaded</span>
        <span>This should be done shortly</span>
      </div>
      <PopConfirm
        title={`Are you sure you want to remove this recording?`}
        onConfirm={handleRemove}
        okText="Yes"
        cancelText="No"
        key="remove"
      >
        <Button size="sm" variant="ghost">
          <VscTrash />
        </Button>
      </PopConfirm>
    </div>
  );
};
