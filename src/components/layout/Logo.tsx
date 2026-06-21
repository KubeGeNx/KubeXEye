import React from 'react';

/**
 * Eye (observability) ringed by network nodes (the dependency graph this app is built around),
 * in Kubernetes' own brand blue. Rendered on the dark masthead, so the glyph itself is light —
 * dark navy reads as a hole in the background rather than a visible shape there.
 */
export const Logo: React.FC<{ size?: number }> = ({ size = 30 }) => (
  <svg width={size} height={size} viewBox="0 0 36 36" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <g stroke="#73bcf7" strokeWidth="1.1" opacity="0.9" fill="none">
      <polygon points="18,2 32,12 27,29 9,29 4,12" />
    </g>
    <g fill="#73bcf7">
      <circle cx="18" cy="2" r="1.8" />
      <circle cx="32" cy="12" r="1.8" />
      <circle cx="27" cy="29" r="1.8" />
      <circle cx="9" cy="29" r="1.8" />
      <circle cx="4" cy="12" r="1.8" />
    </g>
    <ellipse cx="18" cy="18" rx="9.5" ry="5.5" fill="#326CE5" stroke="#ffffff" strokeWidth="1.4" />
    <circle cx="18" cy="18" r="3" fill="#ffffff" />
    <circle cx="18" cy="18" r="1.3" fill="#326CE5" />
  </svg>
);
