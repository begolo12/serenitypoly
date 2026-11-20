"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

export function QrCode({ value, size = 220 }: { value: string; size?: number }) {
  const [svg, setSvg] = useState<string>("");

  useEffect(() => {
    let alive = true;
    QRCode.toString(value, {
      type: "svg",
      margin: 1,
      width: size,
      errorCorrectionLevel: "M",
      color: { dark: "#0A0A0A", light: "#FFFDF5" },
    })
      .then((out) => {
        if (alive) setSvg(out);
      })
      .catch(() => setSvg(""));
    return () => {
      alive = false;
    };
  }, [value, size]);

  return (
    <div
      className="border-[4px] border-ink bg-paper p-2 shadow-[6px_6px_0_#0A0A0A]"
      style={{ width: size + 20, height: size + 20 }}
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
