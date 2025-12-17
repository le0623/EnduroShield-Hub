import * as React from "react";
import type { SVGProps } from "react";
const Component = (props: SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 20 20" {...props}>
    <path
      fill="currentColor"
      d="M10 2C5.58 2 2 2.5 2 6v8c0 3.5 3.58 4 8 4s8-.5 8-4V6c0-3.5-3.58-4-8-4zm0 1.5c3.75 0 6.5.5 6.5 2.5s-2.75 2.5-6.5 2.5S3.5 7 3.5 5s2.75-2.5 6.5-2.5zm0 12c-3.75 0-6.5-.5-6.5-2.5V7.1c.85.6 3.25 1.15 6.5 1.15s5.65-.55 6.5-1.15v6.4c0 2-2.75 2.5-6.5 2.5z"
    />
  </svg>
);
export default Component;
