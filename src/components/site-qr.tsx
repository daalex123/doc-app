import QRCode from "qrcode";

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://doc-app-three-beryl.vercel.app";

/** QR code for the public site, rendered on the server as an inline SVG (no client JS). */
export async function SiteQr({ size = 160 }: { size?: number }) {
  const svg = await QRCode.toString(SITE_URL, {
    type: "svg",
    margin: 1,
    errorCorrectionLevel: "M",
    color: { dark: "#0c284f", light: "#ffffff" },
  });
  return (
    <div
      role="img"
      aria-label={`QR code that opens ${SITE_URL}`}
      style={{ width: size, height: size }}
      className="shrink-0 overflow-hidden rounded-xl border bg-white p-1.5 [&>svg]:size-full"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
