import { describe, it, expect } from "vitest";
import { parseComponentRef, formatComponentRef, type ComponentRef } from "./component-ref";

describe("parseComponentRef", () => {
  it("parses plain name without version", () => {
    expect(parseComponentRef("code-review")).toEqual({ name: "code-review" });
    expect(parseComponentRef("my-skill")).toEqual({ name: "my-skill" });
  });

  it("parses name with semver range", () => {
    expect(parseComponentRef("code-review:^1.0.0")).toEqual({
      name: "code-review",
      versionRange: "^1.0.0",
    });
    expect(parseComponentRef("skill:~2.3.4")).toEqual({
      name: "skill",
      versionRange: "~2.3.4",
    });
    expect(parseComponentRef("prompt:1.0.0")).toEqual({
      name: "prompt",
      versionRange: "1.0.0",
    });
    expect(parseComponentRef("x:>=2.0.0")).toEqual({
      name: "x",
      versionRange: ">=2.0.0",
    });
    expect(parseComponentRef("y:*")).toEqual({
      name: "y",
      versionRange: "*",
    });
  });

  it("does not split on colon when after-colon looks like path", () => {
    expect(parseComponentRef("C:\\path\\to\\file")).toEqual({ name: "C:\\path\\to\\file" });
    expect(parseComponentRef("pkg@name:1.0.0")).toEqual({
      name: "pkg@name",
      versionRange: "1.0.0",
    });
  });

  it("does not split when after-colon does not look like semver", () => {
    expect(parseComponentRef("some:label")).toEqual({ name: "some:label" });
    expect(parseComponentRef("foo:bar")).toEqual({ name: "foo:bar" });
  });

  it("uses last colon for split (handles names with colons)", () => {
    expect(parseComponentRef("ns:name:^1.0.0")).toEqual({
      name: "ns:name",
      versionRange: "^1.0.0",
    });
  });
});

describe("formatComponentRef", () => {
  it("formats ref without version", () => {
    expect(formatComponentRef({ name: "code-review" })).toBe("code-review");
  });

  it("formats ref with version range", () => {
    expect(formatComponentRef({ name: "code-review", versionRange: "^1.0.0" })).toBe("code-review:^1.0.0");
  });
});

describe("formatComponentRef roundtrip", () => {
  it("roundtrips plain name", () => {
    const ref: ComponentRef = { name: "my-skill" };
    expect(parseComponentRef(formatComponentRef(ref))).toEqual(ref);
  });

  it("roundtrips name with version", () => {
    const ref: ComponentRef = { name: "code-review", versionRange: "^1.0.0" };
    expect(parseComponentRef(formatComponentRef(ref))).toEqual(ref);
  });
});
