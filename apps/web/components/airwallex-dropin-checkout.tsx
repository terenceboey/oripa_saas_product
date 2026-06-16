"use client";

import { createElement, init } from "@airwallex/components-sdk";
import { useEffect, useRef, useState } from "react";
import { Alert, Box, Card, Group, Text, Title } from "@mantine/core";

const airwallexEnv = String(process.env.NEXT_PUBLIC_AIRWALLEX_ENV ?? "demo").toLowerCase() === "prod" ? "prod" : "demo";

let airwallexPaymentsPromise: Promise<Awaited<ReturnType<typeof init>>["payments"]> | null = null;

async function loadAirwallexPayments() {
  if (!airwallexPaymentsPromise) {
    airwallexPaymentsPromise = init({
      env: airwallexEnv,
      enabledElements: ["payments"],
    }).then((result) => result.payments);
  }

  const payments = await airwallexPaymentsPromise;
  if (!payments) {
    throw new Error("Airwallex payments SDK is not available");
  }
  return payments;
}

function getAirwallexErrorMessage(event: unknown) {
  if (!event || typeof event !== "object") return "Airwallex checkout failed.";
  const detail = "detail" in event ? (event as { detail?: unknown }).detail : undefined;
  if (detail && typeof detail === "object") {
    const maybeMessage = (detail as { error?: { message?: unknown }; message?: unknown }).error?.message ?? (detail as { message?: unknown }).message;
    if (typeof maybeMessage === "string" && maybeMessage.trim()) return maybeMessage;
  }
  return "Airwallex checkout failed.";
}

type AirwallexDropInCheckoutProps = {
  containerId: string;
  intentId: string;
  clientSecret: string;
  currencyCode: string;
  countryCode?: string | null;
  onReady?: () => void;
  onSuccess?: () => void;
  onError?: (message: string) => void;
};

export function AirwallexDropInCheckout({
  containerId,
  intentId,
  clientSecret,
  currencyCode,
  countryCode,
  onReady,
  onSuccess,
  onError,
}: AirwallexDropInCheckoutProps) {
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState<string | null>(null);
  const onReadyRef = useRef(onReady);
  const onSuccessRef = useRef(onSuccess);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onReadyRef.current = onReady;
  }, [onReady]);

  useEffect(() => {
    onSuccessRef.current = onSuccess;
  }, [onSuccess]);

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  useEffect(() => {
    let active = true;
    let element: Awaited<ReturnType<typeof createElement>> | null = null;

    setStatus("loading");
    setMessage("Loading secure checkout...");

    void (async () => {
      try {
        await loadAirwallexPayments();
        if (!active) return;

        element = await createElement("dropIn", {
          intent_id: intentId,
          client_secret: clientSecret,
          currency: currencyCode,
          country_code: countryCode ?? undefined,
        });

        element.mount(containerId);
        element.on("ready", () => {
          if (!active) return;
          setStatus("ready");
          setMessage(null);
          onReadyRef.current?.();
        });
        element.on("success", (event: unknown) => {
          if (!active) return;
          setStatus("ready");
          setMessage("Payment received. Waiting for wallet confirmation...");
          onSuccessRef.current?.();
        });
        element.on("error", (event: unknown) => {
          if (!active) return;
          const nextMessage = getAirwallexErrorMessage(event);
          setStatus("error");
          setMessage(nextMessage);
          onErrorRef.current?.(nextMessage);
        });
      } catch (error) {
        if (!active) return;
        const nextMessage = error instanceof Error ? error.message : "Failed to load Airwallex checkout.";
        setStatus("error");
        setMessage(nextMessage);
        onErrorRef.current?.(nextMessage);
      }
    })();

    return () => {
      active = false;
      try {
        element?.unmount();
      } catch {
        // Ignore unmount races during fast session swaps.
      }
    };
  }, [clientSecret, containerId, countryCode, currencyCode, intentId]);

  return (
    <Card withBorder radius="xl" p="lg" mt="md" shadow="sm">
      <Group justify="space-between" align="center" mb="sm">
        <Title order={3} size="h4">
          Complete payment
        </Title>
        <Text size="sm" c="dimmed">
          {status === "loading" ? "Loading..." : status === "ready" ? "Ready" : "Checkout error"}
        </Text>
      </Group>
      {message ? (
        <Alert color={status === "error" ? "red" : "blue"} variant="light">
          {message}
        </Alert>
      ) : null}
      <Box id={containerId} mt="md" mih={360} />
    </Card>
  );
}
