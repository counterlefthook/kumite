import { ImageResponse } from "next/og";
import { Emblem } from "@/components/emblem";

// Manifest icons at /icons/192 and /icons/512.
const SIZES = [192, 512];

export function generateStaticParams() {
  return SIZES.map((size) => ({ size: String(size) }));
}

export async function GET(_request: Request, { params }: RouteContext<"/icons/[size]">) {
  const size = Number((await params).size);
  if (!SIZES.includes(size)) return new Response("Not found", { status: 404 });
  return new ImageResponse(<Emblem size={size} />, { width: size, height: size });
}
