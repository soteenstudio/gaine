/*
 * Copyright 2026 SoTeen Studio
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * Server-only UI entry. Nothing here imports a "use client" module, so a page that imports
 * from "@gaine/nextjs/ui" ships zero extra client JS (no Radix dropdown, no lucide icons).
 * Use the "@gaine/nextjs" barrel only when you need the interactive components.
 */
export { Logo, type LogoProps } from "./logo.js";
export { reveal, type RevealVariant } from "./reveal.js";
export { Button, buttonVariants, type ButtonProps } from "./ui/button.js";
export { Badge, badgeVariants, type BadgeProps } from "./ui/badge.js";
export { SectionHeading } from "./ui/section-heading.js";
