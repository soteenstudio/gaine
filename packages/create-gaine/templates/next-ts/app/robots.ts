import type { MetadataRoute } from "next";
import { createRobots } from "@gaine/nextjs/metadata";
import { baseUrl } from "@/site.config";

export default function robots(): MetadataRoute.Robots {
  return createRobots({ baseUrl });
}
