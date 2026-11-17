"use client";

/**
 * Global error boundary — catches errors in the ROOT LAYOUT itself.
 * This is the absolute last line of defense. If this renders, something went
 * very wrong (layout crash, DB connection failure, etc.).
 *
 * This must be a "use client" component and must render its own <html>/<body>
 * since the root layout may have failed to render.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <head>
        <title>Urvi Studios — Something went wrong</title>
        <style>{`
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #F7F0E4;
            color: #3F4827;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            text-align: center;
            padding: 20px;
          }
          .error-container { max-width: 480px; }
          .error-logo { font-size: 28px; font-weight: 600; letter-spacing: 2px; margin-bottom: 32px; color: #A98238; }
          h1 { font-size: 22px; margin-bottom: 12px; color: #3F4827; }
          p { font-size: 15px; color: #51462F; line-height: 1.6; margin-bottom: 24px; }
          .btn {
            display: inline-block; padding: 12px 32px; border: none; border-radius: 6px;
            font-size: 14px; font-weight: 600; cursor: pointer; text-decoration: none;
            background: #A98238; color: #F7F0E4; letter-spacing: 0.5px;
            transition: background 0.2s;
          }
          .btn:hover { background: #8B6A2E; }
          .btn-outline {
            background: transparent; border: 1.5px solid #3F4827; color: #3F4827;
            margin-left: 12px;
          }
          .btn-outline:hover { background: #3F4827; color: #F7F0E4; }
          .error-code { font-size: 12px; color: #999; margin-top: 24px; }
        `}</style>
      </head>
      <body>
        <div className="error-container">
          <div className="error-logo">URVI STUDIOS</div>
          <h1>We&apos;ll be right back</h1>
          <p>
            Something unexpected happened. Our team has been notified.
            Please try refreshing, or come back in a few minutes.
          </p>
          <button className="btn" onClick={() => reset()}>
            Try Again
          </button>
          <a href="/" className="btn btn-outline">
            Go Home
          </a>
          {error.digest && (
            <p className="error-code">Reference: {error.digest}</p>
          )}
        </div>
      </body>
    </html>
  );
}
