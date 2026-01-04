// src/lib/story/deriveHubState.ts
import type { getStoryForHub } from "./getStoryForHub";

type StoryHubData = NonNullable<
  Awaited<ReturnType<typeof getStoryForHub>>
>;
export function deriveHubState(data: StoryHubData) {
    const {
      story,
      pages,
      characters,
      locations,
      styleGuide,
      product,
    } = data;
  
    const currentStep = story.currentStep ?? 1;
  
    const hasPages = pages.length > 0;
    const hasExtraction = characters.length > 0 || locations.length > 0;
    const illustratedPages = pages.filter(p => Boolean(p.imageUrl)).length;
  
    const steps = {
      write: {
        complete: hasPages,
        pageCount: pages.length,
      },
  
      extract: {
        complete: hasPages && hasExtraction,
        characters: characters.length,
        locations: locations.length,
        scenes: pages.length,
      },
  
      design: {
        current: currentStep === 3,
        charactersConfirmed: story.storyConfirmed
          ? characters.length
          : 0,
        charactersTotal: characters.length,
        styleReady: Boolean(styleGuide),
        complete:
          story.storyConfirmed === true &&
          Boolean(styleGuide),
      },
  
      payment: {
        unlocked: currentStep >= 4,
        paid: story.paymentStatus === "paid",
      },
  
      studio: {
        unlocked: currentStep >= 5,
        illustrated: illustratedPages,
        total: pages.length,
        complete:
          pages.length > 0 &&
          illustratedPages === pages.length,
      },
  
      print: {
        unlocked: currentStep >= 6,
        orderStatus: story.orderStatus,
        ready:
          story.orderStatus === "ready" ||
          story.orderStatus === "ordered",
      },
    };
  
    const progressScore =
      (steps.write.complete ? 1 : 0) +
      (steps.extract.complete ? 1 : 0) +
      (steps.design.complete ? 1 : 0) +
      (steps.payment.paid ? 1 : 0) +
      (steps.studio.complete ? 1 : 0) +
      (steps.print.ready ? 1 : 0);
  
    return {
      progressPercent: Math.round((progressScore / 6) * 100),
      steps,
    };
  }
  