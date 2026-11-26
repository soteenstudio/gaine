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

import { ImageResponse } from "next/og";

export const ogSize = { width: 1200, height: 630 };
export const ogContentType = "image/png";

export interface OgCoverProps {
  brand: string;
  title: string;
  description: string;
  footerStart: string;
  footerEnd?: string;
}

export function renderOgCover({ brand, title, description, footerStart, footerEnd }: OgCoverProps) {
  return new ImageResponse(
    <div
      style={{
        height: "100%",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        backgroundColor: "#09090b",
        color: "#fafafa",
        padding: "72px 80px",
        fontFamily: "sans-serif",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "16px",
          fontSize: 28,
          fontWeight: 600,
          color: "#a1a1aa",
        }}
      >
        <div
          style={{
            width: 18,
            height: 18,
            borderRadius: 999,
            backgroundColor: "#fafafa",
          }}
        />
        <span>{brand}</span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
        <div
          style={{
            fontSize: 64,
            fontWeight: 700,
            lineHeight: 1.15,
            letterSpacing: "-0.03em",
            maxWidth: "960px",
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontSize: 26,
            color: "#a1a1aa",
            lineHeight: 1.4,
            maxWidth: "880px",
          }}
        >
          {description}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderTop: "1px solid #27272a",
          paddingTop: "28px",
          fontSize: 24,
          color: "#71717a",
        }}
      >
        <span>{footerStart}</span>
        <span>{footerEnd}</span>
      </div>
    </div>,
    { ...ogSize },
  );
}

export function renderOgFallback(brand: string) {
  return new ImageResponse(
    <div
      style={{
        height: "100%",
        width: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#09090b",
        color: "#fafafa",
        fontSize: 48,
        fontWeight: 700,
      }}
    >
      {brand}
    </div>,
    { ...ogSize },
  );
}
