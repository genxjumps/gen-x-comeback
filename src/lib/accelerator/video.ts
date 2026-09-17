const CLOUDFLARE_STREAM_CUSTOMER_CODE = "cvsfidz4ao4uk9i5";

/**
 * Builds the same Cloudflare Stream iframe source used by the existing 7-Day Plan.
 * The poster is Cloudflare's own thumbnail for the same uploaded video.
 */
export function acceleratorVideoSrc(cloudflareStreamUid: string | null | undefined): string | null {
  if (!cloudflareStreamUid) return null;

  const videoBase = `https://customer-${CLOUDFLARE_STREAM_CUSTOMER_CODE}.cloudflarestream.com/${cloudflareStreamUid}`;
  const poster = encodeURIComponent(`${videoBase}/thumbnails/thumbnail.jpg?time=&height=600`);

  return `${videoBase}/iframe?poster=${poster}`;
}
