export class OPFSStorageManager {
  isSupported: boolean;
  protected rootDirectory: FileSystemDirectoryHandle | undefined;
  protected pluginId: string;

  constructor(pluginId: string) {
    this.isSupported = this.checkIsSupported();
    this.pluginId = pluginId;
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
      console.warn("getFileHandle error:", error);
      return undefined;
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

        return true;
      }
    } catch (error) {
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
        return await file.text();
      }
    } catch (error) {
      console.warn("readFile error:", error);
      return null;
    }
  }

  async listFiles() {
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
    } catch (error) {
      console.warn("listFiles error:", error);
      return [];
    }
  }

  async removeFile(fileName: string) {
    try {
      if (this.isSupported) {
        const dir = await this.getDirectoryHandle();
        await dir.removeEntry(fileName);
      }
    } catch (error) {
      console.warn("removeFile error:", error);
      return [];
    }
  }
}
