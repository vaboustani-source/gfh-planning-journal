import { useEffect, useRef } from "react";

declare global {
  interface Window { PinUtils?: { build: () => void } }
}

const SCRIPT_SRC = "https://assets.pinterest.com/js/pinit.js";

/** Pinterest's own board widget. Only public boards render; secret boards show nothing. */
export default function PinterestBoardEmbed({ url }: { url: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.innerHTML = "";
    const a = document.createElement("a");
    a.href = url;
    a.dataset.pinDo = "embedBoard";
    a.dataset.pinBoardWidth = String(Math.max(280, el.clientWidth - 24)); // widget adds its own padding
    a.dataset.pinScaleHeight = "360";
    a.dataset.pinScaleWidth = "110";
    el.appendChild(a);

    if (window.PinUtils) {
      window.PinUtils.build();
      return;
    }
    if (!document.querySelector(`script[src="${SCRIPT_SRC}"]`)) {
      const s = document.createElement("script");
      s.src = SCRIPT_SRC;
      s.async = true;
      s.defer = true;
      document.body.appendChild(s);
    }
  }, [url]);

  return <div ref={ref} className="w-full overflow-hidden min-h-[120px]" />;
}
