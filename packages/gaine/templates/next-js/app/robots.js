import { createRobots } from "@gaine/nextjs/metadata";
import { baseUrl } from "@/site.config";

export default function robots() {
  return createRobots({ baseUrl });
}
