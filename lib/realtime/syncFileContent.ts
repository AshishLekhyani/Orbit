import * as Y from "yjs";
import { prisma } from "@/lib/prisma";
import { broadcastToFileChannel } from "@/lib/realtime/broadcast";

export async function replaceFileContent(fileId: string, targetContent: string): Promise<boolean> {
  const file = await prisma.file.findUnique({ where: { id: fileId }, select: { content: true, yjsState: true } });
  if (!file || file.content === targetContent) return false;

  const doc = new Y.Doc();
  if (file.yjsState) {
    Y.applyUpdate(doc, new Uint8Array(file.yjsState));
  } else if (file.content) {
    doc.getText("content").insert(0, file.content);
  }

  const ytext = doc.getText("content");
  let delta: Uint8Array | null = null;
  const captureUpdate = (update: Uint8Array) => {
    delta = update;
  };
  doc.on("update", captureUpdate);
  doc.transact(() => {
    ytext.delete(0, ytext.length);
    ytext.insert(0, targetContent);
  });
  doc.off("update", captureUpdate);

  const finalContent = ytext.toString();
  const fullState = new Uint8Array(Y.encodeStateAsUpdate(doc)) as Uint8Array<ArrayBuffer>;
  doc.destroy();

  await prisma.file.update({
    where: { id: fileId },
    data: { content: finalContent, yjsState: fullState },
  });

  if (delta) {
    await broadcastToFileChannel(fileId, "yjs-update", { update: Buffer.from(delta).toString("base64") });
  }

  return true;
}
