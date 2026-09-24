import { ImageResponse } from "next/og";
import { Emblem } from "@/components/emblem";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(<Emblem size={180} />, size);
}
