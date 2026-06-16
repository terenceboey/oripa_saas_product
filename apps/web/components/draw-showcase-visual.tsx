"use client";

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
  pool: DrawShowcaseCard[];
  index: number;
  total: number;
};

export function DrawShowcaseVisual({ preset, phase, currentCard, pool, index, total }: Props) {
  const showSpin = phase === "spinning";
  const displayPool = pool.length > 0 ? pool : [currentCard];
  const wheelItems = displayPool.slice(0, Math.min(displayPool.length, 8));

  return (
    <Paper withBorder radius="xl" p="lg" className={`draw-showcase-shell draw-showcase-${preset} draw-showcase-${phase ?? "idle"}`}>
      {preset === "wheel" ? (
        <div className="draw-wheel-stage">
          <div className={`draw-wheel-ring ${showSpin ? "is-spinning" : ""}`}>
            {wheelItems.map((item, itemIndex) => {
              const angle = (360 / wheelItems.length) * itemIndex;
              const offset = Math.max(wheelItems.length, 1) * 18;
              return (
                <div
                  key={`${item.label}-${itemIndex}`}
                  className="draw-wheel-item"
                  style={{
                    transform: `rotate(${angle}deg) translateY(-${offset}px) rotate(${-angle}deg)`,
                  }}
                >
                  <Card withBorder radius="md" p={4} className="draw-wheel-card">
                    <Image src={item.imageUrl} alt={item.label} radius="sm" fit="cover" />
                  </Card>
                </div>
              );
            })}
          </div>
          <div className="draw-wheel-pointer" aria-hidden="true" />
          <div className="draw-wheel-center">
            <Image src={currentCard.imageUrl} alt={currentCard.label} radius="lg" fit="contain" className="draw-result-image" />
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
          <Text fw={800} ta="center">
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

        .draw-wheel-ring {
          position: relative;
          width: min(76vw, 380px);
          aspect-ratio: 1;
          border-radius: 999px;
          border: 12px solid rgba(123, 92, 250, 0.18);
          box-shadow: inset 0 0 0 10px rgba(255, 255, 255, 0.82), 0 22px 44px rgba(96, 68, 180, 0.14);
          background: radial-gradient(circle, rgba(255, 255, 255, 0.96) 0%, rgba(248, 244, 255, 0.88) 55%, rgba(234, 227, 255, 0.72) 100%);
        }

        .draw-wheel-ring.is-spinning {
          animation: wheel-spin 1.8s cubic-bezier(0.16, 1, 0.3, 1) infinite;
        }

        .draw-wheel-item {
          position: absolute;
          inset: 50% auto auto 50%;
          transform-origin: center center;
          width: 74px;
          height: 74px;
          margin: -37px 0 0 -37px;
        }

        .draw-wheel-card {
          width: 74px;
          height: 74px;
          overflow: hidden;
          border-radius: 18px;
          background: rgba(255, 255, 255, 0.96);
        }

        .draw-wheel-card img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .draw-wheel-pointer {
          position: absolute;
          top: 8px;
          left: 50%;
          width: 0;
          height: 0;
          transform: translateX(-50%);
          border-left: 14px solid transparent;
          border-right: 14px solid transparent;
          border-bottom: 24px solid var(--mantine-color-grape-6, #7a5cfa);
          filter: drop-shadow(0 10px 18px rgba(0, 0, 0, 0.18));
        }

        .draw-wheel-center {
          position: absolute;
          inset: 50% auto auto 50%;
          transform: translate(-50%, -50%);
          width: min(40vw, 180px);
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.92);
          padding: 12px;
          box-shadow: 0 18px 36px rgba(0, 0, 0, 0.1);
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

        @keyframes wheel-spin {
          0% {
            transform: rotate(0deg);
          }
          100% {
            transform: rotate(360deg);
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

          .draw-wheel-item {
            width: 58px;
            height: 58px;
            margin: -29px 0 0 -29px;
          }

          .draw-wheel-card {
            width: 58px;
            height: 58px;
          }

          .draw-wheel-center {
            width: min(52vw, 150px);
          }
        }
      `}</style>
    </Paper>
  );
}
