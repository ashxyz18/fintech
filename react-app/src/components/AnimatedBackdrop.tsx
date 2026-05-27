/* Decorative animated backdrop layer. The body already has the radial
   gradient from style.css; this overlay adds two slow-drifting glow blobs
   so the page feels alive without affecting layout. Pointer-events:none
   so it never intercepts clicks. */

export function AnimatedBackdrop() {
  return (
    <div className="cv-backdrop" aria-hidden="true">
      <div className="cv-backdrop-blob cv-blob-red" />
      <div className="cv-backdrop-blob cv-blob-blue" />
    </div>
  );
}
