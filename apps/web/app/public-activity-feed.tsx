"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  filterPublicActivitiesByPackTitle,
  formatPublicActivityTimestamp,
  normalizePublicActivities,
  type PublicActivity,
} from "../lib/public-activity";

type PublicActivityFeedProps = {
  apiBase: string;
  title?: string;
  description?: string;
  emptyMessage?: string;
  packTitle?: string | null;
  limit?: number;
  className?: string;
};

type PublicActivityResponse = {
  activities?: unknown;
};

const refreshCooldownMs = 15_000;

export function PublicActivityFeed({
  apiBase,
  title = "Recent pulls",
  description = "Public pull activity only. Buyback and redemption activity are not available yet.",
  emptyMessage = "No public pulls yet.",
  packTitle,
  limit = 12,
  className,
}: PublicActivityFeedProps) {
  const [activities, setActivities] = useState<PublicActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldownRemainingMs, setCooldownRemainingMs] = useState(0);
  const cooldownDeadlineRef = useRef<number>(0);
  const boundedLimit = Math.min(Math.max(limit, 1), 50);

  const loadActivities = useCallback(async (manual = false) => {
    if (manual) {
      const remaining = cooldownDeadlineRef.current - Date.now();
      if (remaining > 0) {
        setCooldownRemainingMs(remaining);
        return;
      }
      setRefreshing(true);
      cooldownDeadlineRef.current = Date.now() + refreshCooldownMs;
      setCooldownRemainingMs(refreshCooldownMs);
    } else {
      setLoading(true);
    }

    setError(null);

    try {
      const response = await fetch(`${apiBase}/v1/activity/public?limit=${boundedLimit}`, {
        cache: "no-store",
      });
      const payload = (await response.json().catch(() => ({}))) as PublicActivityResponse & { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to load public activity.");
      }
      setActivities(normalizePublicActivities(payload.activities));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load public activity.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [apiBase, boundedLimit]);

  useEffect(() => {
    void loadActivities(false);
  }, [loadActivities]);

  useEffect(() => {
    if (cooldownRemainingMs <= 0) return;
    const timer = window.setInterval(() => {
      const remaining = Math.max(0, cooldownDeadlineRef.current - Date.now());
      setCooldownRemainingMs(remaining);
      if (remaining === 0) window.clearInterval(timer);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [cooldownRemainingMs]);

  const visibleActivities = useMemo(
    () => filterPublicActivitiesByPackTitle(activities, packTitle),
    [activities, packTitle],
  );
  const refreshDisabled = loading || refreshing || cooldownRemainingMs > 0;
  const refreshLabel = loading
    ? "Loading..."
    : refreshing
      ? "Refreshing..."
      : cooldownRemainingMs > 0
        ? `Refresh in ${Math.ceil(cooldownRemainingMs / 1000)}s`
        : "Refresh";

  return (
    <section className={`card public-activity-feed${className ? ` ${className}` : ""}`} aria-labelledby="public-activity-feed-title">
      <div className="heading-row public-activity-feed-header">
        <div>
          <span className="badge">Public activity</span>
          <h2 id="public-activity-feed-title" className="public-activity-feed-title">{title}</h2>
          <p className="muted public-activity-feed-copy">{description}</p>
        </div>
        <button type="button" className="refresh-button" onClick={() => void loadActivities(true)} disabled={refreshDisabled}>
          {refreshLabel}
        </button>
      </div>

      {error ? <p className="error" role="status">{error}</p> : null}
      {loading ? <p className="muted" role="status">Loading public activity...</p> : null}
      {!loading && !error && visibleActivities.length === 0 ? <p className="muted" role="status">{emptyMessage}</p> : null}

      {!loading && !error && visibleActivities.length > 0 ? (
        <div className="public-activity-list" role="list">
          {visibleActivities.map((activity, index) => {
            const timestampLabel = formatPublicActivityTimestamp(activity.timestamp);
            const itemKey = `${activity.packTitle}-${activity.prizeLabel}-${activity.timestamp}-${index}`;
            return (
              <article key={itemKey} className="public-activity-item" role="listitem">
                <div className="public-activity-summary">
                  <strong>{activity.prizeLabel}</strong>
                  <span className="muted tiny">{activity.packTitle}</span>
                </div>
                <div className="public-activity-meta">
                  {activity.valueBand ? <span className="badge public-activity-band">{activity.valueBand}</span> : null}
                  {activity.customerLabel ? <span className="muted tiny">{activity.customerLabel}</span> : null}
                  <time className="muted tiny" dateTime={activity.timestamp}>
                    {timestampLabel ?? "Time unavailable"}
                  </time>
                </div>
              </article>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
