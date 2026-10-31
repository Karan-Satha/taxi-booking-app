export function TravelIllustration() {
  return (
    <svg
      className="hero-travel-art"
      viewBox="0 0 620 250"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient
          id="taxi-body-gradient"
          x1="20"
          y1="10"
          x2="145"
          y2="65"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#fff" />
          <stop offset=".52" stopColor="#dbeafe" />
          <stop offset="1" stopColor="#8b9dfb" />
        </linearGradient>
        <linearGradient
          id="city-glow"
          x1="310"
          y1="100"
          x2="310"
          y2="205"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#c4b5fd" />
          <stop offset="1" stopColor="#818cf8" />
        </linearGradient>
      </defs>
      <g className="hero-travel-art__cloud hero-travel-art__cloud--one" fill="#fff" opacity=".8">
        <path d="M72 49c0-8 7-14 15-14 3-11 19-15 27-6 9-2 17 5 17 14h4a9 9 0 0 1 0 18H82a10 10 0 0 1-10-12Z" />
      </g>
      <g className="hero-travel-art__cloud hero-travel-art__cloud--two" fill="#fff" opacity=".68">
        <path d="M430 61c0-6 5-11 11-11 3-9 16-12 22-5 7-2 14 4 14 11h3a7 7 0 0 1 0 14h-42a8 8 0 0 1-8-9Z" />
      </g>

      <g fill="url(#city-glow)" opacity=".58">
        <path d="M24 118h44v83H24zM75 96h35v105H75zM116 129h41v72h-41z" />
        <path d="M160 143h36v58h-36zM202 111h40v90h-40zM249 132h31v69h-31z" />
        <path d="M291 105h42v96h-42zM340 137h33v64h-33zM380 117h43v84h-43z" />
        <path d="M430 145h43v56h-43zM492 120h37v81h-37zM535 91h49v110h-49zM588 134h32v67h-32z" />
      </g>
      <g stroke="#fff" strokeWidth="3" opacity=".65">
        <path d="M37 133h7m12 0h7m-26 16h7m12 0h7m-26 16h7m12 0h7M87 113h7m12 0h2m-21 16h7m12 0h2m-21 16h7m12 0h2" />
        <path d="M172 155h6m12 0h2m-20 15h6m12 0h2m18-43h7m13 0h7m-27 16h7m13 0h7m-24 16h7m13 0h7" />
        <path d="M303 121h7m14 0h7m-28 16h7m14 0h7m-28 16h7m14 0h7m21-2h6m12 0h5m-23 15h6m12 0h5" />
        <path d="M442 158h7m14 0h7m-28 16h7m14 0h7m38-24h7m12 0h2m-21 16h7m12 0h2m17-43h7m12 0h8m-27 16h7m12 0h8m-27 16h7m12 0h8" />
      </g>

      <g className="hero-travel-art__landmarks" stroke="#6d28d9" strokeWidth="2.5" opacity=".62">
        <path d="M441 144a39 39 0 1 0 78 0 39 39 0 0 0-78 0Z" />
        <path d="M480 105v78m-39-39h78m-67-28 56 56m0-56-56 56" />
        <circle cx="480" cy="144" r="7" fill="#6d28d9" />
        <path
          d="M561 91h17v110h-17zM557 91h25l-4-9h-17l-4 9Zm7-9 5-17 5 17m-13 35h17m-17 20h17m-17 20h17"
          fill="#c4b5fd"
        />
      </g>
      <g className="hero-travel-art__plane" fill="#6d28d9" opacity=".82">
        <path d="m361 62 58-25c3-1 6 2 3 5l-48 32-19 2 6-14Z" />
        <path d="m385 52 8-17 5-2-1 18m-19 17 2 13 4 1 3-15" />
        <path d="m367 62-20-1-4 3 18 6" />
      </g>

      <path d="M18 198h584" stroke="#fff" strokeWidth="5" opacity=".78" />
      <path d="M18 202h584" stroke="#3b82f6" strokeWidth="2" opacity=".34" />
      <g fill="#312e81" opacity=".38">
        <path d="M29 187c0-11 9-20 20-20s20 9 20 20v11H29v-11Zm49 4c0-8 7-15 15-15s15 7 15 15v7H78v-7Zm393-4c0-11 9-20 20-20s20 9 20 20v11h-40v-11Zm49 4c0-8 7-15 15-15s15 7 15 15v7h-30v-7Z" />
      </g>

      <path
        d="M-8 211c91-53 169-42 234-15 75 31 132 25 202-10 70-35 124-39 204-7"
        stroke="#c4b5fd"
        strokeWidth="42"
        strokeLinecap="round"
        opacity=".36"
      />
      <path
        d="M-8 211c91-53 169-42 234-15 75 31 132 25 202-10 70-35 124-39 204-7"
        stroke="#fff"
        strokeWidth="2"
        strokeDasharray="9 12"
        strokeLinecap="round"
        opacity=".8"
      />

      <g className="hero-travel-art__pin hero-travel-art__pin--one" transform="translate(185 111)">
        <path d="M0 20S-17 2-17-8a17 17 0 1 1 34 0C17 2 0 20 0 20Z" fill="#6d28d9" />
        <circle cy="-8" r="5" fill="#fff" />
      </g>
      <g className="hero-travel-art__pin hero-travel-art__pin--two" transform="translate(459 109)">
        <path d="M0 18S-15 2-15-7a15 15 0 1 1 30 0C15 2 0 18 0 18Z" fill="#3b82f6" />
        <circle cy="-7" r="4.5" fill="#fff" />
      </g>

      <g className="hero-travel-art__taxi" transform="translate(255 142)">
        <ellipse cx="88" cy="68" rx="78" ry="8" fill="#312e81" opacity=".12" />
        <path
          d="m13 49 7-15c3-7 9-11 18-12l18-2 17-17c4-4 8-6 15-6h26c9 0 15 5 19 14l9 20 10 5c5 2 8 7 8 12v9H11v-4c0-2 0-3 2-4Z"
          fill="url(#taxi-body-gradient)"
        />
        <path d="m58 18 15-15h16v17H55l3-2Zm36-15h19c6 0 10 3 13 10l6 10H94V3Z" fill="#dbeafe" />
        <path d="M78 0h24l-2 5H80l-2-5Z" fill="#6d28d9" />
        <rect x="84" y="-6" width="12" height="6" rx="2" fill="#312e81" />
        <path d="M15 47h9v7h-9a4 4 0 0 1 0-7Zm141 0h8v7h-8v-7Z" fill="#ede9fe" />
        <path d="M22 57h138" stroke="#312e81" strokeWidth="3" opacity=".32" />
        <circle cx="48" cy="57" r="12" fill="#312e81" />
        <circle cx="48" cy="57" r="5" fill="#e0e7ff" />
        <circle cx="132" cy="57" r="12" fill="#312e81" />
        <circle cx="132" cy="57" r="5" fill="#e0e7ff" />
        <path d="M103 35h32" stroke="#312e81" strokeWidth="3" strokeLinecap="round" opacity=".45" />
      </g>
    </svg>
  );
}
