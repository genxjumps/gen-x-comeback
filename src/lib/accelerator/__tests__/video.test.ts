import { describe, expect, it } from "vitest";

import { acceleratorVideoSrc } from "../video";

describe("Accelerator Cloudflare player source", () => {
  it("uses the same Cloudflare iframe and poster pattern as the 7-Day Plan", () => {
    expect(acceleratorVideoSrc("767c2265f63d67fb5dc3b1c5f3a3e44e")).toBe(
      "https://customer-cvsfidz4ao4uk9i5.cloudflarestream.com/767c2265f63d67fb5dc3b1c5f3a3e44e/iframe?poster=https%3A%2F%2Fcustomer-cvsfidz4ao4uk9i5.cloudflarestream.com%2F767c2265f63d67fb5dc3b1c5f3a3e44e%2Fthumbnails%2Fthumbnail.jpg%3Ftime%3D%26height%3D600",
    );
  });

  it("returns null when no uploaded video is connected", () => {
    expect(acceleratorVideoSrc(null)).toBeNull();
  });
});
