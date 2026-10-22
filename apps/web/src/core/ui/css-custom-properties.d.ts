import "react";

declare module "react" {
  interface CSSProperties {
    "--hue"?: string;
    "--stripe"?: string;
  }
}
