import { ImageResponse } from "next/og";

import { AppIconArt } from "./app-icon";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(<AppIconArt size={size.width} />, size);
}
