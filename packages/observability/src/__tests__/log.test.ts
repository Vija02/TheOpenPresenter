import { AxiosError, AxiosHeaders } from "axios";
import pino from "pino";
import { describe, expect, it } from "vitest";

import { redact } from "../log";

const TOKEN = "ya29.secret-token";

const axiosError = () => {
  const config = {
    method: "get",
    url: "https://docs.google.com/presentation/d/abc/embed?rm=minimal",
    headers: new AxiosHeaders({ Authorization: `Bearer ${TOKEN}` }),
  };
  return new AxiosError(
    "Request failed with status code 404",
    "ERR_BAD_REQUEST",
    config as any,
    {},
    {
      status: 404,
      statusText: "Not Found",
      headers: {},
      config: config as any,
      data: "<html>",
    },
  );
};

/** The logger's options, writing to a string we can check */
const capture = () => {
  const lines: string[] = [];
  const logger = pino(
    {
      serializers: { ...pino.stdSerializers, error: pino.stdSerializers.err },
      redact,
    },
    { write: (line: string) => lines.push(line) },
  );
  return { logger, output: () => lines.join("\n") };
};

describe("redact", () => {
  it("keeps the token of a failed request out of the log", () => {
    const { logger, output } = capture();

    logger.error({ err: axiosError() }, "as err");
    logger.error({ error: axiosError() }, "as error");

    expect(output()).not.toContain(TOKEN);
    // Still says which request failed
    expect(output()).toContain("embed?rm=minimal");
    expect(output()).toContain("[Redacted]");
  });

  // The standard serializer keeps only a cause's message and stack today
  it("also from an error wrapping it", () => {
    const { logger, output } = capture();

    const wrapper = Object.assign(new Error("Import failed"), {
      cause: axiosError(),
    });
    logger.error({ err: wrapper }, "wrapped");

    expect(output()).not.toContain(TOKEN);
  });
});
