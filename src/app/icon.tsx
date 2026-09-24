import { ImageResponse } from "next/og";
import { Emblem } from "@/components/emblem";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(<Emblem size={64} />, size);
}
