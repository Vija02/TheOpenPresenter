import { logger } from "@repo/observability";
import isEqual from "fast-deep-equal";
import { useCallback, useRef, useSyncExternalStore } from "react";
import { typeidUnboxed } from "typeid-js";

export type Files = {
  name: string;
  size: number;
  lastModified: number;
}[];

export class OPFSStorageManager {
  isSupported: boolean;
  protected rootDirectory: FileSystemDirectoryHandle | undefined;
  protected pluginId: string;

  protected watcher: Record<string, () => void> = {};
  protected currentFiles: Files = [];

  protected logger;

  constructor(pluginId: string) {
    this.isSupported = this.checkIsSupported();
    this.pluginId = pluginId;

    this.logger = logger.child({ pluginId, class: "OPFSStorageManager" });

    this.callWatcher();
  }

  protected checkIsSupported() {
    return !!("storage" in navigator && "getDirectory" in navigator.storage);
  }

  async getDirectoryHandle() {
    if (this.isSupported && !this.rootDirectory) {
      this.rootDirectory = await (
        await navigator.storage.getDirectory()
      ).getDirectoryHandle(this.pluginId, { create: true });
    }
    return this.rootDirectory!;
  }

  async getFileHandle(fileName: string) {
    try {
      if (this.isSupported) {
        const dir = await this.getDirectoryHandle();
        return await dir.getFileHandle(fileName, {
          create: true,
        });
      }
    } catch (error) {
      logger.warn({ error }, "getFileHandle error");
      console.warn("getFileHandle error:", error);
      return undefined;
    }
  }

  async fileExists(fileName: string) {
    try {
      if (this.isSupported) {
        const dir = await this.getDirectoryHandle();
        await dir.getFileHandle(fileName, {
          create: false,
        });
        return true;
      }
      return false;
    } catch (error) {
      return false;
    }
  }

  async writeFile(
    fileHandleOrFileName: FileSystemFileHandle | string,
    {
      data,
      shouldAppend,
    }: {
      data: string | BufferSource | Blob | null | undefined;
      shouldAppend?: boolean;
    },
  ) {
    try {
      if (this.isSupported) {
        const dir = await this.getDirectoryHandle();
        const fileHandle =
          typeof fileHandleOrFileName === "string"
            ? await dir.getFileHandle(fileHandleOrFileName, {
                create: true,
              })
            : fileHandleOrFileName;
        const writable = await fileHandle.createWritable({
          keepExistingData: !shouldAppend,
        });

        let position = 0;
        if (shouldAppend) {
          position = await (await fileHandle.getFile()).size;
        }

        await writable.write({
          data,
          type: "write",
          position: position > 0 ? position : undefined,
        });
        await writable.close();

        this.callWatcher();

        return true;
      }
    } catch (error) {
      logger.warn({ error }, "writeFile error");
      console.warn("writeFile error:", error);
      return false;
    }
  }

  async readFile(fileHandleOrFileName: FileSystemFileHandle | string) {
    try {
      if (this.isSupported) {
        const dir = await this.getDirectoryHandle();
        const fileHandle =
          typeof fileHandleOrFileName === "string"
            ? await dir.getFileHandle(fileHandleOrFileName, {
                create: true,
              })
            : fileHandleOrFileName;
        const file = await fileHandle.getFile();
        return file;
      }
    } catch (error) {
      logger.warn({ error }, "readFile error");
      console.warn("readFile error:", error);
      return null;
    }
  }

  async listFiles(): Promise<Files> {
    try {
      if (this.isSupported) {
        const dir = await this.getDirectoryHandle();
        const files = [];
        for await (const [name, handle] of dir.entries()) {
          if (handle.kind === "file") {
            const file = await (handle as FileSystemFileHandle).getFile();
            files.push({
              name,
              size: file.size,
              lastModified: file.lastModified,
            });
          }
        }
        return files;
      }
      return [];
    } catch (error) {
      logger.warn({ error }, "listFiles error");
      console.warn("listFiles error:", error);
      return [];
    }
  }

  async removeFile(fileName: string) {
    try {
      if (this.isSupported) {
        const dir = await this.getDirectoryHandle();
        await dir.removeEntry(fileName);

        this.callWatcher();
      }
    } catch (error) {
      logger.warn({ error }, "removeFile error");
      console.warn("removeFile error:", error);
      return [];
    }
  }

  protected async callWatcher() {
    this.currentFiles = await this.listFiles();

    Object.values(this.watcher).forEach((x) => x());
  }

  useListFiles(): Files {
    const prevDataRef = useRef<any | null>(null);

    const subscribe = useCallback((callback: any) => {
      const id = typeidUnboxed();

      this.watcher[id] = callback;

      return () => {
        delete this.watcher[id];
      };
    }, []);

    const returnFunc = useCallback(() => {
      if (isEqual(prevDataRef.current, this.currentFiles)) {
        return prevDataRef.current;
      } else {
        prevDataRef.current = this.currentFiles;
        return prevDataRef.current;
      }
    }, []);

    return useSyncExternalStore(subscribe, returnFunc);
  }
}
