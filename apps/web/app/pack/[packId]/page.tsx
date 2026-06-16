"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { Badge, Button, Card, Container, Group, Image, Modal, Paper, SimpleGrid, Stack, Text, Title } from "@mantine/core";
import { packTierSnapshotSchema, type PackTierSnapshot } from "@oripa/shared";
import { useBackForwardRefresh } from "../../../lib/use-back-forward-refresh";
import { applyVendorFavicon } from "../../../lib/favicon";
import { normalizeVendorFaviconUrl, normalizeVendorLogoUrl, resolvePackBannerMediaUrl } from "../../../lib/media-url";
import { VendorThemeProvider } from "../../../lib/vendor-theme";
import { DrawShowcaseVisual } from "../../../components/draw-showcase-visual";

type Prize = {
  id: string;
  label: string;
  imageUrl?: string | null;
  estimatedValue: number;
  remainingStock: number;
  dropRatePercent?: number;
};

type Pack = {
  id: string;
  title: string;
  packBannerImageUrl?: string | null;
  pricePoints: number;
  remainingStock: number;
  totalStock: number;
  limitedLabel?: string | null;
  prizes: Prize[];
  tierSnapshotJson?: PackTierSnapshot | null;
};

type Wallet = {
  id: string;
  balancePoints: number;
};

type DrawResult = {
  packId: string;
  quantity: number;
  totalCost: number;
  draws: Array<{
    drawId: string;
    prizeId: string | null;
    prizeLabel?: string | null;
    prizeImageUrl?: string | null;
  }>;
};

type VendorTheme = {
  storefrontThemePreset?: string | null;
  drawAnimationPreset?: "reel" | "wheel" | "flip" | null;
  storefrontPrimary: string;
  storefrontSecondary: string;
  storefrontAccent: string;
  storefrontSurface: string;
  storefrontText: string;
  storefrontMuted: string;
  storefrontRadius: number;
};
type ImagePreview = {
  label: string;
  imageUrl: string;
};
type DrawShowcaseCard = {
  label: string;
  imageUrl: string;
};

const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const configuredVendorHost = process.env.NEXT_PUBLIC_TENANT_HOST ?? "demo.localhost";
const defaultPokemonCardImage = "https://archives.bulbagarden.net/media/upload/1/17/Cardback.jpg";
const defaultPackBannerImage = "/default-pack-banner-desktop.webp";
const defaultPackBannerImageMobile = "/default-pack-banner-mobile.webp";
const clientPageHeader = { "x-client-page": "/pack/[packId]" };

function resolveTierOdds(tiers: PackTierSnapshot["tiers"]) {
  const fixedPercentTotal = tiers.reduce((sum, tier) => sum + (typeof tier.percentage === "number" ? tier.percentage : 0), 0);
  const flexCount = tiers.filter((tier) => typeof tier.percentage !== "number").length;
  const remainingPercent = Math.max(0, 100 - fixedPercentTotal);
  const fallbackPercent = flexCount > 0 ? remainingPercent / flexCount : 0;

  return tiers.map((tier) => (typeof tier.percentage === "number" ? tier.percentage : fallbackPercent));
}

