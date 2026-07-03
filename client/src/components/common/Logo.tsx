import React from 'react';

interface LogoProps extends React.SVGProps<SVGSVGElement> {
  size?: number;
}

export const Logo: React.FC<LogoProps> = ({ size = 24, className, ...props }) => {
  // Aspect ratio of the logo is ~2.64
  // We add some padding around the bounding box using viewBox to avoid clipping the round caps
  return (
    <svg
      viewBox="-10 -10 390 160"
      width={props.width ?? (size * 2.64)}
      height={props.height ?? size}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...props}
    >
      <line
        x1="15"
        y1="122"
        x2="109"
        y2="13"
        stroke="currentColor"
        strokeWidth="31"
        strokeLinecap="round"
      />
      <path
        d="M 91 127 L 171 35 C 187 8, 215 12, 215 37 L 216 110 C 216 127, 230 110, 235 102 C 293 45, 303 3, 335 22 L 353 124"
        stroke="currentColor"
        strokeWidth="31"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

export default Logo;
