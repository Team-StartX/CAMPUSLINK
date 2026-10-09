// Original PlacedIn character: a student at a laptop with simple form reactions.
export function CharacterIllustration() {
  return (
    <svg
      className="auth-character-fallback"
      viewBox="0 0 600 470"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient
          id="auth-laptop"
          x1="185"
          y1="309"
          x2="422"
          y2="427"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#F6F7FF" />
          <stop offset="1" stopColor="#B7C2DD" />
        </linearGradient>
      </defs>
      <ellipse cx="310" cy="444" rx="214" ry="12" fill="#CDD5E7" opacity=".55" />
      <g opacity=".85">
        <rect x="88" y="115" width="73" height="48" rx="14" fill="#FDFEFF" stroke="#D8DFEF" />
        <path
          d="m112 132-8 7 8 7m24-14 8 7-8 7m-14-15-4 17"
          stroke="#91A3C5"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <rect x="455" y="153" width="70" height="93" rx="14" fill="#FDFEFF" stroke="#D8DFEF" />
        <path
          d="M470 175h39m-39 10h26m-26 32h34"
          stroke="#A7B5D5"
          strokeWidth="4"
          strokeLinecap="round"
        />
        <rect x="470" y="195" width="16" height="10" rx="4" fill="#CADFD4" />
      </g>
      <path d="M288 339h46v84" stroke="#9CAAC6" strokeWidth="9" strokeLinecap="round" />
      <path
        d="M311 423v19m-40 10 40-11 40 11"
        stroke="#9CAAC6"
        strokeWidth="8"
        strokeLinecap="round"
      />
      <g className="character-body">
        <path
          d="M258 271c-16 12-24 43-26 79h158c-3-36-10-66-26-79l-30-12h-47l-29 12Z"
          fill="#5266B5"
        />
        <path d="M289 236v29c5 19 35 20 43 0v-31" fill="#DDA27F" />
        <path d="m281 260 30 31-27 17-28-39 25-9Zm58 0-28 31 26 17 28-39-26-9Z" fill="#7489CF" />
        <path d="m305 289 6 10 9-10" fill="#A6B3E1" />
        <g className="character-head">
          <ellipse cx="260" cy="193" rx="12" ry="22" fill="#DDA27F" />
          <ellipse cx="360" cy="193" rx="12" ry="22" fill="#DDA27F" />
          <path
            d="M261 149c3-56 99-56 100 0l-4 58c-2 34-24 57-47 57-23 0-45-23-47-57l-2-58Z"
            fill="#EAB18A"
          />
          <path
            d="M262 192c-12-27-12-47-3-60-8-20 3-43 26-42 12-20 38-19 55-9 31-8 44 13 34 35-1 8-9 17-11 20 6 19 3 39-7 58l-2-35c-22 6-51-3-68-20-1 18-12 25-26 23l2 30Z"
            fill="#293548"
          />
          <path
            d="M274 171q10-7 19-1m34 0q10-7 19 1"
            stroke="#344354"
            strokeWidth="4"
            strokeLinecap="round"
          />
          <g className="character-eyes">
            <ellipse cx="284" cy="187" rx="8" ry="10" fill="#F8F8F4" />
            <ellipse cx="336" cy="187" rx="8" ry="10" fill="#F8F8F4" />
            <g className="character-pupils">
              <ellipse cx="284" cy="188" rx="4" ry="6" fill="#344354" />
              <ellipse cx="336" cy="188" rx="4" ry="6" fill="#344354" />
            </g>
          </g>
          <path d="m310 186-4 19h8" stroke="#C78F6A" strokeWidth="3" strokeLinecap="round" />
          <path
            className="character-smile"
            d="M296 220q14 13 29-1"
            stroke="#996850"
            strokeWidth="3.5"
            strokeLinecap="round"
          />
        </g>
        <g className="character-hand character-hand-left">
          <path d="m260 281-8 17 28 8" stroke="#5266B5" strokeWidth="23" strokeLinecap="round" />
          <path d="M276 302c9-4 20-2 26 2l7 7h-28c-7 0-10-5-5-9Z" fill="#EAB18A" />
          <path d="m288 303 4 6m3-6 4 6" stroke="#D49B76" strokeWidth="1.8" strokeLinecap="round" />
        </g>
        <g className="character-hand character-hand-right">
          <path d="m362 281 8 17-32 8" stroke="#5266B5" strokeWidth="23" strokeLinecap="round" />
          <path d="M342 302c-9-4-20-2-26 2l-7 7h28c7 0 10-5 5-9Z" fill="#EAB18A" />
          <path
            d="m330 303-4 6m-3-6-4 6"
            stroke="#D49B76"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </g>
        <g className="character-cover-hands">
          <path
            d="M259 280c-15-32-4-53 17-72m85 72c14-32 4-53-21-72"
            stroke="#5266B5"
            strokeWidth="24"
            strokeLinecap="round"
          />
          <g className="character-cover-left">
            <rect x="263" y="170" width="40" height="57" rx="16" fill="#EAB18A" />
            <path
              d="M274 178v29m9-30v30m9-27v26"
              stroke="#D49B76"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </g>
          <g className="character-cover-right">
            <rect x="317" y="170" width="40" height="57" rx="16" fill="#EAB18A" />
            <path
              d="M328 178v29m9-30v30m9-27v26"
              stroke="#D49B76"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </g>
        </g>
      </g>
      <path
        d="M191 316h238c9 0 14 6 12 15l-17 82H207l-29-80c-3-10 2-17 13-17Z"
        fill="url(#auth-laptop)"
        stroke="#ADB9D3"
        strokeWidth="2"
      />
      <rect x="293" y="352" width="36" height="27" rx="9" fill="#596CBC" />
      <path
        d="m302 364 7 6 12-13"
        stroke="#F5F7FF"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M180 413h265l13 8H168l12-8Z" fill="#AAB9D4" />
      <path d="M91 426h431" stroke="#94A5C9" strokeWidth="9" strokeLinecap="round" />
      <path d="M121 431v34m369-34v34" stroke="#B4BFD6" strokeWidth="7" strokeLinecap="round" />
      <rect x="137" y="379" width="30" height="40" rx="6" fill="#FCFDFF" stroke="#D4DCEC" />
      <path d="M167 387c18-2 18 19 0 18" stroke="#D4DCEC" strokeWidth="4" />
      <path d="M470 402v-53" stroke="#90B59E" strokeWidth="4" />
      <path
        d="M470 381c-25-1-35-19-37-32 28 1 38 15 37 32Zm0-18c-1-25 18-42 30-47 4 25-10 43-30 47Z"
        fill="#9CC3AA"
      />
      <path d="M451 400h39l-5 23h-29l-5-23Z" fill="#FAFDFF" stroke="#D4DCEC" />
      <g className="character-success">
        <circle cx="408" cy="203" r="23" fill="#DEEEE4" />
        <path
          d="m398 203 7 7 14-16"
          stroke="#598A75"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
      <g className="character-error">
        <circle cx="408" cy="203" r="23" fill="#F3DFDB" />
        <path d="M408 191v14m0 8v1" stroke="#AF766D" strokeWidth="4" strokeLinecap="round" />
      </g>
    </svg>
  );
}
