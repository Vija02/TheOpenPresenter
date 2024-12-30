import { IDisposable } from "@repo/lib";

export class DisposableDocumentManager {
  private disposable: Record<string, IDisposable[]> = {};

  getDocumentDisposable(documentName: string) {
    if (!this.disposable[documentName]) {
      this.disposable[documentName] = [];
    }

    return this.disposable[documentName]!;
  }

  disposeDocument(documentName: string) {
    this.disposable[documentName]?.forEach((x) => {
      x.dispose?.();
    });
    delete this.disposable[documentName];
  }
}
