/**
 * A quiet, persistent banner fixed to the bottom of the viewport.
 * Visible on every page — storefront and admin — so anyone testing the site
 * knows it is not the finished product.
 */
export default function BetaBanner() {
  return (
    <div
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        background: "rgba(63, 72, 39, 0.88)",
        color: "rgba(247, 240, 228, 0.85)",
        textAlign: "center",
        fontSize: 11,
        fontFamily: "var(--font-body, Montserrat, sans-serif)",
        letterSpacing: "0.04em",
        padding: "5px 12px",
        pointerEvents: "none",
      }}
    >
      🚧 This site is in beta — some features are still being built. Prices and availability may change.
    </div>
  );
}
