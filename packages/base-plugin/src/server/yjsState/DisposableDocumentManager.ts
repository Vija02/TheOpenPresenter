import { IDisposable } from "@repo/lib";

export type DocumentsChangeListener = (documentNames: string[]) => void;

export class DisposableDocumentManager {
  private disposable: Record<string, IDisposable[]> = {};
  private changeListeners: Set<DocumentsChangeListener> = new Set();

  getDocumentDisposable(documentName: string) {
    if (!this.disposable[documentName]) {
      this.disposable[documentName] = [];
      this.notifyListeners();
    }

    return this.disposable[documentName]!;
  }

  disposeDocument(documentName: string) {
    this.disposable[documentName]?.forEach((x) => {
      x.dispose?.();
    });
    delete this.disposable[documentName];

    this.notifyListeners();
  }

  getActiveDocuments(): string[] {
    return Object.keys(this.disposable);
  }

  onDocumentsChange(listener: DocumentsChangeListener): () => void {
    this.changeListeners.add(listener);
    return () => {
      this.changeListeners.delete(listener);
    };
  }

  private notifyListeners() {
    const documentNames = this.getActiveDocuments();
    this.changeListeners.forEach((listener) => {
      listener(documentNames);
    });
  }
}
