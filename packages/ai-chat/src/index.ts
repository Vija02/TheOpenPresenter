import "./index.css";

export { AiChatPanel } from "./ui/AiChatPanel";
export type { AiChatProps } from "./ui/AiChatPanel";
export { Markdown } from "./ui/Markdown";
export type { MarkdownProps } from "./ui/Markdown";
export { AttachMenu } from "./ui/AttachMenu";

export { AiUnavailable } from "./ui/AiUnavailable";
export { AiUnavailableDialog } from "./ui/AiUnavailableDialog";
export { AiUpgradeIcon } from "./ui/AiUpgradeIcon";

export { describeAiStatus, openAiStatusAction, useAiStatus } from "./status";
export type { AiStatus, AiStatusView } from "./status";

export { createAiCapabilityRequest } from "./request";
export type { AiCapabilityRequestOptions } from "./request";

export { useAiChat } from "./useAiChat";
export type {
  AiChat,
  AiChatPluginApi,
  AiChatRequest,
  AiChatStep,
} from "./useAiChat";

export { toPromptHistory, useTranscriptStore } from "./store/transcript";
export type { AiMessage, AiMessagePart } from "./store/transcript";

export {
  MAX_FILE_BYTES,
  fileToReferenceImage,
  urlToReferenceImage,
} from "./image/referenceImage";
