import type { FileNode } from "@/store/api/filesApi";

export interface TreeNode extends FileNode {
  depth: number;
  children: TreeNode[];
}

function compareNodes(a: FileNode, b: FileNode): number {
  if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
  return a.name.localeCompare(b.name);
}

export function buildFileTree(files: FileNode[]): TreeNode[] {
  const byParent = new Map<string | null, FileNode[]>();
  for (const file of files) {
    const key = file.parentId;
    const list = byParent.get(key) ?? [];
    list.push(file);
    byParent.set(key, list);
  }

  function build(parentId: string | null, depth: number): TreeNode[] {
    const children = (byParent.get(parentId) ?? []).slice().sort(compareNodes);
    return children.map((node) => ({
      ...node,
      depth,
      children: node.isDirectory ? build(node.id, depth + 1) : [],
    }));
  }

  return build(null, 0);
}

export function flattenVisibleTree(nodes: TreeNode[], expandedIds: Set<string>): TreeNode[] {
  const result: TreeNode[] = [];
  for (const node of nodes) {
    result.push(node);
    if (node.isDirectory && expandedIds.has(node.id)) {
      result.push(...flattenVisibleTree(node.children, expandedIds));
    }
  }
  return result;
}
