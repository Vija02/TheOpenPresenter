import { z } from "zod";

import { songSettingValidator } from "../../../src/types";

export const songFormValidator = z.object({
  ...songSettingValidator.shape,
  title: z.string(),
  content: z.string(),
});

export type SongFormData = z.infer<typeof songFormValidator>;
