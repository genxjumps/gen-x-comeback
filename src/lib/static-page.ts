const STATIC_PAGE_CSS = `
  :root { color-scheme: light; background: #faf8f3; }
  * { box-sizing: border-box; }
  body {
    min-height: 100vh;
    margin: 0;
    background: #faf8f3;
    color: #222222;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
    line-height: 1.6;
    -webkit-font-smoothing: antialiased;
  }
  .gxj-header { border-bottom: 1px solid #e3e1dc; }
  .gxj-header-inner { max-width: 42rem; margin: 0 auto; padding: 1rem 1.25rem; }
  .gxj-brand {
    display: inline-block;
    border: 1px solid #222222;
    border-radius: 2px;
    padding: 0.4rem 0.625rem 0.35rem;
    font-size: 0.6875rem;
    font-weight: 700;
    line-height: 1;
    letter-spacing: 0.16em;
    text-transform: uppercase;
  }
  .gxj-page { max-width: 42rem; margin: 0 auto; padding: 2.5rem 1.25rem 3.5rem; }
  .gxj-title {
    max-width: 34rem;
    margin: 0;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
    font-size: 1.5rem;
    font-weight: 600;
    line-height: 1.15;
    letter-spacing: -0.01em;
    text-wrap: balance;
  }
  .gxj-copy {
    max-width: 36rem;
    margin: 0.75rem 0 0;
    color: #666666;
    font-size: 0.875rem;
    line-height: 1.65;
  }
  .gxj-form { max-width: 32rem; margin-top: 1.5rem; }
  .gxj-label {
    display: block;
    margin: 0 0 0.375rem;
    font-size: 0.875rem;
    font-weight: 600;
  }
  .gxj-input {
    display: block;
    width: 100%;
    height: 2.5rem;
    margin: 0 0 1rem;
    border: 1px solid #d4d4d4;
    border-radius: 2px;
    background: #ffffff;
    color: #222222;
    padding: 0 0.75rem;
    font: inherit;
  }
  .gxj-input:focus {
    border-color: #05465c;
    outline: 1px solid #05465c;
    outline-offset: 1px;
  }
  .gxj-actions { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 1.5rem; }
  .gxj-button {
    display: inline-flex;
    min-height: 2.5rem;
    align-items: center;
    justify-content: center;
    border: 1px solid #222222;
    border-radius: 2px;
    background: #222222;
    color: #ffffff;
    padding: 0.625rem 1rem;
    font: 600 0.875rem/1.25 -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
    text-align: center;
    text-decoration: none;
    cursor: pointer;
  }
  .gxj-button:hover { background: #3a3a3a; }
  .gxj-button-secondary { background: transparent; color: #222222; }
  .gxj-button-secondary:hover { background: #222222; color: #ffffff; }
  .gxj-note {
    max-width: 32rem;
    margin: 0.75rem 0 0;
    color: #666666;
    font-size: 0.8125rem;
    line-height: 1.55;
  }
  @media (max-width: 39.9375rem) {
    .gxj-form .gxj-button,
    .gxj-actions .gxj-button { width: 100%; }
  }
  @media (min-width: 40rem) {
    .gxj-page { padding-top: 3.5rem; }
    .gxj-title { font-size: 1.875rem; }
  }
`;

/** Shared visual shell for standalone utility and fallback pages. */
export function renderStaticPage(title: string, body: string): string {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex, nofollow" />
<title>${title}</title><style>${STATIC_PAGE_CSS}</style></head>
<body><header class="gxj-header"><div class="gxj-header-inner"><span class="gxj-brand">Gen X Jumps</span></div></header><main class="gxj-page">${body}</main></body></html>`;
}
