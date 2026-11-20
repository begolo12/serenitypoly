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
      color: { dark: "#16142B", light: "#FFFFFF" },
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
      className="overflow-hidden rounded-[20px] border-[3px] border-ink bg-white p-2.5"
      style={{ width: size + 24, height: size + 24 }}
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
