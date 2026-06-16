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
  const showReveal = phase === "revealing";
  const displayPool = pool.length > 0 ? pool : [currentCard];
  const rouletteSlots = Array.from({ length: Math.max(displayPool.length, 10) }, (_, slotIndex) => {
    const item = displayPool[slotIndex % displayPool.length] ?? currentCard;
    return { item, slotIndex };
  });

  return (
    <Paper withBorder radius="xl" p="lg" className={`draw-showcase-shell draw-showcase-${preset} draw-showcase-${phase ?? "idle"}`}>
      {preset === "wheel" ? (
        <div className="draw-wheel-stage">
          <div className={`draw-wheel-frame ${showSpin ? "is-spinning" : showReveal ? "is-settling" : "is-idle"}`}>
            <div className="draw-wheel-halo" aria-hidden="true" />
            <div className={`draw-wheel-disc ${showSpin ? "is-spinning" : showReveal ? "is-settling" : "is-idle"}`}>
              <div className="draw-wheel-rim" aria-hidden="true" />
              {rouletteSlots.map(({ item, slotIndex }) => {
                const angle = (360 / rouletteSlots.length) * slotIndex;
                const offset = Math.max(rouletteSlots.length, 1) * 17;
                const segmentHue = (slotIndex * 34) % 360;
                return (
                  <div
                    key={`${item.label}-${slotIndex}`}
                    className={`draw-wheel-slot ${showSpin ? "is-spinning" : ""}`}
                    style={{
                      transform: `rotate(${angle}deg) translateY(-${offset}px) rotate(${-angle}deg)`,
                      ["--slot-hue" as string]: `${segmentHue}`,
                    }}
                  >
                    <Card withBorder radius="md" p={4} className="draw-wheel-card">
                      <Image src={item.imageUrl} alt={item.label} radius="sm" fit="cover" />
                    </Card>
                  </div>
                );
              })}
              <div className="draw-wheel-core">
                <div className="draw-wheel-core-ring" aria-hidden="true" />
                <Image src={currentCard.imageUrl} alt={currentCard.label} radius="xl" fit="contain" className="draw-result-image draw-wheel-result" />
                <Text size="sm" fw={700} ta="center" className="draw-wheel-core-label">
                  {currentCard.label}
                </Text>
              </div>
            </div>
            <div className="draw-wheel-needle" aria-hidden="true">
              <div className="draw-wheel-needle-tip" />
              <div className="draw-wheel-needle-shadow" />
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

        .draw-wheel-frame {
          position: relative;
          width: min(82vw, 460px);
          aspect-ratio: 1;
          display: grid;
          place-items: center;
          filter: drop-shadow(0 24px 48px rgba(96, 68, 180, 0.16));
        }

        .draw-wheel-frame::before {
          content: "";
          position: absolute;
          inset: 0;
          border-radius: 999px;
          background:
            radial-gradient(circle at 50% 50%, rgba(255, 255, 255, 0.98) 0 12%, transparent 12.5% 100%),
            conic-gradient(
              from -90deg,
              rgba(122, 92, 250, 0.96) 0deg 18deg,
              rgba(255, 209, 102, 0.96) 18deg 36deg,
              rgba(91, 192, 222, 0.96) 36deg 54deg,
              rgba(255, 140, 122, 0.96) 54deg 72deg,
              rgba(140, 114, 255, 0.96) 72deg 90deg,
              rgba(97, 214, 167, 0.96) 90deg 108deg,
              rgba(255, 209, 102, 0.96) 108deg 126deg,
              rgba(122, 92, 250, 0.96) 126deg 144deg,
              rgba(255, 140, 122, 0.96) 144deg 162deg,
              rgba(91, 192, 222, 0.96) 162deg 180deg,
              rgba(140, 114, 255, 0.96) 180deg 198deg,
              rgba(97, 214, 167, 0.96) 198deg 216deg,
              rgba(255, 209, 102, 0.96) 216deg 234deg,
              rgba(122, 92, 250, 0.96) 234deg 252deg,
              rgba(255, 140, 122, 0.96) 252deg 270deg,
              rgba(91, 192, 222, 0.96) 270deg 288deg,
              rgba(140, 114, 255, 0.96) 288deg 306deg,
              rgba(97, 214, 167, 0.96) 306deg 324deg,
              rgba(255, 209, 102, 0.96) 324deg 342deg,
              rgba(122, 92, 250, 0.96) 342deg 360deg
            );
          box-shadow:
            inset 0 0 0 18px rgba(255, 255, 255, 0.78),
            inset 0 0 0 34px rgba(122, 92, 250, 0.12),
            0 20px 48px rgba(96, 68, 180, 0.22);
          opacity: 0.9;
        }

        .draw-wheel-frame::after {
          content: "";
          position: absolute;
          inset: 16px;
          border-radius: 999px;
          border: 2px solid rgba(255, 255, 255, 0.72);
          box-shadow: inset 0 0 0 1px rgba(122, 92, 250, 0.12);
          pointer-events: none;
        }

        .draw-wheel-frame.is-spinning {
          animation: wheel-breathe 1.1s ease-in-out infinite;
        }

        .draw-wheel-frame.is-settling {
          animation: wheel-settle 1.2s cubic-bezier(0.18, 0.84, 0.2, 1) 1;
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

        .draw-wheel-disc {
          position: relative;
          width: min(76vw, 400px);
          aspect-ratio: 1;
          border-radius: 999px;
          overflow: hidden;
          background: radial-gradient(circle at 50% 50%, rgba(255, 255, 255, 0.92) 0%, rgba(248, 244, 255, 0.86) 54%, rgba(234, 227, 255, 0.72) 100%);
          transform-origin: center center;
        }

        .draw-wheel-disc::before {
          content: "";
          position: absolute;
          inset: 8px;
          border-radius: 999px;
          background:
            radial-gradient(circle at 50% 50%, transparent 0 48%, rgba(255, 255, 255, 0.18) 48.5% 51%, transparent 51.5% 100%),
            repeating-conic-gradient(
              from -90deg,
              rgba(255, 255, 255, 0.22) 0deg 3deg,
              transparent 3deg 15deg
            );
          mix-blend-mode: screen;
          opacity: 0.75;
          pointer-events: none;
        }

        .draw-wheel-disc.is-spinning {
          animation: roulette-spin 1.05s linear infinite;
        }

        .draw-wheel-disc.is-settling {
          animation: roulette-settle 1.15s cubic-bezier(0.2, 0.9, 0.18, 1) 1;
        }

        .draw-wheel-rim {
          position: absolute;
          inset: 0;
          border-radius: 999px;
          box-shadow:
            inset 0 0 0 12px rgba(255, 255, 255, 0.42),
            inset 0 0 0 26px rgba(122, 92, 250, 0.14),
            inset 0 -18px 36px rgba(0, 0, 0, 0.08);
          pointer-events: none;
        }

        .draw-wheel-slot {
          position: absolute;
          inset: 50% auto auto 50%;
          transform-origin: center center;
          width: 76px;
          height: 76px;
          margin: -38px 0 0 -38px;
          filter: drop-shadow(0 8px 12px rgba(0, 0, 0, 0.12));
        }

        .draw-wheel-slot::before {
          content: "";
          position: absolute;
          inset: -8px;
          border-radius: 999px;
          background: conic-gradient(from 0deg, hsla(var(--slot-hue), 90%, 66%, 0.12), hsla(var(--slot-hue), 90%, 66%, 0.35));
          opacity: 0.85;
          filter: blur(1px);
          transform: scale(0.92);
        }

        .draw-wheel-card {
          position: relative;
          width: 76px;
          height: 76px;
          overflow: hidden;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.96);
          border: 1px solid rgba(122, 92, 250, 0.15);
          box-shadow:
            inset 0 0 0 3px rgba(255, 255, 255, 0.88),
            0 12px 18px rgba(0, 0, 0, 0.12);
        }

        .draw-wheel-card img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .draw-wheel-slot.is-spinning {
          animation: roulette-slot-pulse 0.9s ease-in-out infinite;
        }

        .draw-wheel-needle {
          position: absolute;
          top: -10px;
          left: 50%;
          transform: translateX(-50%);
          width: 52px;
          height: 54px;
          z-index: 2;
          display: grid;
          place-items: start center;
          pointer-events: none;
        }

        .draw-wheel-needle-tip {
          width: 0;
          height: 0;
          border-left: 16px solid transparent;
          border-right: 16px solid transparent;
          border-bottom: 30px solid var(--mantine-color-grape-6, #7a5cfa);
          filter: drop-shadow(0 12px 18px rgba(0, 0, 0, 0.22));
        }

        .draw-wheel-needle-shadow {
          width: 24px;
          height: 10px;
          margin-top: -2px;
          border-radius: 999px;
          background: rgba(0, 0, 0, 0.1);
          filter: blur(4px);
          opacity: 0.55;
        }

        .draw-wheel-core {
          position: absolute;
          inset: 50% auto auto 50%;
          transform: translate(-50%, -50%);
          width: min(42vw, 186px);
          aspect-ratio: 1;
          border-radius: 999px;
          display: grid;
          place-items: center;
          gap: 6px;
          padding: 16px;
          background:
            radial-gradient(circle at 50% 50%, rgba(255, 255, 255, 0.98) 0 55%, rgba(244, 239, 255, 0.96) 72%, rgba(227, 217, 255, 0.92) 100%);
          box-shadow:
            inset 0 0 0 1px rgba(122, 92, 250, 0.14),
            inset 0 0 0 14px rgba(255, 255, 255, 0.8),
            0 20px 44px rgba(0, 0, 0, 0.14);
          z-index: 1;
        }

        .draw-wheel-core-ring {
          position: absolute;
          inset: 10px;
          border-radius: inherit;
          border: 2px solid rgba(122, 92, 250, 0.14);
          box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.85);
        }

        .draw-wheel-result {
          max-width: 100%;
          width: 100%;
          max-height: 64%;
          border-radius: 20px;
          box-shadow: 0 10px 24px rgba(0, 0, 0, 0.12);
        }

        .draw-wheel-core-label {
          position: relative;
          z-index: 1;
          max-width: 92%;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
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

        @keyframes roulette-spin {
          0% {
            transform: rotate(0deg) scale(0.995);
          }
          100% {
            transform: rotate(360deg) scale(1);
          }
        }

        @keyframes roulette-settle {
          0% {
            transform: rotate(0deg) scale(1);
          }
          45% {
            transform: rotate(12deg) scale(1.01);
          }
          75% {
            transform: rotate(-4deg) scale(0.998);
          }
          100% {
            transform: rotate(0deg) scale(1);
          }
        }

        @keyframes wheel-breathe {
          0%,
          100% {
            filter: drop-shadow(0 24px 48px rgba(96, 68, 180, 0.16)) saturate(1);
          }
          50% {
            filter: drop-shadow(0 28px 60px rgba(96, 68, 180, 0.22)) saturate(1.05);
          }
        }

        @keyframes roulette-slot-pulse {
          0%,
          100% {
            transform: scale(1);
            opacity: 1;
          }
          50% {
            transform: scale(1.03);
            opacity: 0.92;
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

          .draw-wheel-frame {
            width: min(88vw, 380px);
          }

          .draw-wheel-slot {
            width: 60px;
            height: 60px;
            margin: -30px 0 0 -30px;
          }

          .draw-wheel-card {
            width: 60px;
            height: 60px;
          }

          .draw-wheel-core {
            width: min(48vw, 152px);
          }

          .draw-wheel-result {
            max-height: 60%;
          }
        }
      `}</style>
    </Paper>
  );
}
