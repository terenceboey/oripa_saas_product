"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { Badge, Card, Group, Image, Paper, Stack, Text } from "@mantine/core";

export type DrawAnimationPreset = "reel" | "wheel" | "flip";

export type DrawShowcaseCard = {
  label: string;
  imageUrl: string;
};

type Props = {
  preset: DrawAnimationPreset;
  phase: "spinning" | "revealing" | "done" | null;
  currentCard: DrawShowcaseCard;
  targetCard: DrawShowcaseCard;
  pool: DrawShowcaseCard[];
  index: number;
  total: number;
};

export function DrawShowcaseVisual({ preset, phase, currentCard, targetCard, pool, index, total }: Props) {
  const showSpin = phase === "spinning";
  const showReveal = phase === "revealing";
  const displayPool = pool.length > 0 ? pool : [targetCard];
  const [overlayCard, setOverlayCard] = useState<DrawShowcaseCard>(targetCard);
  const [overlayMotion, setOverlayMotion] = useState<"idle" | "shuffling" | "settling">("idle");
  const rouletteSlots = useMemo(() => {
    const totalSlots = Math.max(displayPool.length * 6, 24);
    const landingIndex = Math.max(Math.floor(totalSlots * 0.72), 14);

    return Array.from({ length: totalSlots }, (_, slotIndex) => {
      const item = slotIndex === landingIndex ? targetCard : displayPool[slotIndex % displayPool.length] ?? targetCard;
      return { item, slotIndex, landingIndex };
    });
  }, [displayPool, targetCard]);

  const carouselViewportRef = useRef<HTMLDivElement | null>(null);
  const carouselTrackRef = useRef<HTMLDivElement | null>(null);
  const carouselFrameRef = useRef<HTMLDivElement | null>(null);
  const carouselAnimationRef = useRef<number | null>(null);
  const overlayShuffleRef = useRef<number | null>(null);
  const overlaySettleRef = useRef<number | null>(null);

  useEffect(() => {
    if (preset !== "wheel") return undefined;
    const viewport = carouselViewportRef.current;
    const track = carouselTrackRef.current;
    if (!viewport || !track) return undefined;

    if (carouselAnimationRef.current) {
      window.cancelAnimationFrame(carouselAnimationRef.current);
      carouselAnimationRef.current = null;
    }

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const landingCard = track.querySelector<HTMLElement>("[data-landing-card='true']");
    if (!landingCard) return undefined;

    const cardWidth = landingCard.getBoundingClientRect().width;
    const edgePadding = Math.max(24, viewport.clientWidth / 2 - cardWidth / 2);
    track.style.setProperty("--carousel-edge-padding", `${edgePadding}px`);
    const targetScroll = Math.max(0, landingCard.offsetLeft - viewport.clientWidth / 2 + cardWidth / 2);
    const approachScroll = Math.max(0, targetScroll - cardWidth * 1.6);

    if (reduceMotion || phase === "done") {
      viewport.scrollLeft = targetScroll;
      return undefined;
    }

    const startScroll = phase === "spinning" ? Math.max(0, targetScroll * 0.04) : viewport.scrollLeft;
    viewport.scrollLeft = startScroll;

    const duration = phase === "spinning" ? 2800 : 1400;
    const startTime = performance.now();
    const settleTarget = phase === "spinning" ? approachScroll : targetScroll;

    const easeOutQuint = (value: number) => 1 - Math.pow(1 - value, 5);
    const tick = (now: number) => {
      const progress = Math.min((now - startTime) / duration, 1);
      const eased = phase === "revealing" ? 1 - Math.pow(1 - progress, 3) : easeOutQuint(progress);
      const scroll = startScroll + (settleTarget - startScroll) * eased;
      viewport.scrollLeft = scroll;

      if (progress < 1) {
        carouselAnimationRef.current = window.requestAnimationFrame(tick);
      } else {
        carouselAnimationRef.current = null;
        viewport.scrollLeft = settleTarget;
      }
    };

    carouselAnimationRef.current = window.requestAnimationFrame(tick);

    return () => {
      if (carouselAnimationRef.current) {
        window.cancelAnimationFrame(carouselAnimationRef.current);
        carouselAnimationRef.current = null;
      }
    };
  }, [phase, preset, rouletteSlots]);

  useEffect(() => {
    if (preset !== "wheel") return undefined;

    if (overlayShuffleRef.current) {
      window.clearInterval(overlayShuffleRef.current);
      overlayShuffleRef.current = null;
    }

    if (overlaySettleRef.current) {
      window.clearTimeout(overlaySettleRef.current);
      overlaySettleRef.current = null;
    }

    const shufflePool = displayPool.length > 0 ? displayPool : [targetCard];

    if (phase === "spinning") {
      setOverlayCard(currentCard);
      setOverlayMotion("idle");
      return undefined;
    }

    if (phase === "revealing") {
      setOverlayMotion("shuffling");
      setOverlayCard(currentCard);

      overlayShuffleRef.current = window.setInterval(() => {
        const randomCard = shufflePool[Math.floor(Math.random() * shufflePool.length)] ?? targetCard;
        setOverlayCard(randomCard);
      }, 95);

      overlaySettleRef.current = window.setTimeout(() => {
        if (overlayShuffleRef.current) {
          window.clearInterval(overlayShuffleRef.current);
          overlayShuffleRef.current = null;
        }
        setOverlayCard(targetCard);
        setOverlayMotion("settling");
      }, 850);

      return () => {
        if (overlayShuffleRef.current) {
          window.clearInterval(overlayShuffleRef.current);
          overlayShuffleRef.current = null;
        }
        if (overlaySettleRef.current) {
          window.clearTimeout(overlaySettleRef.current);
          overlaySettleRef.current = null;
        }
      };
    }

    if (phase === "done") {
      setOverlayCard(targetCard);
      setOverlayMotion("settling");
    }

    return undefined;
  }, [currentCard, displayPool, phase, preset, targetCard]);

  return (
    <Paper withBorder radius="xl" p="lg" className={`draw-showcase-shell draw-showcase-${preset} draw-showcase-${phase ?? "idle"}`}>
      {preset === "wheel" ? (
        <div className="draw-wheel-stage">
          <div ref={carouselFrameRef} className={`draw-carousel-frame ${showSpin ? "is-spinning" : showReveal ? "is-settling" : "is-idle"}`}>
            <div className="draw-carousel-needle" aria-hidden="true">
              <div className="draw-carousel-needle-tip" />
              <div className="draw-carousel-needle-shadow" />
            </div>

            <div ref={carouselViewportRef} className="draw-carousel-viewport">
              <div ref={carouselTrackRef} className={`draw-carousel-track ${showSpin ? "is-spinning" : showReveal ? "is-settling" : "is-idle"}`}>
                {rouletteSlots.map(({ item, slotIndex, landingIndex }) => {
                  const isLandingCard = slotIndex === landingIndex;
                  const bandHue = (slotIndex * 29) % 360;
                  return (
                    <div
                      key={`${item.label}-${slotIndex}`}
                      className={`draw-carousel-slot ${isLandingCard ? "is-landing" : ""}`}
                      data-landing-card={isLandingCard ? "true" : "false"}
                      style={{
                        ["--band-hue" as string]: `${bandHue}`,
                      }}
                    >
                      <Card withBorder radius="lg" p={4} className="draw-carousel-card">
                        <Image src={item.imageUrl} alt={item.label} radius="md" fit="cover" />
                      </Card>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="draw-carousel-window" aria-hidden="true" />
            <div className="draw-carousel-center-glow" aria-hidden="true" />
            <div className={`draw-carousel-result ${overlayMotion === "shuffling" ? "is-shuffling" : overlayMotion === "settling" ? "is-settling" : ""}`}>
              <div className="draw-carousel-result-card">
                <Image src={overlayCard.imageUrl} alt={overlayCard.label} radius="lg" fit="contain" className="draw-result-image draw-carousel-result-image" />
              </div>
              <Text size="sm" fw={700} ta="center" className="draw-carousel-result-label" title={overlayCard.label}>
                {overlayCard.label}
              </Text>
            </div>
          </div>
        </div>
      ) : preset === "flip" ? (
        <div className={`draw-flip-stage ${showSpin ? "is-spinning" : "is-revealing"}`}>
          <div className="draw-flip-card">
            <div className="draw-flip-face draw-flip-back">
              <Text fw={900} size="2rem" ta="center" className="draw-flip-question">
                ?
              </Text>
              <Text ta="center" size="sm" c="dimmed">
                Mystery Prize
              </Text>
            </div>
            <div className="draw-flip-face draw-flip-front">
              <Image src={currentCard.imageUrl} alt={currentCard.label} radius="lg" fit="contain" className="draw-result-image" />
            </div>
          </div>
        </div>
      ) : (
        <div className="draw-reel-stage">
          <div className={`draw-reel-track ${showSpin ? "is-spinning" : "is-revealing"}`}>
            {displayPool.slice(0, 5).map((item, itemIndex) => (
              <Card key={`${item.label}-${itemIndex}`} withBorder radius="lg" p="xs" className={`draw-reel-card ${itemIndex === 2 ? "is-center" : ""}`}>
                <Image src={item.imageUrl} alt={item.label} radius="md" fit="cover" className="draw-reel-image" />
              </Card>
            ))}
          </div>
          <div className="draw-reel-spotlight">
            <Image src={currentCard.imageUrl} alt={currentCard.label} radius="lg" fit="contain" className="draw-result-image" />
          </div>
        </div>
      )}

      <Stack gap={4} align="center" mt="md">
        <Badge variant="light">
          #{index + 1} of {total}
        </Badge>
        <Group gap="xs" justify="center">
          <Text fw={800} ta="center" className="draw-showcase-title" title={currentCard.label}>
            {currentCard.label}
          </Text>
          {phase === "revealing" ? <Badge color="yellow">Winner</Badge> : null}
        </Group>
      </Stack>

      <style jsx global>{`
        .draw-showcase-shell {
          overflow: hidden;
        }

        .draw-result-image {
          width: 100%;
          max-width: 320px;
          margin: 0 auto;
          display: block;
          aspect-ratio: 3 / 4;
          object-fit: contain;
        }

        .draw-reel-stage,
        .draw-wheel-stage,
        .draw-flip-stage {
          position: relative;
          min-height: clamp(280px, 48vw, 440px);
          display: grid;
          place-items: center;
          width: 100%;
        }

        .draw-carousel-frame {
          position: relative;
          --carousel-frame-height: clamp(318px, 46vw, 420px);
          --carousel-window-width: clamp(148px, 19vw, 190px);
          --carousel-window-height: clamp(236px, 30vw, 306px);
          --carousel-result-width: clamp(124px, 17vw, 156px);
          width: 100%;
          max-width: 640px;
          min-height: var(--carousel-frame-height);
          margin-inline: auto;
          box-sizing: border-box;
          padding: 26px 18px 20px;
          border-radius: 32px;
          background:
            linear-gradient(180deg, rgba(255, 255, 255, 0.92), rgba(246, 241, 255, 0.9)),
            radial-gradient(circle at 50% 20%, rgba(123, 92, 250, 0.2), transparent 42%);
          box-shadow:
            inset 0 0 0 1px rgba(122, 92, 250, 0.14),
            0 24px 48px rgba(96, 68, 180, 0.14);
          overflow: hidden;
        }

        .draw-carousel-frame::before {
          content: "";
          position: absolute;
          inset: 12px;
          border-radius: 26px;
          border: 1px solid rgba(255, 255, 255, 0.68);
          pointer-events: none;
        }

        .draw-carousel-viewport {
          position: absolute;
          left: 18px;
          right: 18px;
          top: 50%;
          z-index: 1;
          transform: translateY(-50%);
          overflow: hidden;
          overflow-y: hidden;
          scroll-behavior: auto;
          scrollbar-width: none;
          -ms-overflow-style: none;
          padding: 18px 0;
        }

        .draw-carousel-viewport::-webkit-scrollbar {
          display: none;
        }

        .draw-carousel-track {
          display: flex;
          align-items: center;
          gap: 14px;
          width: max-content;
          padding: 0 var(--carousel-edge-padding, 220px);
          box-sizing: content-box;
          will-change: scroll-position;
        }

        .draw-carousel-slot {
          position: relative;
          flex: 0 0 auto;
          width: clamp(96px, 14vw, 128px);
          transition: transform 220ms ease, filter 220ms ease, opacity 220ms ease;
          opacity: 0.76;
        }

        .draw-carousel-slot.is-landing {
          opacity: 1;
          transform: scale(1.045);
          z-index: 2;
        }

        .draw-carousel-slot::before {
          content: "";
          position: absolute;
          inset: -6px;
          border-radius: 22px;
          background: linear-gradient(180deg, hsla(var(--band-hue), 90%, 70%, 0.24), hsla(var(--band-hue), 90%, 70%, 0.06));
          filter: blur(1px);
          opacity: 0.85;
        }

        .draw-carousel-card {
          position: relative;
          width: 100%;
          aspect-ratio: 3 / 4;
          overflow: hidden;
          border-radius: 20px;
          background: rgba(255, 255, 255, 0.98);
          border: 1px solid rgba(122, 92, 250, 0.14);
          box-shadow:
            inset 0 0 0 3px rgba(255, 255, 255, 0.9),
            0 10px 22px rgba(0, 0, 0, 0.12);
        }

        .draw-carousel-card img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .draw-carousel-needle {
          position: absolute;
          top: calc(50% - (var(--carousel-window-height) / 2) - 30px);
          left: 50%;
          transform: translateX(-50%);
          width: 52px;
          height: 58px;
          z-index: 6;
          display: grid;
          place-items: start center;
          pointer-events: none;
        }

        .draw-carousel-needle-tip {
          width: 0;
          height: 0;
          border-left: 16px solid transparent;
          border-right: 16px solid transparent;
          border-bottom: 30px solid var(--mantine-color-grape-6, #7a5cfa);
          filter: drop-shadow(0 12px 18px rgba(0, 0, 0, 0.24));
        }

        .draw-carousel-needle-shadow {
          width: 28px;
          height: 10px;
          margin-top: -2px;
          border-radius: 999px;
          background: rgba(0, 0, 0, 0.12);
          filter: blur(4px);
          opacity: 0.56;
        }

        .draw-carousel-window {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: var(--carousel-window-width);
          height: var(--carousel-window-height);
          border-radius: 28px;
          border: 2px solid rgba(123, 92, 250, 0.28);
          box-shadow:
            0 0 0 9999px rgba(37, 20, 74, 0.02),
            inset 0 0 0 1px rgba(255, 255, 255, 0.7),
            0 14px 30px rgba(96, 68, 180, 0.14);
          pointer-events: none;
          z-index: 4;
        }

        .draw-carousel-center-glow {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: calc(var(--carousel-window-width) * 1.12);
          height: calc(var(--carousel-window-height) * 1.08);
          border-radius: 34px;
          background: radial-gradient(circle at center, rgba(123, 92, 250, 0.14), transparent 68%);
          filter: blur(10px);
          pointer-events: none;
          z-index: 3;
        }

        .draw-carousel-result {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: var(--carousel-result-width);
          display: grid;
          place-items: center;
          gap: 8px;
          z-index: 5;
          pointer-events: none;
          padding: 0;
          box-sizing: border-box;
          transition: opacity 260ms ease, filter 260ms ease;
        }

        .draw-carousel-result.is-shuffling {
          transform: translate(-50%, -50%) scale(0.988);
          filter: saturate(1.06);
        }

        .draw-carousel-result.is-settling {
          transform: translate(-50%, -50%) scale(1);
          filter: saturate(1);
        }

        .draw-carousel-result-card {
          width: 100%;
          aspect-ratio: 3 / 4;
          border-radius: 24px;
          background: rgba(255, 255, 255, 0.96);
          box-shadow:
            0 18px 32px rgba(0, 0, 0, 0.14),
            inset 0 0 0 1px rgba(122, 92, 250, 0.12);
          padding: 10px;
          box-sizing: border-box;
          display: grid;
          place-items: center;
          transition: transform 260ms ease, box-shadow 260ms ease;
        }

        .draw-carousel-result.is-shuffling .draw-carousel-result-card {
          transform: translateY(-2px) rotate(-1deg);
          box-shadow:
            0 22px 38px rgba(0, 0, 0, 0.16),
            inset 0 0 0 1px rgba(122, 92, 250, 0.14);
        }

        .draw-carousel-result-image {
          width: 100%;
          height: 100%;
          max-width: 100%;
          max-height: none;
          border-radius: 18px;
          background: rgba(255, 255, 255, 0.95);
        }

        .draw-carousel-result-label {
          padding: 6px 10px;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.86);
          box-shadow: 0 10px 24px rgba(0, 0, 0, 0.08);
          max-width: 100%;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .draw-showcase-title {
          width: min(100%, 520px);
          min-height: 1.35em;
          max-height: 2.7em;
          line-height: 1.35;
          overflow: hidden;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
        }

        .draw-reel-track {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 10px;
          width: min(100%, 720px);
          align-items: center;
          transform: translateX(0);
          transition: transform 240ms ease, opacity 240ms ease;
          opacity: 0.95;
        }

        .draw-reel-track.is-spinning {
          animation: reel-shift 0.75s linear infinite;
        }

        .draw-reel-card {
          background: rgba(255, 255, 255, 0.9);
          transform: scale(0.92);
          opacity: 0.7;
          transition: transform 180ms ease, opacity 180ms ease;
        }

        .draw-reel-card.is-center {
          transform: scale(1.06);
          opacity: 1;
          box-shadow: 0 16px 36px rgba(0, 0, 0, 0.12);
        }

        .draw-reel-image {
          width: 100%;
          height: clamp(120px, 24vw, 180px);
          object-fit: cover;
        }

        .draw-reel-spotlight {
          position: absolute;
          inset: auto 50% 18px;
          transform: translateX(-50%);
          width: min(78vw, 360px);
          border-radius: 24px;
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.92), rgba(245, 242, 255, 0.92));
          box-shadow: 0 22px 44px rgba(96, 68, 180, 0.14);
          padding: 14px;
        }

        .draw-flip-stage {
          perspective: 1400px;
        }

        .draw-flip-card {
          position: relative;
          width: min(72vw, 320px);
          aspect-ratio: 3 / 4;
          transform-style: preserve-3d;
          transition: transform 900ms cubic-bezier(0.2, 0.75, 0.2, 1);
        }

        .draw-flip-stage.is-spinning .draw-flip-card {
          transform: rotateY(180deg) rotateZ(-4deg) scale(0.98);
          animation: flip-bob 1s ease-in-out infinite;
        }

        .draw-flip-face {
          position: absolute;
          inset: 0;
          backface-visibility: hidden;
          border-radius: 28px;
          display: grid;
          place-items: center;
          overflow: hidden;
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(243, 238, 255, 0.96));
          box-shadow: 0 24px 48px rgba(0, 0, 0, 0.14);
        }

        .draw-flip-back {
          border: 1px solid rgba(122, 92, 250, 0.14);
        }

        .draw-flip-front {
          transform: rotateY(180deg);
          background: rgba(255, 255, 255, 0.98);
          padding: 14px;
        }

        .draw-flip-question {
          width: 84px;
          height: 84px;
          border-radius: 999px;
          display: grid;
          place-items: center;
          color: var(--mantine-color-grape-6, #7a5cfa);
          background: rgba(122, 92, 250, 0.12);
          box-shadow: inset 0 0 0 1px rgba(122, 92, 250, 0.12);
        }

        @keyframes reel-shift {
          0% {
            transform: translateX(-8px);
          }
          50% {
            transform: translateX(8px);
          }
          100% {
            transform: translateX(-8px);
          }
        }

        @keyframes flip-bob {
          0%, 100% {
            transform: rotateY(180deg) rotateZ(-4deg) translateY(0);
          }
          50% {
            transform: rotateY(180deg) rotateZ(-4deg) translateY(-4px);
          }
        }

        @media (max-width: 700px) {
          .draw-reel-track {
            width: 100%;
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }

          .draw-reel-card:nth-child(1),
          .draw-reel-card:nth-child(5) {
            display: none;
          }

          .draw-carousel-frame {
            --carousel-frame-height: clamp(328px, 78vw, 390px);
            --carousel-window-width: clamp(124px, 32vw, 160px);
            --carousel-window-height: clamp(198px, 44vw, 248px);
            --carousel-result-width: clamp(116px, 30vw, 144px);
            width: 100%;
            max-width: min(100vw - 24px, 540px);
            min-height: var(--carousel-frame-height);
            padding: 18px 10px 14px;
            border-radius: 24px;
          }

          .draw-carousel-viewport {
            left: 10px;
            right: 10px;
          }

          .draw-carousel-track {
            gap: 8px;
            padding: 0 var(--carousel-edge-padding, 130px);
          }

          .draw-carousel-slot {
            width: clamp(74px, 20vw, 96px);
          }

          .draw-carousel-window {
            border-radius: 22px;
          }

          .draw-carousel-needle {
            top: calc(50% - (var(--carousel-window-height) / 2) - 24px);
          }

          .draw-carousel-result {
            width: var(--carousel-result-width);
          }

          .draw-carousel-result-image {
            height: 100%;
          }

          .draw-carousel-result-label {
            display: block;
            width: 100%;
            min-height: 26px;
            max-height: 26px;
            line-height: 18px;
            font-size: 0.72rem;
            padding: 4px 8px;
          }

          .draw-showcase-title {
            width: min(100%, 300px);
            min-height: 44px;
            max-height: 44px;
            line-height: 22px;
            font-size: 0.92rem;
          }
        }
      `}</style>
    </Paper>
  );
}
