type PackLoaderProps = {
  label?: string;
  fullScreen?: boolean;
};

export function PackLoader({ label = "Loading", fullScreen = false }: PackLoaderProps) {
  return (
    <div className={fullScreen ? "pack-loader-screen" : "pack-loader-inline"} role="status" aria-live="polite" aria-label={label}>
      <div className="pack-loader-card" aria-hidden="true">
        <div className="pack-loader-card-face">
          <span className="pack-loader-mark" />
        </div>
      </div>
      <span className="pack-loader-text">{label}</span>
    </div>
  );
}