export default function PackDrawPage() {
  const params = useParams<{ packId: string }>();
  const packId = String(params?.packId ?? "");
  const runtimeVendorHost = useMemo(() => {
    if (typeof window !== "undefined" && window.location?.host) return window.location.host.toLowerCase();
    return configuredVendorHost;
  }, []);

  const headers = useMemo(() => ({ ...clientPageHeader }), [runtimeVendorHost]);

  const [pack, setPack] = useState<Pack | null>(null);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [drawing, setDrawing] = useState(false);
  const [lastDraw, setLastDraw] = useState<DrawResult | null>(null);
  const [imagePreview, setImagePreview] = useState<ImagePreview | null>(null);
  const [drawShowcase, setDrawShowcase] = useState<DrawResult | null>(null);
  const [drawShowcaseIndex, setDrawShowcaseIndex] = useState(0);
  const [drawShowcasePhase, setDrawShowcasePhase] = useState<"spinning" | "revealing" | "done" | null>(null);
  const [drawShowcaseCard, setDrawShowcaseCard] = useState<DrawShowcaseCard | null>(null);
  const [drawShowcaseSoundEnabled, setDrawShowcaseSoundEnabled] = useState(true);
  const [confettiBurstKey, setConfettiBurstKey] = useState(0);
  const [pendingDrawQuantity, setPendingDrawQuantity] = useState<number | null>(null);
  const [theme, setTheme] = useState<VendorTheme | null>(null);
  const [vendorLogo, setVendorLogo] = useState<string | null>(null);
  const [vendorFavicon, setVendorFavicon] = useState<string | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const drawShowcaseSoundEnabledRef = useRef(drawShowcaseSoundEnabled);
  const tierSnapshot = useMemo(() => {
    const parsed = packTierSnapshotSchema.safeParse(pack?.tierSnapshotJson);
    return parsed.success ? parsed.data : null;
  }, [pack?.tierSnapshotJson]);
  const tierOdds = useMemo(() => {
    if (!tierSnapshot) return [];
    return resolveTierOdds(tierSnapshot.tiers);
  }, [tierSnapshot]);

  const loadData = useCallback(async () => {
    if (!packId) return;
    setLoading(true);
    setError(null);

    try {
      const [packResponse, walletResponse, vendorResponse] = await Promise.all([
        fetch(`${apiBase}/v1/packs/${packId}`, { headers, credentials: "include", cache: "no-store" }),
        fetch(`${apiBase}/v1/wallet`, { headers, credentials: "include", cache: "no-store" }),
        fetch(`${apiBase}/v1/vendor/current`, { headers, credentials: "include", cache: "no-store" }),
      ]);

      if (!packResponse.ok) {
        const payload = await packResponse.json().catch(() => ({}));
        throw new Error(payload.error ?? "Pack not found");
      }
      const packPayload = await packResponse.json();
      const walletPayload = walletResponse.ok ? await walletResponse.json() : { wallet: null };
      const vendorPayload = vendorResponse.ok ? await vendorResponse.json() : null;

      setPack(packPayload.pack);
      setWallet(walletPayload.wallet ?? null);
      setTheme(vendorPayload?.vendor?.vendorSettings ?? null);
      setVendorLogo(normalizeVendorLogoUrl(vendorPayload?.vendor?.logoImageUrl) || null);
      setVendorFavicon(normalizeVendorFaviconUrl(vendorPayload?.vendor?.faviconImageUrl, vendorPayload?.vendor?.logoImageUrl) || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load pack");
    } finally {
      setLoading(false);
    }
  }, [headers, packId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useBackForwardRefresh(loadData, { cooldownMs: 15000 });

  const isDrawShowcaseOpen = Boolean(drawShowcase);
  const isDrawConfirmationOpen = pendingDrawQuantity !== null;
  const drawShowcasePool = useMemo(() => {
    return (pack?.prizes ?? []).map((prize) => ({
      label: prize.label,
      imageUrl: prize.imageUrl || defaultPokemonCardImage,
    }));
  }, [pack?.prizes]);
  const drawShowcaseFallbackCard = drawShowcasePool[0] ?? { label: "Mystery Card", imageUrl: defaultPokemonCardImage };
  const currentDrawShowcaseCard = drawShowcaseCard ?? drawShowcaseFallbackCard;

  async function ensureAudioContext() {
    if (typeof window === "undefined") return null;
    if (!audioContextRef.current) {
      const AudioContextCtor = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextCtor) return null;
      audioContextRef.current = new AudioContextCtor();
    }
    if (audioContextRef.current.state === "suspended") {
      await audioContextRef.current.resume().catch(() => null);
    }
    return audioContextRef.current;
  }

  async function playTone(frequency: number, durationMs: number, options?: { type?: OscillatorType; gain?: number; whenMs?: number }) {
    const context = await ensureAudioContext();
    if (!context) return;
    const oscillator = context.createOscillator();
    const gainNode = context.createGain();
    oscillator.type = options?.type ?? "sine";
    oscillator.frequency.value = frequency;
    gainNode.gain.value = options?.gain ?? 0.04;
    oscillator.connect(gainNode);
    gainNode.connect(context.destination);
    const startAt = context.currentTime + ((options?.whenMs ?? 0) / 1000);
    oscillator.start(startAt);
    gainNode.gain.setValueAtTime(options?.gain ?? 0.04, startAt);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, startAt + durationMs / 1000);
    oscillator.stop(startAt + durationMs / 1000 + 0.05);
  }

  async function playSpinTick() {
    if (!drawShowcaseSoundEnabledRef.current) return;
    void playTone(760, 55, { type: "square", gain: 0.015 });
  }

  async function playRevealChime() {
    if (!drawShowcaseSoundEnabledRef.current) return;
    void playTone(523.25, 120, { type: "triangle", gain: 0.03 });
    void playTone(659.25, 140, { type: "triangle", gain: 0.03, whenMs: 110 });
    void playTone(783.99, 180, { type: "triangle", gain: 0.035, whenMs: 220 });
  }

  function closeDrawShowcase() {
    setDrawShowcase(null);
    setDrawShowcaseIndex(0);
    setDrawShowcasePhase(null);
    setDrawShowcaseCard(null);
    setConfettiBurstKey((value) => value + 1);
  }

  function openDrawConfirmation(quantity: number) {
    if (!pack || drawing || isDrawShowcaseOpen) return;
    setPendingDrawQuantity(quantity);
  }

  function cancelDrawConfirmation() {
    setPendingDrawQuantity(null);
  }

  async function handleDraw(quantity: number) {
    if (!pack) return;
    setDrawing(true);
    setError(null);
    setDrawShowcase(null);
    setDrawShowcaseIndex(0);
    setDrawShowcasePhase(null);
    setDrawShowcaseCard(null);
    void ensureAudioContext();

    const idempotencyKey = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;

    try {
      const response = await fetch(`${apiBase}/v1/draws`, {
        method: "POST",
        headers: {
          ...headers,
          "content-type": "application/json",
          "x-idempotency-key": idempotencyKey,
        },
        credentials: "include",
        body: JSON.stringify({ packId: pack.id, quantity }),
      });

      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Draw failed");

      setLastDraw(payload);
      setDrawShowcase(payload);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Draw failed");
    } finally {
      setDrawing(false);
    }
  }

  async function confirmDraw() {
    if (pendingDrawQuantity === null) return;
    const quantity = pendingDrawQuantity;
    setPendingDrawQuantity(null);
    await handleDraw(quantity);
  }

  const storefrontThemeStyle = useMemo(() => {
    if (!theme) return undefined;
    return {
      ["--brand" as string]: theme.storefrontPrimary,
      ["--card" as string]: theme.storefrontSurface,
      ["--text" as string]: theme.storefrontText,
      ["--muted" as string]: theme.storefrontMuted,
      ["--border" as string]: theme.storefrontSecondary,
      ["--brand-soft" as string]: theme.storefrontSecondary,
      ["--brand-accent" as string]: theme.storefrontAccent,
      ["--radius-lg" as string]: `${theme.storefrontRadius}px`,
    } as CSSProperties;
  }, [theme]);
  const drawAnimationPreset = theme?.drawAnimationPreset ?? "reel";

  useEffect(() => {
    applyVendorFavicon(normalizeVendorFaviconUrl(vendorFavicon, vendorLogo));
  }, [vendorFavicon, vendorLogo]);

  useEffect(() => {
    drawShowcaseSoundEnabledRef.current = drawShowcaseSoundEnabled;
  }, [drawShowcaseSoundEnabled]);

  useEffect(() => {
    if (!drawShowcase || !pack) return undefined;
    let active = true;
    const currentDraw = drawShowcase.draws[drawShowcaseIndex];
    const fallbackCard = drawShowcasePool[0] ?? { label: "Mystery Card", imageUrl: defaultPokemonCardImage };
    const spinPool = drawShowcasePool.length > 0 ? drawShowcasePool : [fallbackCard];
    const spinDurationMs = 3200;
    const revealDurationMs = 1800;
    let spinInterval: number | null = null;
    let revealTimeout: number | null = null;
    let nextTimeout: number | null = null;

    setDrawShowcasePhase("spinning");
    setDrawShowcaseCard((current) => current ?? fallbackCard);

    spinInterval = window.setInterval(() => {
      if (!active) return;
      const randomCard = spinPool[Math.floor(Math.random() * spinPool.length)] ?? fallbackCard;
      setDrawShowcaseCard(randomCard);
      void playSpinTick();
    }, 85);

    revealTimeout = window.setTimeout(() => {
      if (!active || !currentDraw) return;
      if (spinInterval) window.clearInterval(spinInterval);
      const finalCard = {
        label: currentDraw.prizeLabel || "No Prize",
        imageUrl: currentDraw.prizeImageUrl || defaultPokemonCardImage,
      };
      setDrawShowcaseCard(finalCard);
      setDrawShowcasePhase("revealing");
      void playRevealChime();

      nextTimeout = window.setTimeout(() => {
        if (!active) return;
        if (drawShowcaseIndex < drawShowcase.draws.length - 1) {
          setDrawShowcaseIndex((value) => value + 1);
          return;
        }
        setDrawShowcasePhase("done");
        setConfettiBurstKey((value) => value + 1);
      }, revealDurationMs);
    }, spinDurationMs);

    return () => {
      active = false;
      if (spinInterval) window.clearInterval(spinInterval);
      if (revealTimeout) window.clearTimeout(revealTimeout);
      if (nextTimeout) window.clearTimeout(nextTimeout);
    };
  }, [drawShowcase, drawShowcaseIndex, drawShowcasePool, pack]);

  return (
    <VendorThemeProvider theme={theme}>
      <Container size="xl" py="lg" style={storefrontThemeStyle}>
        <Stack gap="lg">
        <Paper withBorder radius="xl" p="md" shadow="sm">
          <Group justify="space-between" align="center" wrap="wrap">
            <Button component={Link} href="/" variant="light">
              Back to Catalog
            </Button>
            <Group gap="xs" wrap="wrap">
              <Button component={Link} href="/fairness-proofs" variant="light">
                Fairness Proofs
              </Button>
              <Badge variant="light" size="lg">
                Points: {wallet?.balancePoints?.toLocaleString() ?? "-"}
              </Badge>
            </Group>
          </Group>
        </Paper>

        {loading ? (
          <Paper withBorder radius="xl" p="lg" shadow="sm">
            <Text c="dimmed">Loading pack...</Text>
          </Paper>
        ) : null}
        {!loading && !pack ? (
          <Paper withBorder radius="xl" p="lg" shadow="sm">
            <Text c="red">Pack not found</Text>
          </Paper>
        ) : null}

        {pack ? (
          <>
            <Paper withBorder radius="xl" p="lg" shadow="sm">
              <Stack gap="md">
                {(() => {
                  const image = resolvePackBannerMediaUrl(pack.packBannerImageUrl, defaultPackBannerImage);
                  return (
                    <picture>
                      {image.allowSources ? <source media="(max-width: 760px)" srcSet={image.mobile} type={image.mobileType ?? undefined} /> : null}
                      {image.allowSources ? <source srcSet={image.desktop} type={image.desktopType ?? undefined} /> : null}
                      <img
                        src={image.fallback}
                        alt={`${pack.title} banner`}
                        loading="lazy"
                        decoding="async"
                        style={{
                          width: "100%",
                          height: "auto",
                          display: "block",
                          borderRadius: 16,
                          objectFit: "contain",
                          objectPosition: "center",
                          background: "var(--card, #fff)",
                        }}
                        onError={(e) => {
                          e.currentTarget.src = defaultPackBannerImageMobile;
                        }}
                      />
                    </picture>
                  );
                })()}

                <Group justify="space-between" align="start" wrap="wrap">
                  <div>
                    <Title order={1}>{pack.title}</Title>
                    <Text c="dimmed">
                      Remaining {pack.remainingStock}/{pack.totalStock}
                    </Text>
                  </div>
                  {pack.limitedLabel ? <Badge color="yellow" variant="light">{pack.limitedLabel}</Badge> : null}
                </Group>

                <Group justify="space-between" align="center" wrap="wrap">
                  <Text c="dimmed">1 draw</Text>
                  <Text fw={800} size="lg">
                    {pack.pricePoints.toLocaleString()} pts
                  </Text>
                </Group>

                <Group gap="sm" wrap="wrap">
                  <Button disabled={drawing || isDrawShowcaseOpen || isDrawConfirmationOpen || pack.remainingStock < 1} onClick={() => openDrawConfirmation(1)}>
                    Draw
                  </Button>
                  <Button variant="outline" disabled={drawing || isDrawShowcaseOpen || isDrawConfirmationOpen || pack.remainingStock < 10} onClick={() => openDrawConfirmation(10)}>
                    10x Draw
                  </Button>
                </Group>

                {error ? <Text c="red">{error}</Text> : null}
              </Stack>
            </Paper>

            {tierSnapshot && tierSnapshot.tiers.length > 0 ? (
              <Paper withBorder radius="xl" p="lg" shadow="sm">
                <Stack gap="md">
                  <div>
                    <Title order={2}>Contents</Title>
                    <Text c="dimmed">This reflects the vendor-configured tier structure preserved with the pack.</Text>
                  </div>
                  <Stack gap="md">
                    {tierSnapshot.tiers.map((tier, tierIndex) => {
                      const tierChance = tierOdds[tierIndex] ?? 0;
                      const itemChance = tier.items.length > 0 ? tierChance / tier.items.length : 0;
                      return (
                        <Card key={`${tier.name}-${tierIndex}`} withBorder radius="lg" p="md">
                          <Stack gap="sm">
                            <Group justify="space-between" align="center">
                              <Text fw={800}>{tier.name}</Text>
                              <Badge variant="light">{tierChance.toFixed(4)}%</Badge>
                            </Group>
                            <Text size="sm" c="dimmed">
                              {tier.items.length} items | {itemChance.toFixed(4)}% per item
                            </Text>
                            <SimpleGrid cols={{ base: 2, sm: 3, md: 4, lg: 6 }} spacing="sm">
                              {tier.items.map((item, itemIndex) => (
                                <Card
                                  key={`${tier.name}-${item.label}-${itemIndex}`}
                                  withBorder
                                  radius="md"
                                  p="xs"
                                  style={{ cursor: "pointer" }}
                                  onClick={() =>
                                    setImagePreview({
                                      label: item.label,
                                      imageUrl: item.imageUrl || defaultPokemonCardImage,
                                    })
                                  }
                                >
                                  <Image src={item.imageUrl || defaultPokemonCardImage} alt={item.label} radius="sm" h={140} fit="contain" bg="white" />
                                  <Stack gap={2} mt={6}>
                                    <Text fw={700} size="sm" lineClamp={2}>
                                      {item.label}
                                    </Text>
                                    <Text size="xs" c="dimmed">
                                      Stock {item.stock}
                                    </Text>
                                  </Stack>
                                </Card>
                              ))}
                            </SimpleGrid>
                          </Stack>
                        </Card>
                      );
                    })}
                  </Stack>
                </Stack>
              </Paper>
            ) : null}

            {lastDraw ? (
              <Paper withBorder radius="xl" p="lg" shadow="sm">
                <Stack gap="sm">
                  <div>
                    <Title order={2}>Draw Result</Title>
                    <Text c="dimmed">
                      Quantity {lastDraw.quantity} | Cost {lastDraw.totalCost.toLocaleString()} pts
                    </Text>
                  </div>
                  <SimpleGrid cols={{ base: 2, sm: 3, md: 4, lg: 5 }} spacing="sm">
                    {lastDraw.draws.map((draw) => (
                      <Card key={draw.drawId} withBorder radius="md" p="xs">
                        <Image src={draw.prizeImageUrl || defaultPokemonCardImage} alt={draw.prizeLabel || "No Prize"} radius="sm" h={160} fit="contain" bg="white" />
                        <Stack gap={2} mt={6}>
                          <Text fw={700} size="sm" lineClamp={2}>
                            {draw.prizeLabel || "No Prize"}
                          </Text>
                          <Text c="dimmed" size="xs">
                            ID {draw.drawId.slice(0, 10)}
                          </Text>
                        </Stack>
                      </Card>
                    ))}
                  </SimpleGrid>
                </Stack>
              </Paper>
            ) : null}
          </>
        ) : null}
        </Stack>

      <Modal opened={isDrawShowcaseOpen} onClose={drawShowcasePhase === "done" ? closeDrawShowcase : () => null} centered size="lg" withCloseButton={false} radius="lg">
        {drawShowcase ? (
          <Stack gap="md" style={{ position: "relative", overflow: "hidden" }}>
            {drawShowcasePhase === "done" ? (
              <div key={confettiBurstKey} aria-hidden="true" style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
                {Array.from({ length: 18 }).map((_, index) => {
                  const left = (index * 13) % 100;
                  const delay = (index % 6) * 0.05;
                  const duration = 1.6 + (index % 5) * 0.18;
                  const hue = (index * 37) % 360;
                  const drift = ((index % 9) - 4) * 14;
                  return (
                    <span
                      key={`${confettiBurstKey}-${index}`}
                      style={{
                        position: "absolute",
                        top: 0,
                        left: `${left}%`,
                        width: 8,
                        height: 14,
                        borderRadius: 999,
                        background: `hsl(${hue} 85% 60%)`,
                        opacity: 0,
                        animation: `pack-confetti ${duration}s ease-in ${delay}s forwards`,
                        ["--drift" as string]: `${drift}px`,
                      }}
                    />
                  );
                })}
              </div>
            ) : null}

            <Group justify="space-between" align="start" wrap="wrap">
              <div>
                <Title order={3}>
                  {drawAnimationPreset === "wheel" ? "Lottery Wheel" : drawAnimationPreset === "flip" ? "Card Flip Reveal" : "Reel Spin"}
                </Title>
                <Text c="dimmed" size="sm">
                  {drawShowcasePhase === "spinning" ? "Spinning the lottery..." : drawShowcasePhase === "revealing" ? "Result locked in." : "Draw complete."}
                </Text>
              </div>
              <Group gap="xs">
                <Button variant={drawShowcaseSoundEnabled ? "filled" : "light"} onClick={() => setDrawShowcaseSoundEnabled((value) => !value)}>
                  Sound {drawShowcaseSoundEnabled ? "On" : "Off"}
                </Button>
                {drawShowcasePhase === "done" ? (
                  <Button variant="outline" onClick={closeDrawShowcase}>
                    Close
                  </Button>
                ) : null}
              </Group>
            </Group>

            <DrawShowcaseVisual
              preset={drawAnimationPreset}
              phase={drawShowcasePhase}
              currentCard={currentDrawShowcaseCard}
              targetCard={{
                label: drawShowcase.draws[drawShowcaseIndex]?.prizeLabel || "No Prize",
                imageUrl: drawShowcase.draws[drawShowcaseIndex]?.prizeImageUrl || defaultPokemonCardImage,
              }}
              pool={drawShowcasePool}
              index={drawShowcaseIndex}
              total={drawShowcase.draws.length}
            />

            <Group justify="space-between" align="center" wrap="wrap">
              <Text c="dimmed" size="sm">
                {drawShowcase.quantity} draw{drawShowcase.quantity > 1 ? "s" : ""} | Cost {drawShowcase.totalCost.toLocaleString()} pts
              </Text>
              {drawShowcasePhase === "done" ? <Button onClick={closeDrawShowcase}>Continue</Button> : null}
            </Group>
          </Stack>
        ) : null}
      </Modal>

      <Modal opened={Boolean(isDrawConfirmationOpen && pack && pendingDrawQuantity !== null)} onClose={cancelDrawConfirmation} centered radius="lg" title="Confirm Draw">
        {pack && pendingDrawQuantity !== null ? (
          <Stack gap="md">
            <Text c="dimmed">Please confirm before the draw begins.</Text>
            <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm">
              <Paper withBorder radius="md" p="sm">
                <Text size="xs" c="dimmed">
                  Pack
                </Text>
                <Text fw={700}>{pack.title}</Text>
              </Paper>
              <Paper withBorder radius="md" p="sm">
                <Text size="xs" c="dimmed">
                  Quantity
                </Text>
                <Text fw={700}>
                  {pendingDrawQuantity} draw{pendingDrawQuantity > 1 ? "s" : ""}
                </Text>
              </Paper>
              <Paper withBorder radius="md" p="sm">
                <Text size="xs" c="dimmed">
                  Cost
                </Text>
                <Text fw={700}>{(pack.pricePoints * pendingDrawQuantity).toLocaleString()} pts</Text>
              </Paper>
            </SimpleGrid>
            <Text c="dimmed" size="sm">
              Once confirmed, the lottery animation and reveal sequence will begin.
            </Text>
            <Group justify="space-between">
              <Button variant="default" onClick={cancelDrawConfirmation}>
                Cancel
              </Button>
              <Button onClick={() => void confirmDraw()} loading={drawing}>
                Confirm Draw
              </Button>
            </Group>
          </Stack>
        ) : null}
      </Modal>

      <Modal opened={Boolean(imagePreview)} onClose={() => setImagePreview(null)} centered radius="lg" title={imagePreview?.label ?? "Card preview"}>
        {imagePreview ? <Image src={imagePreview.imageUrl} alt={imagePreview.label} radius="lg" fit="contain" /> : null}
      </Modal>
      <style jsx global>{`
        @keyframes pack-confetti {
          0% {
            opacity: 0;
            transform: translate3d(0, 0, 0) rotate(0deg) scale(0.8);
          }
          10% {
            opacity: 1;
          }
          100% {
            opacity: 0;
            transform: translate3d(var(--drift), 240px, 0) rotate(540deg) scale(1);
          }
        }
      `}</style>
      </Container>
    </VendorThemeProvider>
  );
}



