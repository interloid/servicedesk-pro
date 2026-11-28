// Full-colour channel logos for Settings -> Channels & Integrations, as
// inline SVG: no network request, crisp at any size, and the brand colours
// rather than a one-colour silhouette.

type LogoProps = { className?: string };

/** Gmail's four-colour "M". */
export function GmailLogo({ className }: LogoProps) {
  return (
    <svg
      viewBox="52 42 88 66"
      className={className}
      role="img"
      aria-label="Gmail"
    >
      <path fill="#4285F4" d="M58 108h14V74L52 59v43c0 3.32 2.69 6 6 6" />
      <path fill="#34A853" d="M120 108h14c3.32 0 6-2.69 6-6V59l-20 15" />
      <path fill="#FBBC04" d="M120 48v26l20-15v-8c0-7.42-8.47-11.65-14.4-7.2" />
      <path fill="#EA4335" d="M72 74V48l24 18 24-18v26L96 92" />
      <path
        fill="#C5221F"
        d="M52 51v8l20 15V48l-5.6-4.2c-5.94-4.45-14.4-.22-14.4 7.2"
      />
    </svg>
  );
}

/** Microsoft Teams: the two people and the "T" tile. */
export function TeamsLogo({ className }: LogoProps) {
  return (
    <svg
      viewBox="0 0 2228.833 2073.333"
      className={className}
      role="img"
      aria-label="Microsoft Teams"
    >
      <defs>
        <linearGradient
          id="teams-tile"
          x1="198.099"
          y1="1683.073"
          x2="942.234"
          y2="394.261"
          gradientTransform="matrix(1 0 0 -1 0 2075.333)"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#5A62C3" />
          <stop offset="0.5" stopColor="#4D55BD" />
          <stop offset="1" stopColor="#3940AB" />
        </linearGradient>
      </defs>
      <path
        fill="#5059C9"
        d="M1554.637 777.5h575.713c54.391 0 98.483 44.092 98.483 98.483v524.398c0 199.901-162.051 361.952-361.952 361.952h-1.711c-199.901.028-361.975-162-362.004-361.901V828.971c.001-28.427 23.045-51.471 51.471-51.471z"
      />
      <circle fill="#5059C9" cx="1943.75" cy="440.583" r="233.25" />
      <circle fill="#7B83EB" cx="1218.083" cy="336.917" r="336.917" />
      <path
        fill="#7B83EB"
        d="M1667.323 777.5H717.01c-53.743 1.33-96.257 45.931-95.01 99.676v598.105c-7.505 322.519 247.657 590.16 570.167 598.053 322.51-7.893 577.671-275.534 570.167-598.053V877.176c1.246-53.745-41.267-98.346-95.011-99.676z"
      />
      <path
        fill="url(#teams-tile)"
        d="M95.01 518.5h950.312c52.473 0 95.01 42.538 95.01 95.01v950.312c0 52.473-42.538 95.01-95.01 95.01H95.01c-52.473 0-95.01-42.538-95.01-95.01V613.51c0-52.472 42.538-95.01 95.01-95.01z"
      />
      <path
        fill="#FFFFFF"
        d="M820.211 880.193H630.241v517.297H509.211V880.193H320.123V779.844h500.088z"
      />
    </svg>
  );
}
