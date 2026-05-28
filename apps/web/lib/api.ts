const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export async function fetchVendorByHost(host: string) {
  const url = new URL("/v1/vendors/by-host", apiBase);
  url.searchParams.set("host", host);
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) return null;
  return response.json();
}
