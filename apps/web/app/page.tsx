export default function HomePage() {
  return (
    <main className="container">
      <div className="card">
        <span className="badge">Starter</span>
        <h1>Multi-tenant Oripa SaaS</h1>
        <p>
          This frontend is shared across vendors. Tenant-specific branding and data are loaded from API by host.
        </p>
        <p>
          Next step: wire auth, vendor onboarding, and pack management forms.
        </p>
      </div>
    </main>
  );
}
