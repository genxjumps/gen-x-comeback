import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/preview/w01")({
  head: () => ({
    meta: [
      { title: "W01 - Full Body Flush & Fire | Gen X Jumps" },
      {
        name: "description",
        content:
          "Temporary video playback test for W01 - Full Body Flush & Fire. Workout details and progress controls are not included yet.",
      },
      {
        property: "og:title",
        content: "W01 - Full Body Flush & Fire | Gen X Jumps",
      },
      {
        property: "og:description",
        content:
          "Temporary video playback test for W01 - Full Body Flush & Fire. Workout details and progress controls are not included yet.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: W01Preview,
});

const IFRAME_SRC =
  "https://customer-cvsfidz4ao4uk9i5.cloudflarestream.com/40ae220635bc55bc66d1f68cb11ab997/iframe?poster=https%3A%2F%2Fcustomer-cvsfidz4ao4uk9i5.cloudflarestream.com%2F40ae220635bc55bc66d1f68cb11ab997%2Fthumbnails%2Fthumbnail.jpg%3Ftime%3D%26height%3D600";

function W01Preview() {
  return (
    <div className="mx-auto w-full max-w-2xl px-5 py-10 sm:py-14">
      <span className="inline-block rounded-full border border-border px-2.5 py-0.5 text-[10px] uppercase tracking-widest text-muted-foreground">
        Preview
      </span>

      <h1 className="mt-4 text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">
        W01 - Full Body Flush & Fire
      </h1>

      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        Video playback test only. Workout details and progress controls come later.
      </p>

      <div className="mt-6">
        <div className="aspect-video overflow-hidden rounded-lg border border-border bg-muted">
          <iframe
            src={IFRAME_SRC}
            loading="lazy"
            allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
            className="h-full w-full border-0"
            title="W01 - Full Body Flush & Fire"
          />
        </div>
      </div>

      <div className="mt-8">
        <Button asChild variant="outline" size="lg" className="w-full sm:w-auto">
          <Link to="/">Back to home</Link>
        </Button>
      </div>
    </div>
  );
}
