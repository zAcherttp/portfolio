import { ImageResponse } from "next/og";
import { siteConfig } from "./site";

export const socialCardSize = { width: 1200, height: 630 };
export const socialCardContentType = "image/png";

type SocialCardInput = {
  title?: string;
  eyebrow: string;
  description: string;
  accent?: string;
};

function titleSize(title: string) {
  if (title.length > 54) return 58;
  if (title.length > 34) return 68;
  return 82;
}

export function createSocialCard({
  title = siteConfig.defaultTitle,
  eyebrow,
  description,
  accent = "#2563eb",
}: SocialCardInput) {
  return new ImageResponse(
    <div
      style={{
        alignItems: "stretch",
        background: "#f7f7f5",
        color: "#171717",
        display: "flex",
        fontFamily: "sans-serif",
        height: "100%",
        padding: 42,
        width: "100%",
      }}
    >
      <div
        style={{
          border: "1px solid #d9d9d4",
          display: "flex",
          flexDirection: "column",
          height: "100%",
          justifyContent: "space-between",
          padding: "52px 58px 46px",
          position: "relative",
          width: "100%",
        }}
      >
        <div
          style={{
            background: accent,
            height: 4,
            left: 58,
            position: "absolute",
            top: -2,
            width: 76,
          }}
        />

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              color: "#696966",
              fontSize: 20,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
            }}
          >
            {eyebrow}
          </div>
          <div
            style={{
              fontSize: titleSize(title),
              fontWeight: 700,
              letterSpacing: "-0.045em",
              lineHeight: 1.02,
              marginTop: 34,
              maxWidth: 950,
            }}
          >
            {title}
          </div>
          <div
            style={{
              color: "#595956",
              fontSize: 25,
              lineHeight: 1.4,
              marginTop: 28,
              maxWidth: 860,
            }}
          >
            {description}
          </div>
        </div>

        <div
          style={{
            alignItems: "center",
            borderTop: "1px solid #deded9",
            color: "#696966",
            display: "flex",
            fontSize: 20,
            justifyContent: "space-between",
            paddingTop: 25,
          }}
        >
          <span>{siteConfig.name}</span>
          <span>{siteConfig.role}</span>
        </div>
      </div>
    </div>,
    socialCardSize,
  );
}
