import { ImageResponse } from "next/og";
import { getCachedPlatformSettings } from "@/features/platform-admin/services/platform-settings.service";

export const alt = "Help desk software for growing support teams";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  const { platformName } = await getCachedPlatformSettings();

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: 96,
        background: "#0a0a0a",
        color: "white",
      }}
    >
      <div style={{ fontSize: 84, fontWeight: 700 }}>{platformName}</div>
      <div style={{ marginTop: 28, fontSize: 40, color: "#a3a3a3" }}>
        Help desk software for growing support teams
      </div>
    </div>,
    { ...size },
  );
}
