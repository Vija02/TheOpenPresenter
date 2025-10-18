import { Button, DateDisplay, PopConfirm } from "@repo/ui";
import WavesurferPlayer from "@wavesurfer/react";
import { useCallback, useMemo, useState } from "react";
import { FaPause, FaPlay } from "react-icons/fa6";
import { VscTrash } from "react-icons/vsc";
import WaveSurfer from "wavesurfer.js";
import Hover from "wavesurfer.js/dist/plugins/hover.esm.js";

import { Recording } from "../../../src";
import { usePluginAPI } from "../../pluginApi";
import { NotUploaded } from "./NotUploaded";

export const RecordingCard = ({ recording }: { recording: Recording }) => {
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

  const [wavesurfer, setWavesurfer] = useState<WaveSurfer | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const onReady = useCallback((ws: WaveSurfer) => {
    setWavesurfer(ws);
    setIsPlaying(false);
  }, []);

  const onPlayPause = useCallback(() => {
    wavesurfer && wavesurfer.playPause();
  }, [wavesurfer]);

  const plugins = useMemo(
    () => [
      Hover.create({
        lineColor: "#ED672C",
        lineWidth: 2,
        labelBackground: "#555",
        labelColor: "#fff",
        labelSize: "11px",
      }),
    ],
    [],
  );

  if (!recording.isUploaded) {
    return <NotUploaded recording={recording} />;
  }

  return (
    <div className="stack-col py-2 items-stretch">
      <div className="stack-row justify-between items-stretch">
        <div className="stack-row">
          <Button
            size="sm"
            onClick={onPlayPause}
            variant={isPlaying ? "default" : "outline"}
            className={isPlaying ? "border-1 border-fill-default" : ""}
          >
            {!isPlaying ? <FaPlay /> : <FaPause />}
          </Button>
          <span>
            Recording <DateDisplay date={new Date(recording.startedAt!)} />
          </span>
        </div>
        <PopConfirm
          title={`Are you sure you want to remove this recording?`}
          onConfirm={handleRemove}
          okText="Yes"
          cancelText="No"
          key="remove"
        >
          <Button size="sm" variant="ghost" className="rounded-none">
            <VscTrash />
          </Button>
        </PopConfirm>
      </div>
      <div className="w-full">
        <WavesurferPlayer
          height={70}
          waveColor="#656666"
          progressColor="#ED672C"
          barWidth={2}
          url={pluginApi.media.resolveMediaUrl({
            mediaId: recording.mediaId ?? "",
            extension: "mp3",
          })}
          onReady={onReady}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          plugins={plugins}
        />
      </div>
    </div>
  );
};
