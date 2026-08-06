import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/jump-ropes")({
  head: () => ({
    meta: [
      { title: "Jump Rope Gear I Recommend — Gen X Jumps" },
      {
        name: "description",
        content:
          "The Crossrope ropes and mats I recommend first for Gen X adults, plus a 15% discount code and a simple what to buy first guide.",
      },
      { property: "og:title", content: "Jump Rope Gear I Recommend — Gen X Jumps" },
      {
        property: "og:description",
        content:
          "Practical Crossrope rope and mat picks for Gen X adults, with a simple what to buy first recommendation.",
      },
    ],
  }),
  component: JumpRopes,
});

const SHOP_URL = "https://crossrope.com/genx";

const picks = [
  {
    title: "Starter Jump Rope Set",
    label: "Best way to get into Crossrope",
    body: "A straightforward entry point if you want a Crossrope setup without jumping into a larger bundle.",
    cta: "See the Starter Set",
  },
  {
    title: "Get Lean Bundle",
    label: "Best overall setup",
    body: "My pick if you want a more complete Crossrope setup with useful rope-weight options as your conditioning improves.",
    cta: "See the Get Lean Bundle",
  },
  {
    title: "Ropeless",
    label: "Best for small spaces or travel",
    body: "Useful when ceiling height, room, weather, or travel makes a full rope inconvenient.",
    cta: "See Ropeless Options",
  },
  {
    title: "Larger Oval Mat",
    label: "Best mat for a dedicated setup",
    body: "The better choice when you have a regular jumping area and want more room to stay on the mat.",
    cta: "See Crossrope Mats",
  },
  {
    title: "Smaller Mat",
    label: "Best mat for portability",
    body: "Easier to move, store, or take with you when portability matters more than maximum floor coverage.",
    cta: "See Crossrope Mats",
  },
];

function JumpRopes() {
  return (
    <div className="mx-auto w-full max-w-2xl px-5 py-8 sm:py-12">
      <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
        Gen X Jumps Gear Guide
      </p>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight">The Jump Rope Gear I Recommend</h1>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        You do not need fancy gear to start jumping rope. But if you want the ropes and mats I
        recommend, these are the Crossrope options I would look at first.
      </p>
      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
        Gen X Jumps is a Crossrope affiliate. I may earn a commission if you buy through these links
        at no additional cost to you.
      </p>

      <div className="mt-5 rounded-md border border-border px-3 py-2.5 text-sm font-medium">
        Save 15% with code GENXJUMPS15
      </div>

      <h2 className="mt-8 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
        Quick Picks
      </h2>

      <div className="mt-3 space-y-3">
        {picks.map((p) => (
          <Card key={p.title} className="border-border">
            <CardContent className="p-4 sm:p-5">
              <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                {p.label}
              </p>
              <h3 className="mt-1.5 text-base font-semibold tracking-tight">{p.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{p.body}</p>
              <Button asChild className="mt-4 w-full">
                <a href={SHOP_URL} target="_blank" rel="noopener noreferrer sponsored">
                  {p.cta}
                </a>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <h2 className="mt-8 text-lg font-semibold tracking-tight">What I&rsquo;d Buy First</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        You do not need to buy everything. Start with the rope setup that fits how and where you
        train. A mat is useful if you jump regularly on hard or rough surfaces, but the rope itself
        is the priority.
      </p>

      <div className="mt-5 rounded-md border border-border px-3 py-2.5 text-sm font-medium">
        Crossrope discount code: GENXJUMPS15
      </div>

      <Button asChild className="mt-5 w-full">
        <a href={SHOP_URL} target="_blank" rel="noopener noreferrer sponsored">
          Shop Crossrope
        </a>
      </Button>
    </div>
  );
}
