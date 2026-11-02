import type { PluginSample } from "@repo/base-types";

import type { PluginBaseData, PluginRendererData } from "./types";

const PASSAGE_ID = "sample-passage";

const verse = (verse: number, text: string) => ({
  bookId: "JHN",
  bookName: "John",
  chapter: 3,
  verse,
  text,
});

const pluginData: PluginBaseData = {
  passages: [
    {
      id: PASSAGE_ID,
      reference: "John 3:16-17",
      translationId: "web",
      translationName: "World English Bible",
      translationAbbreviation: "WEB",
      verses: [
        verse(
          16,
          "For God so loved the world, that he gave his one and only Son, that whoever believes in him should not perish, but have eternal life.",
        ),
        verse(
          17,
          "For God didn't send his Son into the world to judge the world, but that the world should be saved through him.",
        ),
      ],
    },
  ],
  showVerseNumbers: true,
};

const rendererData: PluginRendererData = {
  passageId: PASSAGE_ID,
  slideIndex: 0,
  lastClickTimestamp: null,
};

/** A well-known passage, on its first verse */
export const sample: PluginSample = { pluginData, rendererData };
