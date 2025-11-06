"use client";

import Autoplay from "embla-carousel-autoplay";
import useEmblaCarousel from "embla-carousel-react";
import * as React from "react";

import { cn } from "@/lib/utils";

type MotivationBannerProps = {
  messages: string[];
  className?: string;
  delay?: number;
};

export function MotivationBanner({
  messages,
  className,
  delay = 1_000,
}: MotivationBannerProps) {
  const autoplay = React.useRef(
    Autoplay({
      delay,
      stopOnInteraction: false,
      stopOnMouseEnter: false,
    })
  );

  const [emblaRef] = useEmblaCarousel(
    {
      axis: "y",
      loop: true,
      align: "start",
      duration: 20,
    },
    [autoplay.current]
  );

  if (messages.length === 0) {
    return null;
  }

  const slides = messages.length === 1 ? [...messages, ...messages] : messages;

  return (
    <div
      ref={emblaRef}
      className={cn(
        "relative h-6 w-full overflow-hidden rounded-md bg-primary/10 px-3 text-sm font-semibold text-primary sm:h-8 sm:w-72",
        className
      )}
    >
      <div className="flex h-full flex-col">
        {slides.map((message, index) => (
          <div
            key={`${message}-${index}`}
            className="flex h-6 flex-[0_0_100%] items-center whitespace-nowrap sm:h-8"
          >
            {message}
          </div>
        ))}
      </div>
    </div>
  );
}

