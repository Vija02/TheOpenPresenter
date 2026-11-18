// @vitest-environment node
import { writeFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { execFile } = vi.hoisted(() => ({ execFile: vi.fn() }));
vi.mock("node:child_process", () => ({ execFile }));

const log = {
  info: vi.fn(),
  warn: vi.fn(),
} as any;

const realPlatform = process.platform;
const setPlatform = (value: string) =>
  Object.defineProperty(process, "platform", { value });

const loadConverter = async () => {
  vi.resetModules();
  return import("../office/local/convertPptToPdfLocally");
};

const fakePowerShell =
  (pdf: string | null) =>
  (
    _cmd: string,
    args: string[],
    _opts: unknown,
    cb: (...a: unknown[]) => void,
  ) => {
    if (pdf !== null) writeFileSync(args[args.indexOf("-Pdf") + 1]!, pdf);
    cb(null, "", "");
  };

beforeEach(() => {
  execFile.mockReset();
});
afterEach(() => setPlatform(realPlatform));

describe("isLocalPowerPointAvailable", () => {
  it("is false off Windows without running anything", async () => {
    setPlatform("linux");
    const { isLocalPowerPointAvailable } = await loadConverter();
    expect(await isLocalPowerPointAvailable()).toBe(false);
    expect(execFile).not.toHaveBeenCalled();
  });

  it("checks the registry on Windows, once", async () => {
    setPlatform("win32");
    execFile.mockImplementation((_c, _a, _o, cb) => cb(null));
    const { isLocalPowerPointAvailable } = await loadConverter();
    expect(await isLocalPowerPointAvailable()).toBe(true);
    expect(await isLocalPowerPointAvailable()).toBe(true);
    expect(execFile).toHaveBeenCalledTimes(1);
    expect(execFile.mock.calls[0]![1]).toEqual([
      "query",
      "HKCR\\PowerPoint.Application",
    ]);
  });

  it("is false on Windows when PowerPoint isn't registered", async () => {
    setPlatform("win32");
    execFile.mockImplementation((_c, _a, _o, cb) => cb(new Error("not found")));
    const { isLocalPowerPointAvailable } = await loadConverter();
    expect(await isLocalPowerPointAvailable()).toBe(false);
  });

  it("checks again after a no, so a slow first check isn't final", async () => {
    setPlatform("win32");
    execFile
      .mockImplementationOnce((_c, _a, _o, cb) => cb(new Error("timed out")))
      .mockImplementation((_c, _a, _o, cb) => cb(null));
    const { isLocalPowerPointAvailable } = await loadConverter();
    expect(await isLocalPowerPointAvailable()).toBe(false);
    expect(await isLocalPowerPointAvailable()).toBe(true);
  });
});

describe("convertPptToPdfLocally", () => {
  it("runs the script on the deck and returns the PDF", async () => {
    execFile.mockImplementation(fakePowerShell("%PDF-1.7 fake"));
    const { convertPptToPdfLocally } = await loadConverter();
    const pdf = await convertPptToPdfLocally(Buffer.from("pptx"), log);
    expect(pdf.toString()).toBe("%PDF-1.7 fake");

    const args: string[] = execFile.mock.calls[0]![1];
    expect(args.slice(0, 5)).toEqual([
      "-NoProfile",
      "-NonInteractive",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
    ]);
    expect(args[5]).toMatch(/convert\.ps1$/);
    expect(args[args.indexOf("-Deck") + 1]).toMatch(/deck\.pptx$/);
  });

  it("keeps a .ppt upload's extension so PowerPoint reads it right", async () => {
    execFile.mockImplementation(fakePowerShell("%PDF"));
    const { convertPptToPdfLocally } = await loadConverter();
    await convertPptToPdfLocally(Buffer.from("ppt"), log, { extension: "PPT" });
    await convertPptToPdfLocally(Buffer.from("x"), log, { extension: "exe" });
    const decks = execFile.mock.calls.map(
      (c) => c[1][c[1].indexOf("-Deck") + 1],
    );
    expect(decks[0]).toMatch(/deck\.ppt$/);
    expect(decks[1]).toMatch(/deck\.pptx$/);
  });

  it("fails when no PDF was written", async () => {
    execFile.mockImplementation(fakePowerShell(null));
    const { convertPptToPdfLocally } = await loadConverter();
    await expect(
      convertPptToPdfLocally(Buffer.from("pptx"), log),
    ).rejects.toThrow("didn't produce a PDF");
  });

  it("runs one conversion at a time, even after a failure", async () => {
    const pending: (() => void)[] = [];
    let calls = 0;
    execFile.mockImplementation((_c, args: string[], _o, cb) => {
      const fail = ++calls === 1;
      pending.push(() => {
        writeFileSync(args[args.indexOf("-Pdf") + 1]!, "%PDF");
        cb(fail ? new Error("x") : null, "", "boom");
      });
    });
    const { convertPptToPdfLocally } = await loadConverter();
    const first = convertPptToPdfLocally(Buffer.from("a"), log);
    const second = convertPptToPdfLocally(Buffer.from("b"), log);
    first.catch(() => {});

    await vi.waitFor(() => expect(pending).toHaveLength(1));
    await new Promise((r) => setTimeout(r, 20));
    expect(execFile).toHaveBeenCalledTimes(1);

    pending.shift()!();
    await expect(first).rejects.toThrow("boom");
    await vi.waitFor(() => expect(pending).toHaveLength(1));
    pending.shift()!();
    await expect(second).resolves.toBeInstanceOf(Buffer);
  });

  it("keeps the script ASCII for Windows PowerShell 5.1", async () => {
    const { CONVERT_SCRIPT } = await loadConverter();
    expect([...CONVERT_SCRIPT].every((c) => c.charCodeAt(0) < 128)).toBe(true);
    expect(CONVERT_SCRIPT).toContain("Open($Deck, -1, 0, 0)");
    expect(CONVERT_SCRIPT).toContain("SaveAs($Pdf, 32)");
  });
});

describe("toLocalPowerPointError", () => {
  it("explains a timeout", async () => {
    const { toLocalPowerPointError } = await loadConverter();
    const err = Object.assign(new Error("Command failed"), { killed: true });
    expect(toLocalPowerPointError(err, "").message).toMatch(/took too long/);
  });

  it("explains a password-protected deck", async () => {
    const { toLocalPowerPointError } = await loadConverter();
    expect(
      toLocalPowerPointError(new Error("x"), "The password is incorrect.")
        .message,
    ).toMatch(/password protected/);
  });

  it("explains a missing PowerShell", async () => {
    const { toLocalPowerPointError } = await loadConverter();
    const err = Object.assign(new Error("spawn"), { code: "ENOENT" });
    expect(toLocalPowerPointError(err, "").message).toMatch(/PowerShell/);
  });

  it("passes on PowerPoint's first line otherwise", async () => {
    const { toLocalPowerPointError } = await loadConverter();
    const err = toLocalPowerPointError(
      new Error("Command failed"),
      "Presentations.Open : PowerPoint can't read deck.pptx.\r\nAt line:1",
    );
    expect(err.message).toBe(
      "PowerPoint on this computer couldn't convert the file: Presentations.Open : PowerPoint can't read deck.pptx.",
    );
    expect(err.detail).toContain("At line:1");
  });
});

describe("convertPptWithFallback", () => {
  const setup = async ({
    available,
    online,
    officeOnline,
    local = async () => Buffer.from("%PDF local"),
  }: {
    available: boolean;
    online: boolean;
    officeOnline: () => Promise<{
      pdfBuffer: Buffer;
      slideshow: string | null;
    }>;
    local?: () => Promise<Buffer>;
  }) => {
    vi.resetModules();
    vi.doMock("../office/network", () => ({
      isOnline: vi.fn(async () => online),
    }));
    const convertPptToPdfLocally = vi.fn(local);
    vi.doMock("../office/local/convertPptToPdfLocally", () => ({
      isLocalPowerPointAvailable: vi.fn(async () => available),
      convertPptToPdfLocally,
    }));
    const { convertPptWithFallback } = await import(
      "../office/local/localPptToPdf"
    );
    const readPptx = vi.fn(async () => Buffer.from("pptx"));
    const viaOfficeOnline = vi.fn(officeOnline);
    const run = () =>
      convertPptWithFallback(
        {
          readPptx,
          extension: "pptx",
          viaOfficeOnline,
          localExtras: { slideshow: null },
        },
        log,
      );
    return { run, readPptx, viaOfficeOnline, convertPptToPdfLocally };
  };

  const officeOk = async () => ({
    pdfBuffer: Buffer.from("%PDF online"),
    slideshow: "deck",
  });
  const officeFails = async (): Promise<never> => {
    throw new Error("office broke");
  };

  afterEach(() => {
    vi.doUnmock("../office/network");
    vi.doUnmock("../office/local/convertPptToPdfLocally");
  });

  it("uses only Office Online without a local PowerPoint", async () => {
    const t = await setup({
      available: false,
      online: false,
      officeOnline: officeFails,
    });
    await expect(t.run()).rejects.toThrow("office broke");
    expect(t.readPptx).not.toHaveBeenCalled();
  });

  it("prefers Office Online when online, keeping its extras", async () => {
    const t = await setup({
      available: true,
      online: true,
      officeOnline: officeOk,
    });
    expect(await t.run()).toMatchObject({
      source: "online",
      slideshow: "deck",
    });
    expect(t.convertPptToPdfLocally).not.toHaveBeenCalled();
  });

  it("falls back to local when Office Online fails", async () => {
    const t = await setup({
      available: true,
      online: true,
      officeOnline: officeFails,
    });
    const result = await t.run();
    expect(result).toMatchObject({ source: "local", slideshow: null });
    expect(result.pdfBuffer.toString()).toBe("%PDF local");
    expect(log.warn).toHaveBeenCalled();
  });

  it("goes straight to local when offline", async () => {
    const t = await setup({
      available: true,
      online: false,
      officeOnline: officeOk,
    });
    expect((await t.run()).source).toBe("local");
    expect(t.viaOfficeOnline).not.toHaveBeenCalled();
  });

  it("surfaces the local error when local is the last resort", async () => {
    const t = await setup({
      available: true,
      online: false,
      officeOnline: officeOk,
      local: async () => {
        throw new Error("local broke");
      },
    });
    await expect(t.run()).rejects.toThrow("local broke");
  });
});

describe("offlineUnavailableMessage", () => {
  it("suggests installing PowerPoint only on Windows", async () => {
    const { offlineUnavailableMessage } = await import(
      "../office/local/localPptToPdf"
    );
    setPlatform("win32");
    expect(offlineUnavailableMessage()).toMatch(/PowerPoint installed/);
    setPlatform("linux");
    expect(offlineUnavailableMessage()).not.toMatch(/PowerPoint installed/);
  });
});
