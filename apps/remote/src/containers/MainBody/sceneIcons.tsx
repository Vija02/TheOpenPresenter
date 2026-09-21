import { SceneIcon } from "@repo/base-plugin";
import { IconType } from "react-icons/lib";
import {
  PiBookOpenText,
  PiBrowser,
  PiChatsCircle,
  PiFilmSlate,
  PiImage,
  PiMicrophoneStage,
  PiMusicNotesSimple,
  PiPresentationChart,
  PiPuzzlePiece,
  PiRadio,
  PiScreencast,
  PiTimer,
  PiWaveform,
} from "react-icons/pi";

const sceneIconComponents: Record<SceneIcon, IconType> = {
  bible: PiBookOpenText,
  browser: PiBrowser,
  image: PiImage,
  microphone: PiMicrophoneStage,
  musicNotes: PiMusicNotesSimple,
  pads: PiWaveform,
  poll: PiChatsCircle,
  presentation: PiPresentationChart,
  radio: PiRadio,
  screenShare: PiScreencast,
  timer: PiTimer,
  video: PiFilmSlate,
};

export const getSceneIcon = (icon?: string | null): IconType =>
  sceneIconComponents[icon as SceneIcon] ?? PiPuzzlePiece;
