import { describe, expect, it } from "vitest";
import { isValidFileName, MAX_FILE_NAME_LENGTH } from "./fileMeta";

describe("isValidFileName", () => {
  it("accepts ordinary file and folder names", () => {
    expect(isValidFileName("index.html")).toBe(true);
    expect(isValidFileName("my-styles.css")).toBe(true);
    expect(isValidFileName("components")).toBe(true);
  });

  it("rejects empty names", () => {
    expect(isValidFileName("")).toBe(false);
  });

  it("rejects names containing a path separator", () => {
    expect(isValidFileName("a/b.js")).toBe(false);
  });

  it("rejects dot and dot-dot", () => {
    expect(isValidFileName(".")).toBe(false);
    expect(isValidFileName("..")).toBe(false);
  });

  it("rejects names longer than the limit but accepts the limit itself", () => {
    expect(isValidFileName("a".repeat(MAX_FILE_NAME_LENGTH))).toBe(true);
    expect(isValidFileName("a".repeat(MAX_FILE_NAME_LENGTH + 1))).toBe(false);
  });

  it("still allows dotfiles", () => {
    expect(isValidFileName(".gitignore")).toBe(true);
  });
});
