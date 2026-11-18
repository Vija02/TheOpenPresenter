import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { pino } from "pino";

const DEFAULT_TIMEOUT_MS = 2 * 60 * 1000;

// Kept ASCII-only: Windows PowerShell 5.1 reads a .ps1 without a BOM as ANSI.
// Opens with ReadOnly=-1, Untitled=0, WithWindow=0; 32 = ppSaveAsPDF.
export const CONVERT_SCRIPT = String.raw`param(
  [Parameter(Mandatory=$true)][string]$Deck,
  [Parameter(Mandatory=$true)][string]$Pdf
)
$ErrorActionPreference = 'Stop'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
$wasRunning = [bool](Get-Process -Name POWERPNT -ErrorAction SilentlyContinue)
$app = $null
$pres = $null
$code = 0
try {
  $app = New-Object -ComObject PowerPoint.Application
  $pres = $app.Presentations.Open($Deck, -1, 0, 0)
  $pres.SaveAs($Pdf, 32)
} catch {
  [Console]::Error.WriteLine($_.Exception.Message)
  $code = 1
} finally {
  if ($pres) { try { $pres.Close() } catch {} }
  if ($app -and -not $wasRunning) {
    try { if ($app.Presentations.Count -eq 0) { $app.Quit() } } catch {}
  }
  if ($pres) { [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($pres) }
  if ($app) { [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($app) }
}
exit $code
`;

const systemExe = (...parts: string[]) =>
  process.env.SystemRoot
    ? path.win32.join(process.env.SystemRoot, "System32", ...parts)
    : parts[parts.length - 1]!;

let available = false;

// Only a yes is cached
export const isLocalPowerPointAvailable = async (): Promise<boolean> => {
  if (process.platform !== "win32") return false;
  available ||= await new Promise<boolean>((resolve) => {
    execFile(
      systemExe("reg.exe"),
      ["query", "HKCR\\PowerPoint.Application"],
      { windowsHide: true, timeout: 10_000 },
      (err) => resolve(!err),
    );
  });
  return available;
};

export class LocalPowerPointError extends Error {
  constructor(
    message: string,
    readonly detail?: string,
  ) {
    super(message);
    this.name = "LocalPowerPointError";
  }
}

export const toLocalPowerPointError = (
  err: (Error & { killed?: boolean; code?: unknown }) | null,
  stderr: string,
): LocalPowerPointError => {
  const detail = stderr.trim() || err?.message || "Unknown error";
  if (err?.killed) {
    return new LocalPowerPointError(
      "PowerPoint took too long to convert this file. If PowerPoint is showing a message, close it and try again.",
      detail,
    );
  }
  if (err && "code" in err && err.code === "ENOENT") {
    return new LocalPowerPointError(
      "Couldn't start PowerShell to convert this file with PowerPoint.",
      detail,
    );
  }
  if (/password/i.test(detail)) {
    return new LocalPowerPointError(
      "This PowerPoint file is password protected. Remove the password and try again.",
      detail,
    );
  }
  const firstLine = detail.split(/\r?\n/)[0]!.trim();
  return new LocalPowerPointError(
    `PowerPoint on this computer couldn't convert the file: ${firstLine}`,
    detail,
  );
};

// PowerPoint picks the format by extension, so keep the upload's
export const DECK_EXTENSIONS = ["ppt", "pptx", "pps", "ppsx", "pptm", "ppsm"];

const runConversion = async (
  pptx: Buffer,
  log: pino.Logger,
  timeoutMs: number,
  extension: string,
): Promise<Buffer> => {
  const ext = extension.toLowerCase();
  const dir = await mkdtemp(path.join(tmpdir(), "top-ppt-"));
  try {
    const deckPath = path.join(
      dir,
      `deck.${DECK_EXTENSIONS.includes(ext) ? ext : "pptx"}`,
    );
    const pdfPath = path.join(dir, "deck.pdf");
    const scriptPath = path.join(dir, "convert.ps1");
    await writeFile(deckPath, pptx);
    await writeFile(scriptPath, CONVERT_SCRIPT, "ascii");

    const started = Date.now();
    await new Promise<void>((resolve, reject) => {
      execFile(
        systemExe("WindowsPowerShell", "v1.0", "powershell.exe"),
        [
          "-NoProfile",
          "-NonInteractive",
          "-ExecutionPolicy",
          "Bypass",
          "-File",
          scriptPath,
          "-Deck",
          deckPath,
          "-Pdf",
          pdfPath,
        ],
        {
          windowsHide: true,
          timeout: timeoutMs,
          encoding: "utf8",
          maxBuffer: 1024 * 1024,
        },
        (err, _stdout, stderr) => {
          if (err) reject(toLocalPowerPointError(err, String(stderr ?? "")));
          else resolve();
        },
      );
    });

    const pdf = await readFile(pdfPath).catch(() => null);
    if (!pdf || pdf.subarray(0, 4).toString("latin1") !== "%PDF") {
      throw new LocalPowerPointError(
        "PowerPoint on this computer didn't produce a PDF.",
      );
    }
    log.info(
      { bytes: pdf.length, durationMs: Date.now() - started },
      "Local PowerPoint: PDF made",
    );
    return pdf;
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
};

// PowerPoint is a single instance, so conversions run one at a time
let queue: Promise<unknown> = Promise.resolve();

export const convertPptToPdfLocally = (
  pptx: Buffer,
  log: pino.Logger,
  {
    timeoutMs = DEFAULT_TIMEOUT_MS,
    extension = "pptx",
  }: { timeoutMs?: number; extension?: string } = {},
): Promise<Buffer> => {
  const run = queue.then(() => runConversion(pptx, log, timeoutMs, extension));
  queue = run.catch(() => {});
  return run;
};
