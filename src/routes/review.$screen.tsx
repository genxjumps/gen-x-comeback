import { createFileRoute, notFound } from "@tanstack/react-router";

import { AppReviewScreen } from "@/components/app-review-screen";
import { getReviewScreen } from "@/lib/app-review";

export const Route = createFileRoute("/review/$screen")({
  loader: ({ params }) => {
    const screen = getReviewScreen(params.screen);
    if (!screen) throw notFound();
    return { screen };
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: `${loaderData?.screen.title ?? "App Review"} | Gen X Jumps Review` },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: ReviewScreenRoute,
});

function ReviewScreenRoute() {
  const { screen } = Route.useLoaderData();
  return <AppReviewScreen screen={screen} />;
}
