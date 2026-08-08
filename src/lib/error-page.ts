import { renderStaticPage } from "./static-page";

export function renderErrorPage(): string {
  return renderStaticPage(
    "This page didn't load | Gen X Jumps",
    `<h1 class="gxj-title">This page didn't load</h1>
<p class="gxj-copy">Something went wrong on our end. You can try refreshing or head back home.</p>
<div class="gxj-actions">
  <button class="gxj-button" onclick="location.reload()">Try again</button>
  <a class="gxj-button gxj-button-secondary" href="/">Go home</a>
</div>`,
  );
}
