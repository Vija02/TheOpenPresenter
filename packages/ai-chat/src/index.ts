import "./index.css";

export { AiChatPanel } from "./ui/AiChatPanel";
export type { AiChatProps } from "./ui/AiChatPanel";
export { Markdown } from "./ui/Markdown";
export type { MarkdownProps } from "./ui/Markdown";
export { AttachMenu } from "./ui/AttachMenu";

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
export type { AiMessage, AiMessagePart, AiTurn } from "./store/transcript";

export {
  MAX_FILE_BYTES,
  fileToReferenceImage,
  urlToReferenceImage,
} from "./image/referenceImage";
