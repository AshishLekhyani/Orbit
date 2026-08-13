import * as Y from "yjs";

export function seedYjsState(content: string): Uint8Array<ArrayBuffer> {
  const doc = new Y.Doc();
  doc.getText("content").insert(0, content);
  const raw = Y.encodeStateAsUpdate(doc);
  doc.destroy();
  return new Uint8Array(raw) as Uint8Array<ArrayBuffer>;
}
