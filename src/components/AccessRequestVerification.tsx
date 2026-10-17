import { useEffect, useRef, useState } from "react";

type Turnstile = {
  render: (container: HTMLElement, options: { sitekey: string; action: string; size: string; callback: (token: string) => void; "expired-callback": () => void; "error-callback": () => void }) => string;
  reset: (id: string) => void;
  remove: (id: string) => void;
};
const browser = window as Window & { turnstile?: Turnstile };
let loading: Promise<void> | undefined;
function loadTurnstile() {
  if (browser.turnstile) return Promise.resolve();
  if (!loading) loading = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    const fail = () => { script.remove(); loading = undefined; reject(new Error("Verification could not load.")); };
    const timeout = window.setTimeout(fail, 20_000);
    script.onload = () => { window.clearTimeout(timeout); if (browser.turnstile) resolve(); else fail(); };
    script.onerror = () => { window.clearTimeout(timeout); fail(); };
    document.head.append(script);
  });
  return loading;
}

export function AccessRequestVerification({ sitekey, resetKey, onToken }: { sitekey: string; resetKey: number; onToken: (token: string) => void }) {
  const container = useRef<HTMLDivElement>(null);
  const widget = useRef<string | undefined>(undefined);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let disposed = false;
    void loadTurnstile().then(() => {
      if (disposed || !container.current || !browser.turnstile) return;
      widget.current = browser.turnstile.render(container.current, {
        sitekey, action: "request_access", size: "flexible",
        callback: (token) => { setError(""); onToken(token); },
        "expired-callback": () => onToken(""),
        "error-callback": () => { onToken(""); setError("Verification failed. Please retry verification."); },
      });
    }).catch(() => { if (!disposed) setError("Verification could not load. Please retry verification."); });
    return () => { disposed = true; if (widget.current !== undefined) browser.turnstile?.remove(widget.current); widget.current = undefined; };
  }, [sitekey, onToken, retry]);
  useEffect(() => {
    if (widget.current !== undefined) { onToken(""); browser.turnstile?.reset(widget.current); }
  }, [resetKey, onToken]);
  return <div>
    <div ref={container} aria-label="Bot verification" />
    {error && <p role="alert">{error} <button type="button" onClick={() => { setError(""); onToken(""); setRetry((value) => value + 1); }}>Retry verification</button></p>}
  </div>;
}
