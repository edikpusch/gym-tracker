import { ImageResponse } from "next/og";

export const dynamic = "force-static";

export const size = {
  width: 192,
  height: 192,
};

export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background:
            "linear-gradient(180deg, rgb(17, 17, 17), rgb(48, 48, 48))",
          color: "white",
          fontSize: 72,
          fontWeight: 700,
          letterSpacing: "-0.08em",
          borderRadius: 36,
        }}
      >
        GT
      </div>
    ),
    size
  );
}
