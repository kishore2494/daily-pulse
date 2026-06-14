// ----------------------------------------------------------------------------
// Per-exercise SVG animations using SMIL <animateTransform>.
// Why SMIL: a rotate transform pivots at the local (0,0) of the element it's
// applied to. By wrapping each rotating joint inside a <g transform="translate(x,y)">,
// the rotation naturally pivots at (x,y) — exactly the joint position. No CSS
// transform-origin / fill-box pitfalls.
// ----------------------------------------------------------------------------

const VB = "0 0 240 220";
const GROUND_Y = 210;

const wrap = (cls, body) =>
  `<svg viewBox="${VB}" xmlns="http://www.w3.org/2000/svg" class="figure ex-${cls}">
    <line class="ground" x1="0" y1="${GROUND_Y}" x2="240" y2="${GROUND_Y}"/>
    ${body}
  </svg>`;

// SMIL rotate animation. `values` is a list like "0; -150; 0".
const rot = (values, dur = 2.4) =>
  `<animateTransform attributeName="transform" type="rotate" values="${values}" dur="${dur}s" repeatCount="indefinite" calcMode="spline" keyTimes="0;0.5;1" keySplines="0.42 0 0.58 1; 0.42 0 0.58 1"/>`;

// Translate animation
const trans = (values, dur = 2.4) =>
  `<animateTransform attributeName="transform" type="translate" values="${values}" dur="${dur}s" repeatCount="indefinite" calcMode="spline" keyTimes="0;0.5;1" keySplines="0.42 0 0.58 1; 0.42 0 0.58 1"/>`;

// Linear (e.g. spinning) rotate animation
const rotLin = (from = 0, to = 360, dur = 1) =>
  `<animateTransform attributeName="transform" type="rotate" from="${from}" to="${to}" dur="${dur}s" repeatCount="indefinite"/>`;

// Dumbbell horizontal, centered at origin
const dbAt = (w = 22) => `
  <line x1="-${w/2}" y1="0" x2="${w/2}" y2="0" class="db-bar"/>
  <rect class="db-w" x="-${w/2 + 2}" y="-6" width="4" height="12" rx="1"/>
  <rect class="db-w" x="${w/2 - 2}" y="-6" width="4" height="12" rx="1"/>
`;
// Dumbbell vertical
const dbVAt = (h = 22) => `
  <line x1="0" y1="-${h/2}" x2="0" y2="${h/2}" class="db-bar"/>
  <rect class="db-w" x="-6" y="-${h/2 + 2}" width="12" height="4" rx="1"/>
  <rect class="db-w" x="-6" y="${h/2 - 2}" width="12" height="4" rx="1"/>
`;

const barAt = (w = 80) => `
  <line x1="-${w/2}" y1="0" x2="${w/2}" y2="0" class="bar-line"/>
  <rect class="db-w" x="-${w/2 + 4}" y="-9" width="6" height="18" rx="1"/>
  <rect class="db-w" x="${w/2 - 2}" y="-9" width="6" height="18" rx="1"/>
`;

const bench = (cx, cy, w = 140, h = 10) => `
  <g class="bench">
    <rect x="${cx - w/2}" y="${cy}" width="${w}" height="${h}" rx="2"/>
    <line x1="${cx - w/2 + 10}" y1="${cy + h}" x2="${cx - w/2 + 10}" y2="${GROUND_Y}"/>
    <line x1="${cx + w/2 - 10}" y1="${cy + h}" x2="${cx + w/2 - 10}" y2="${GROUND_Y}"/>
  </g>`;

const machineColumn = (x, h = 200) => `
  <g class="machine">
    <rect x="${x - 4}" y="10" width="8" height="${h - 20}" rx="2"/>
    <rect x="${x - 10}" y="10" width="20" height="14" rx="2"/>
  </g>`;

// Standing person, joints fixed (no animation here). All limbs visible because
// shoulders/hips offset from torso center.
function person({ cx = 120, hipY = 140 } = {}) {
  return `
  <g class="person" transform="translate(${cx}, ${hipY})">
    <line class="torso-l" x1="-9" y1="0" x2="-14" y2="-52"/>
    <line class="torso-r" x1="9" y1="0" x2="14" y2="-52"/>
    <line class="torso-mid" x1="0" y1="0" x2="0" y2="-52"/>
    <line class="neck" x1="0" y1="-52" x2="0" y2="-62"/>
    <circle class="head" cx="0" cy="-75" r="13"/>
    <!-- LEFT arm hanging straight -->
    <g transform="translate(-14, -52)">
      <line class="upper-arm" x1="0" y1="0" x2="0" y2="30"/>
      <g transform="translate(0, 30)">
        <line class="forearm" x1="0" y1="0" x2="0" y2="26"/>
        <circle class="hand" cx="0" cy="29" r="4"/>
      </g>
    </g>
    <!-- RIGHT arm hanging straight -->
    <g transform="translate(14, -52)">
      <line class="upper-arm" x1="0" y1="0" x2="0" y2="30"/>
      <g transform="translate(0, 30)">
        <line class="forearm" x1="0" y1="0" x2="0" y2="26"/>
        <circle class="hand" cx="0" cy="29" r="4"/>
      </g>
    </g>
    <!-- LEFT leg -->
    <g transform="translate(-9, 0)">
      <line class="thigh" x1="0" y1="0" x2="0" y2="36"/>
      <g transform="translate(0, 36)">
        <line class="shin" x1="0" y1="0" x2="0" y2="34"/>
        <circle class="foot" cx="-2" cy="36" r="4"/>
      </g>
    </g>
    <!-- RIGHT leg -->
    <g transform="translate(9, 0)">
      <line class="thigh" x1="0" y1="0" x2="0" y2="36"/>
      <g transform="translate(0, 36)">
        <line class="shin" x1="0" y1="0" x2="0" y2="34"/>
        <circle class="foot" cx="2" cy="36" r="4"/>
      </g>
    </g>
  </g>`;
}

// "Headless" person (caller adds arms separately for animation)
function personNoArms({ cx = 120, hipY = 140 } = {}) {
  return `
  <g class="person" transform="translate(${cx}, ${hipY})">
    <line class="torso-l" x1="-9" y1="0" x2="-14" y2="-52"/>
    <line class="torso-r" x1="9" y1="0" x2="14" y2="-52"/>
    <line class="torso-mid" x1="0" y1="0" x2="0" y2="-52"/>
    <line class="neck" x1="0" y1="-52" x2="0" y2="-62"/>
    <circle class="head" cx="0" cy="-75" r="13"/>
    <g transform="translate(-9, 0)">
      <line class="thigh" x1="0" y1="0" x2="0" y2="36"/>
      <g transform="translate(0, 36)">
        <line class="shin" x1="0" y1="0" x2="0" y2="34"/>
        <circle class="foot" cx="-2" cy="36" r="4"/>
      </g>
    </g>
    <g transform="translate(9, 0)">
      <line class="thigh" x1="0" y1="0" x2="0" y2="36"/>
      <g transform="translate(0, 36)">
        <line class="shin" x1="0" y1="0" x2="0" y2="34"/>
        <circle class="foot" cx="2" cy="36" r="4"/>
      </g>
    </g>
  </g>`;
}

// A jointed arm hanging from (px, py).
// shoulderRotValues / elbowRotValues: SMIL "v1;v2;v3" rotation animations.
// If null, no animation (static at 0 rotation).
function jointedArm(px, py, shoulderRot = null, elbowRot = null, handContent = "") {
  return `
  <g transform="translate(${px}, ${py})">
    <g>${shoulderRot ? rot(shoulderRot) : ""}
      <line class="upper-arm" x1="0" y1="0" x2="0" y2="30"/>
      <g transform="translate(0, 30)">
        <g>${elbowRot ? rot(elbowRot) : ""}
          <line class="forearm" x1="0" y1="0" x2="0" y2="26"/>
          <g transform="translate(0, 30)">${handContent}</g>
        </g>
      </g>
    </g>
  </g>`;
}

const ANIMS = {};

// =========================================================================
// CHEST
// =========================================================================

// PUSH UP — body bobs down
ANIMS.pushup = () => wrap("pushup", `
  <g>
    ${trans("0 0; 0 22; 0 0")}
    <circle class="head" cx="30" cy="120" r="13"/>
    <line class="torso-l" x1="43" y1="122" x2="180" y2="128"/>
    <line class="torso-r" x1="43" y1="128" x2="180" y2="134"/>
    <line class="thigh" x1="180" y1="128" x2="215" y2="132"/>
    <line class="shin" x1="215" y1="132" x2="222" y2="156"/>
    <circle class="foot" cx="222" cy="158" r="4"/>
    <line class="upper-arm" x1="70" y1="122" x2="70" y2="172"/>
    <circle class="hand" cx="70" cy="174" r="4"/>
    <line class="upper-arm" x1="110" y1="124" x2="110" y2="172"/>
    <circle class="hand" cx="110" cy="174" r="4"/>
  </g>
  <path class="motion-arrow" d="M 12 130 L 12 165 M 8 160 L 12 168 L 16 160" />
`);

// MACHINE CHEST PRESS — seated, arm pushes forward
ANIMS.press = () => wrap("press", `
  <!-- seat back -->
  <g class="machine">
    <rect x="58" y="80" width="10" height="80" rx="2"/>
    <rect x="38" y="156" width="60" height="44" rx="2"/>
  </g>
  <!-- handle bar far right -->
  <g class="machine">
    <rect x="210" y="60" width="14" height="80" rx="2"/>
  </g>
  <!-- seated person side view, head looking right -->
  <circle class="head" cx="80" cy="68" r="13"/>
  <line class="torso-l" x1="80" y1="81" x2="83" y2="156"/>
  <line class="torso-r" x1="76" y1="81" x2="79" y2="156"/>
  <line class="thigh" x1="83" y1="156" x2="140" y2="156"/>
  <line class="shin" x1="140" y1="156" x2="140" y2="${GROUND_Y}"/>
  <circle class="foot" cx="143" cy="${GROUND_Y - 2}" r="4"/>
  <!-- pressing arm pumping in/out -->
  <g transform="translate(80, 90)">
    <g>${trans("-30 0; 0 0; -30 0", 2.4)}
      <line class="upper-arm" x1="0" y1="0" x2="60" y2="0"/>
      <line class="forearm" x1="60" y1="0" x2="120" y2="0"/>
      <circle class="hand" cx="122" cy="0" r="4"/>
    </g>
  </g>
  <path class="motion-arrow" d="M 165 50 L 200 50 M 195 46 L 203 50 L 195 54" />
`);

// INCLINE PRESS — inclined bench
ANIMS.incline = () => wrap("incline", `
  <g class="bench">
    <rect x="30" y="60" width="22" height="130" rx="2" transform="rotate(15 41 125)"/>
  </g>
  <line class="machine" x1="30" y1="50" x2="30" y2="110" />
  <!-- reclined person, body tilted -->
  <g transform="translate(0, 0)">
    <circle class="head" cx="75" cy="80" r="13"/>
    <line class="torso-l" x1="85" y1="88" x2="155" y2="125"/>
    <line class="torso-r" x1="78" y1="93" x2="148" y2="130"/>
    <line class="thigh" x1="155" y1="125" x2="195" y2="160"/>
    <line class="shin" x1="195" y1="160" x2="200" y2="200"/>
    <circle class="foot" cx="202" cy="202" r="4"/>
  </g>
  <!-- both arms with dumbbells pump up -->
  <g transform="translate(108, 100)">
    <g>${trans("0 0; 0 -45; 0 0", 2.4)}
      <line class="upper-arm" x1="0" y1="0" x2="0" y2="-40"/>
      <g transform="translate(0, -40)">
        <line class="forearm" x1="0" y1="0" x2="0" y2="-25"/>
        <g transform="translate(0, -32)">${dbAt(26)}</g>
      </g>
    </g>
  </g>
  <g transform="translate(125, 110)">
    <g>${trans("0 0; 0 -45; 0 0", 2.4)}
      <line class="upper-arm" x1="0" y1="0" x2="0" y2="-40"/>
      <g transform="translate(0, -40)">
        <line class="forearm" x1="0" y1="0" x2="0" y2="-25"/>
        <g transform="translate(0, -32)">${dbAt(26)}</g>
      </g>
    </g>
  </g>
`);

// PEC FLY MACHINE — seated, arms swing inward
ANIMS.fly = () => wrap("fly", `
  <rect class="bench" x="100" y="155" width="40" height="45"/>
  <line class="machine" x1="100" y1="40" x2="100" y2="155"/>
  <line class="machine" x1="140" y1="40" x2="140" y2="155"/>
  <circle class="head" cx="120" cy="68" r="13"/>
  <line class="torso-l" x1="111" y1="80" x2="111" y2="155"/>
  <line class="torso-r" x1="129" y1="80" x2="129" y2="155"/>
  <!-- left arm with rotation pivot at left shoulder (111, 90) -->
  <g transform="translate(111, 90)">
    <g>${rot("0; 60; 0", 2.6)}
      <line class="upper-arm" x1="0" y1="0" x2="-50" y2="0"/>
      <line class="forearm" x1="-50" y1="0" x2="-72" y2="-15"/>
      <circle class="hand" cx="-74" cy="-16" r="4"/>
    </g>
  </g>
  <g transform="translate(129, 90)">
    <g>${rot("0; -60; 0", 2.6)}
      <line class="upper-arm" x1="0" y1="0" x2="50" y2="0"/>
      <line class="forearm" x1="50" y1="0" x2="72" y2="-15"/>
      <circle class="hand" cx="74" cy="-16" r="4"/>
    </g>
  </g>
`);

// PULLOVER — lying on bench, arm arcs from overhead to over chest
ANIMS.pullover = () => wrap("pullover", `
  ${bench(120, 130, 160)}
  <!-- lying person, head left -->
  <circle class="head" cx="50" cy="120" r="13"/>
  <line class="torso-l" x1="63" y1="122" x2="160" y2="122"/>
  <line class="torso-r" x1="63" y1="127" x2="160" y2="127"/>
  <line class="thigh" x1="160" y1="122" x2="200" y2="125"/>
  <line class="shin" x1="200" y1="125" x2="205" y2="180"/>
  <circle class="foot" cx="208" cy="182" r="4"/>
  <!-- pullover arm from shoulder (75, 122) sweeps in arc -->
  <g transform="translate(75, 122)">
    <g>${rot("90; 180; 90", 2.8)}
      <line class="upper-arm" x1="0" y1="0" x2="50" y2="0"/>
      <line class="forearm" x1="50" y1="0" x2="76" y2="0"/>
      <g transform="translate(82, 0)">${dbVAt(26)}</g>
    </g>
  </g>
`);

// =========================================================================
// TRICEPS
// =========================================================================

// CABLE PUSH DOWN — standing, forearm extends down
ANIMS.pushdown = () => wrap("pushdown", `
  ${machineColumn(210)}
  <line class="cable" x1="210" y1="24" x2="135" y2="85"/>
  ${person()}
  <!-- working forearm overlay, upper arm fixed pointing down -->
  <g transform="translate(134, 88)">
    <line class="upper-arm" x1="0" y1="0" x2="0" y2="30"/>
    <g transform="translate(0, 30)">
      <g>${rot("0; -80; 0", 2.0)}
        <line class="forearm" x1="0" y1="0" x2="0" y2="32"/>
        <line class="bar-line" x1="-14" y1="34" x2="14" y2="34"/>
      </g>
    </g>
  </g>
  <path class="motion-arrow" d="M 175 95 L 175 130 M 171 125 L 175 133 L 179 125"/>
`);

// OVERHEAD EXTENSION — both arms holding one DB behind head
ANIMS.ext = () => wrap("ext", `
  ${person()}
  <!-- both arms pointing up; forearms rotate from down-behind-head to up -->
  <g transform="translate(106, 88)">
    <line class="upper-arm" x1="0" y1="0" x2="0" y2="-34"/>
    <g transform="translate(0, -34)">
      <g>${rot("150; 0; 150", 2.4)}
        <line class="forearm" x1="0" y1="0" x2="0" y2="-28"/>
      </g>
    </g>
  </g>
  <g transform="translate(134, 88)">
    <line class="upper-arm" x1="0" y1="0" x2="0" y2="-34"/>
    <g transform="translate(0, -34)">
      <g>${rot("150; 0; 150", 2.4)}
        <line class="forearm" x1="0" y1="0" x2="0" y2="-28"/>
      </g>
    </g>
  </g>
  <!-- shared dumbbell synced with forearms -->
  <g transform="translate(120, 22)">
    <g>${trans("0 38; 0 0; 0 38", 2.4)}
      ${dbVAt(30)}
    </g>
  </g>
`);

// SKULL CRUSHER — lying, forearm goes from up to behind head
ANIMS.skull = () => wrap("skull", `
  ${bench(120, 130, 160)}
  <!-- lying person -->
  <circle class="head" cx="50" cy="120" r="13"/>
  <line class="torso-l" x1="63" y1="122" x2="160" y2="122"/>
  <line class="torso-r" x1="63" y1="127" x2="160" y2="127"/>
  <line class="thigh" x1="160" y1="122" x2="200" y2="125"/>
  <line class="shin" x1="200" y1="125" x2="205" y2="180"/>
  <!-- upper arms vertical at shoulders 70 and 90, forearms rotate -->
  <g transform="translate(70, 120)">
    <line class="upper-arm" x1="0" y1="0" x2="0" y2="-44"/>
    <g transform="translate(0, -44)">
      <g>${rot("0; 110; 0", 2.4)}
        <line class="forearm" x1="0" y1="0" x2="0" y2="-30"/>
      </g>
    </g>
  </g>
  <g transform="translate(90, 120)">
    <line class="upper-arm" x1="0" y1="0" x2="0" y2="-44"/>
    <g transform="translate(0, -44)">
      <g>${rot("0; 110; 0", 2.4)}
        <line class="forearm" x1="0" y1="0" x2="0" y2="-30"/>
      </g>
    </g>
  </g>
`);

// TRICEP DIPS — body sinks between bench and floor
ANIMS.dip = () => wrap("dip", `
  ${bench(50, 110, 80, 12)}
  <g>
    ${trans("0 0; 0 22; 0 0", 2.4)}
    <circle class="head" cx="105" cy="60" r="13"/>
    <line class="torso-l" x1="105" y1="73" x2="105" y2="130"/>
    <line class="torso-r" x1="110" y1="73" x2="110" y2="130"/>
    <line class="thigh" x1="108" y1="128" x2="170" y2="135"/>
    <line class="shin" x1="170" y1="135" x2="185" y2="190"/>
    <circle class="foot" cx="187" cy="192" r="4"/>
    <line class="upper-arm" x1="105" y1="82" x2="68" y2="116"/>
    <line class="forearm" x1="68" y1="116" x2="68" y2="125"/>
    <circle class="hand" cx="68" cy="125" r="4"/>
  </g>
`);

// =========================================================================
// SHOULDER
// =========================================================================

// SHOULDER PRESS — both forearms rotate up
ANIMS.shpress = () => wrap("shpress", `
  ${person()}
  <g transform="translate(106, 88)">
    <line class="upper-arm" x1="0" y1="0" x2="0" y2="-30"/>
    <g transform="translate(0, -30)">
      <g>${rot("0; 180; 0", 2.6)}
        <line class="forearm" x1="0" y1="0" x2="0" y2="26"/>
        <g transform="translate(0, 32)">${dbAt(26)}</g>
      </g>
    </g>
  </g>
  <g transform="translate(134, 88)">
    <line class="upper-arm" x1="0" y1="0" x2="0" y2="-30"/>
    <g transform="translate(0, -30)">
      <g>${rot("0; 180; 0", 2.6)}
        <line class="forearm" x1="0" y1="0" x2="0" y2="26"/>
        <g transform="translate(0, 32)">${dbAt(26)}</g>
      </g>
    </g>
  </g>
`);

// LATERAL RAISE — arms swing out to sides
ANIMS.lateral = () => wrap("lateral", `
  ${personNoArms()}
  <!-- arms hang and swing out -->
  <g transform="translate(106, 88)">
    <g>${rot("0; 95; 0", 2.4)}
      <line class="upper-arm" x1="0" y1="0" x2="0" y2="30"/>
      <line class="forearm" x1="0" y1="30" x2="0" y2="56"/>
      <g transform="translate(0, 60)">${dbAt(24)}</g>
    </g>
  </g>
  <g transform="translate(134, 88)">
    <g>${rot("0; -95; 0", 2.4)}
      <line class="upper-arm" x1="0" y1="0" x2="0" y2="30"/>
      <line class="forearm" x1="0" y1="30" x2="0" y2="56"/>
      <g transform="translate(0, 60)">${dbAt(24)}</g>
    </g>
  </g>
`);

// REAR FLY — bent over, arm swings back/up
ANIMS.rearfly = () => wrap("rearfly", `
  <circle class="head" cx="80" cy="90" r="13"/>
  <line class="torso-l" x1="92" y1="96" x2="160" y2="118"/>
  <line class="torso-r" x1="87" y1="100" x2="155" y2="122"/>
  <line class="thigh" x1="158" y1="120" x2="155" y2="165"/>
  <line class="shin" x1="155" y1="165" x2="155" y2="${GROUND_Y}"/>
  <circle class="foot" cx="158" cy="${GROUND_Y - 2}" r="4"/>
  <!-- arm hanging from shoulder (105, 102), rotates back/up -->
  <g transform="translate(105, 102)">
    <g>${rot("0; -100; 0", 2.4)}
      <line class="upper-arm" x1="0" y1="0" x2="0" y2="50"/>
      <line class="forearm" x1="0" y1="50" x2="0" y2="62"/>
      <g transform="translate(0, 68)">${dbAt(24)}</g>
    </g>
  </g>
`);

// SHRUG — whole figure shrugs up
ANIMS.shrug = () => wrap("shrug", `
  <g>
    ${trans("0 0; 0 -14; 0 0", 1.6)}
    ${person()}
    <g transform="translate(106, 88)">
      <line class="upper-arm" x1="0" y1="0" x2="0" y2="56"/>
      <g transform="translate(0, 60)">${dbAt(26)}</g>
    </g>
    <g transform="translate(134, 88)">
      <line class="upper-arm" x1="0" y1="0" x2="0" y2="56"/>
      <g transform="translate(0, 60)">${dbAt(26)}</g>
    </g>
  </g>
  <path class="motion-arrow" d="M 55 110 L 55 80 M 51 85 L 55 77 L 59 85"/>
`);

// =========================================================================
// BICEPS
// =========================================================================

// CABLE BICEPS CURL — both forearms curl up
ANIMS.curl = () => wrap("curl", `
  ${machineColumn(20)}
  <line class="cable" x1="20" y1="180" x2="106" y2="148"/>
  <line class="cable" x1="20" y1="180" x2="134" y2="148"/>
  ${personNoArms()}
  <!-- arms with forearm rotation pivot at elbow -->
  <g transform="translate(106, 88)">
    <line class="upper-arm" x1="0" y1="0" x2="0" y2="30"/>
    <g transform="translate(0, 30)">
      <g>${rot("0; -150; 0", 2.4)}
        <line class="forearm" x1="0" y1="0" x2="0" y2="26"/>
        <g transform="translate(0, 30)">${dbAt(22)}</g>
      </g>
    </g>
  </g>
  <g transform="translate(134, 88)">
    <line class="upper-arm" x1="0" y1="0" x2="0" y2="30"/>
    <g transform="translate(0, 30)">
      <g>${rot("0; -150; 0", 2.4)}
        <line class="forearm" x1="0" y1="0" x2="0" y2="26"/>
        <g transform="translate(0, 30)">${dbAt(22)}</g>
      </g>
    </g>
  </g>
`);

// ALTERNATE CURL
ANIMS.altcurl = () => wrap("altcurl", `
  ${personNoArms()}
  <g transform="translate(106, 88)">
    <line class="upper-arm" x1="0" y1="0" x2="0" y2="30"/>
    <g transform="translate(0, 30)">
      <g><animateTransform attributeName="transform" type="rotate" values="0;-150;0;0;0" keyTimes="0;0.25;0.5;0.75;1" dur="2.8s" repeatCount="indefinite"/>
        <line class="forearm" x1="0" y1="0" x2="0" y2="26"/>
        <g transform="translate(0, 30)">${dbAt(22)}</g>
      </g>
    </g>
  </g>
  <g transform="translate(134, 88)">
    <line class="upper-arm" x1="0" y1="0" x2="0" y2="30"/>
    <g transform="translate(0, 30)">
      <g><animateTransform attributeName="transform" type="rotate" values="0;0;0;-150;0" keyTimes="0;0.25;0.5;0.75;1" dur="2.8s" repeatCount="indefinite"/>
        <line class="forearm" x1="0" y1="0" x2="0" y2="26"/>
        <g transform="translate(0, 30)">${dbAt(22)}</g>
      </g>
    </g>
  </g>
`);

// HAMMER CURL — neutral grip dumbbell
ANIMS.hammer = () => wrap("hammer", `
  ${personNoArms()}
  <g transform="translate(106, 88)">
    <line class="upper-arm" x1="0" y1="0" x2="0" y2="30"/>
    <g transform="translate(0, 30)">
      <g>${rot("0; -150; 0", 2.4)}
        <line class="forearm" x1="0" y1="0" x2="0" y2="26"/>
        <g transform="translate(0, 38)">${dbVAt(22)}</g>
      </g>
    </g>
  </g>
  <g transform="translate(134, 88)">
    <line class="upper-arm" x1="0" y1="0" x2="0" y2="30"/>
    <g transform="translate(0, 30)">
      <g>${rot("0; -150; 0", 2.4)}
        <line class="forearm" x1="0" y1="0" x2="0" y2="26"/>
        <g transform="translate(0, 38)">${dbVAt(22)}</g>
      </g>
    </g>
  </g>
`);

// CONCENTRATION CURL — seated, elbow on inner thigh, forearm curls
ANIMS.concurl = () => wrap("concurl", `
  ${bench(150, 130, 80)}
  <circle class="head" cx="118" cy="60" r="13"/>
  <line class="torso-l" x1="118" y1="73" x2="138" y2="125"/>
  <line class="torso-r" x1="113" y1="73" x2="133" y2="125"/>
  <line class="thigh" x1="135" y1="125" x2="180" y2="125"/>
  <line class="shin" x1="180" y1="125" x2="185" y2="${GROUND_Y - 5}"/>
  <circle class="foot" cx="188" cy="${GROUND_Y - 4}" r="4"/>
  <line class="upper-arm" x1="125" y1="80" x2="158" y2="118"/>
  <!-- working: elbow on thigh at (160, 125), forearm rotates -->
  <g transform="translate(160, 125)">
    <g>${rot("180; 70; 180", 2.4)}
      <line class="forearm" x1="0" y1="0" x2="0" y2="-50"/>
      <g transform="translate(0, -58)">${dbAt(24)}</g>
    </g>
  </g>
`);

// =========================================================================
// BACK
// =========================================================================

// LAT PULL DOWN — bar pulled from above to chest
ANIMS.latpull = () => wrap("latpull", `
  ${machineColumn(30)}
  <line class="cable" x1="30" y1="24" x2="120" y2="55"/>
  ${bench(155, 165, 60)}
  <circle class="head" cx="120" cy="90" r="13"/>
  <line class="torso-l" x1="111" y1="103" x2="111" y2="160"/>
  <line class="torso-r" x1="129" y1="103" x2="129" y2="160"/>
  <line class="thigh" x1="120" y1="160" x2="170" y2="160"/>
  <line class="shin" x1="170" y1="160" x2="170" y2="${GROUND_Y}"/>
  <!-- arms+bar group pulls down together -->
  <g>
    ${trans("0 -45; 0 0; 0 -45", 2.6)}
    <line class="bar-line" x1="75" y1="100" x2="165" y2="100"/>
    <line class="upper-arm" x1="111" y1="100" x2="85" y2="100"/>
    <line class="forearm" x1="85" y1="100" x2="85" y2="120"/>
    <line class="upper-arm" x1="129" y1="100" x2="155" y2="100"/>
    <line class="forearm" x1="155" y1="100" x2="155" y2="120"/>
  </g>
`);

ANIMS.backpull = ANIMS.latpull;

// SEATED ROW — pull cable handle toward belly
ANIMS.row = () => wrap("row", `
  ${machineColumn(15, 200)}
  ${bench(170, 168, 70)}
  <circle class="head" cx="170" cy="90" r="13"/>
  <line class="torso-l" x1="170" y1="103" x2="165" y2="158"/>
  <line class="torso-r" x1="175" y1="103" x2="170" y2="158"/>
  <line class="thigh" x1="165" y1="158" x2="115" y2="160"/>
  <line class="shin" x1="115" y1="160" x2="115" y2="${GROUND_Y}"/>
  <!-- pulling arm+cable group -->
  <g>
    ${trans("-55 0; 0 0; -55 0", 2.4)}
    <line class="cable" x1="15" y1="120" x2="115" y2="135"/>
    <line class="upper-arm" x1="165" y1="100" x2="125" y2="125"/>
    <line class="forearm" x1="125" y1="125" x2="115" y2="135"/>
    <rect class="db-w" x="111" y="130" width="6" height="12"/>
  </g>
`);

// DB ROW — bent over, arm rows DB up
ANIMS.dbrow = () => wrap("dbrow", `
  ${bench(55, 145, 80, 10)}
  <circle class="head" cx="85" cy="85" r="13"/>
  <line class="torso-l" x1="97" y1="89" x2="185" y2="115"/>
  <line class="torso-r" x1="92" y1="93" x2="180" y2="119"/>
  <!-- supporting arm/knee on bench -->
  <line class="upper-arm" x1="96" y1="95" x2="65" y2="142"/>
  <line class="thigh" x1="180" y1="117" x2="55" y2="142"/>
  <line class="thigh" x1="183" y1="115" x2="183" y2="170"/>
  <line class="shin" x1="183" y1="170" x2="185" y2="${GROUND_Y}"/>
  <!-- rowing arm pulls dumbbell up -->
  <g transform="translate(120, 100)">
    <g>${rot("0; 135; 0", 2.4)}
      <line class="upper-arm" x1="0" y1="0" x2="0" y2="48"/>
      <g transform="translate(0, 54)">${dbAt(26)}</g>
    </g>
  </g>
`);

// =========================================================================
// LEGS
// =========================================================================

// FREE SQUATS — body sinks, knees bend
ANIMS.squat = () => wrap("squat", `
  <g>${trans("0 0; 0 34; 0 0", 2.6)}
    <circle class="head" cx="120" cy="60" r="13"/>
    <line class="torso-l" x1="111" y1="73" x2="111" y2="130"/>
    <line class="torso-r" x1="129" y1="73" x2="129" y2="130"/>
    <line class="upper-arm" x1="111" y1="90" x2="170" y2="110"/>
    <line class="forearm" x1="170" y1="110" x2="195" y2="105"/>
    <line class="upper-arm" x1="129" y1="90" x2="188" y2="110"/>
    <line class="forearm" x1="188" y1="110" x2="213" y2="105"/>
  </g>
  <!-- legs: hips translate down with body, but knees bend out then back -->
  <g transform="translate(111, 130)">
    <g>${trans("0 0; 0 34; 0 0", 2.6)}
      <g>${rot("0; 70; 0", 2.6)}
        <line class="thigh" x1="0" y1="0" x2="0" y2="36"/>
        <g transform="translate(0, 36)">
          <g>${rot("0; -70; 0", 2.6)}
            <line class="shin" x1="0" y1="0" x2="0" y2="36"/>
            <circle class="foot" cx="-3" cy="38" r="4"/>
          </g>
        </g>
      </g>
    </g>
  </g>
  <g transform="translate(129, 130)">
    <g>${trans("0 0; 0 34; 0 0", 2.6)}
      <g>${rot("0; 70; 0", 2.6)}
        <line class="thigh" x1="0" y1="0" x2="0" y2="36"/>
        <g transform="translate(0, 36)">
          <g>${rot("0; -70; 0", 2.6)}
            <line class="shin" x1="0" y1="0" x2="0" y2="36"/>
            <circle class="foot" cx="3" cy="38" r="4"/>
          </g>
        </g>
      </g>
    </g>
  </g>
`);

// LEG PRESS — recumbent, legs extend toward platform
ANIMS.legpress = () => wrap("legpress", `
  <g class="machine">
    <rect x="30" y="100" width="80" height="14" rx="2" transform="rotate(-25 70 107)"/>
    <rect x="200" y="40" width="10" height="120"/>
  </g>
  <circle class="head" cx="45" cy="105" r="13"/>
  <line class="torso-l" x1="58" y1="112" x2="120" y2="148"/>
  <line class="torso-r" x1="54" y1="118" x2="116" y2="152"/>
  <line class="upper-arm" x1="85" y1="128" x2="125" y2="170"/>
  <!-- legs push toward platform from hip (120, 150) -->
  <g transform="translate(120, 150)">
    <g>${rot("35; 0; 35", 2.4)}
      <line class="thigh" x1="0" y1="0" x2="50" y2="0"/>
      <g transform="translate(50, 0)">
        <g>${rot("-50; 0; -50", 2.4)}
          <line class="shin" x1="0" y1="0" x2="40" y2="0"/>
          <circle class="foot" cx="42" cy="0" r="4"/>
        </g>
      </g>
    </g>
  </g>
  <g transform="translate(120, 156)">
    <g>${rot("35; 0; 35", 2.4)}
      <line class="thigh" x1="0" y1="0" x2="50" y2="0"/>
      <g transform="translate(50, 0)">
        <g>${rot("-50; 0; -50", 2.4)}
          <line class="shin" x1="0" y1="0" x2="40" y2="0"/>
        </g>
      </g>
    </g>
  </g>
`);

// LEG EXTENSION — seated, shins rotate up
ANIMS.legext = () => wrap("legext", `
  ${bench(120, 145, 100)}
  <circle class="head" cx="78" cy="80" r="13"/>
  <line class="torso-l" x1="78" y1="93" x2="78" y2="140"/>
  <line class="torso-r" x1="83" y1="93" x2="83" y2="140"/>
  <line class="upper-arm" x1="80" y1="105" x2="55" y2="145"/>
  <line class="thigh" x1="80" y1="140" x2="155" y2="140"/>
  <!-- shin pivots at knee (155, 140) -->
  <g transform="translate(155, 140)">
    <g>${rot("0; -85; 0", 2.4)}
      <line class="shin" x1="0" y1="0" x2="0" y2="50"/>
      <circle class="foot" cx="3" cy="52" r="4"/>
    </g>
  </g>
`);

// LEG CURL — prone, shin curls up to butt
ANIMS.legcurl = () => wrap("legcurl", `
  ${bench(120, 145, 160)}
  <circle class="head" cx="40" cy="130" r="13"/>
  <line class="torso-l" x1="53" y1="132" x2="170" y2="135"/>
  <line class="torso-r" x1="53" y1="137" x2="170" y2="140"/>
  <line class="upper-arm" x1="80" y1="133" x2="70" y2="170"/>
  <line class="thigh" x1="170" y1="135" x2="200" y2="135"/>
  <!-- shins curl up -->
  <g transform="translate(200, 135)">
    <g>${rot("0; -100; 0", 2.4)}
      <line class="shin" x1="0" y1="0" x2="0" y2="46"/>
      <circle class="foot" cx="0" cy="48" r="4"/>
    </g>
  </g>
`);

// CALF RAISE — body rises (heels lift)
ANIMS.calf = () => wrap("calf", `
  <g>${trans("0 0; 0 -14; 0 0", 1.6)}
    ${person({ cx: 120, hipY: 138 })}
  </g>
  <rect class="machine" x="100" y="${GROUND_Y - 14}" width="40" height="14" rx="2"/>
`);

// =========================================================================
// CARDIO
// =========================================================================

// JOG / RUN — legs/arms cycle
ANIMS.jog = () => wrap("jog", `
  <g>${trans("0 0; 0 -5; 0 0", 0.7)}
    <circle class="head" cx="120" cy="60" r="13"/>
    <line class="torso-l" x1="111" y1="73" x2="111" y2="125"/>
    <line class="torso-r" x1="129" y1="73" x2="129" y2="125"/>
    <!-- left arm rotates -->
    <g transform="translate(106, 88)">
      <g>${rot("35; -30; 35", 0.7)}
        <line class="upper-arm" x1="0" y1="0" x2="0" y2="30"/>
        <line class="forearm" x1="0" y1="30" x2="-12" y2="50"/>
      </g>
    </g>
    <g transform="translate(134, 88)">
      <g>${rot("-30; 35; -30", 0.7)}
        <line class="upper-arm" x1="0" y1="0" x2="0" y2="30"/>
        <line class="forearm" x1="0" y1="30" x2="12" y2="50"/>
      </g>
    </g>
    <!-- legs -->
    <g transform="translate(111, 125)">
      <g>${rot("35; -35; 35", 0.7)}
        <line class="thigh" x1="0" y1="0" x2="0" y2="36"/>
        <g transform="translate(0, 36)">
          <g>${rot("0; -50; 0", 0.7)}
            <line class="shin" x1="0" y1="0" x2="0" y2="36"/>
            <circle class="foot" cx="-3" cy="38" r="4"/>
          </g>
        </g>
      </g>
    </g>
    <g transform="translate(129, 125)">
      <g>${rot("-35; 35; -35", 0.7)}
        <line class="thigh" x1="0" y1="0" x2="0" y2="36"/>
        <g transform="translate(0, 36)">
          <g>${rot("-50; 0; -50", 0.7)}
            <line class="shin" x1="0" y1="0" x2="0" y2="36"/>
            <circle class="foot" cx="3" cy="38" r="4"/>
          </g>
        </g>
      </g>
    </g>
  </g>
`);

ANIMS.sprint = ANIMS.jog;

// CROSS TRAINER — feet move on rails, arms swing
ANIMS.cross = () => wrap("cross", `
  <line class="machine" x1="35" y1="100" x2="35" y2="${GROUND_Y}"/>
  <line class="machine" x1="205" y1="100" x2="205" y2="${GROUND_Y}"/>
  <circle class="head" cx="120" cy="60" r="13"/>
  <line class="torso-l" x1="111" y1="73" x2="111" y2="125"/>
  <line class="torso-r" x1="129" y1="73" x2="129" y2="125"/>
  <g transform="translate(106, 88)">
    <g>${rot("-30; 25; -30", 1.5)}
      <line class="upper-arm" x1="0" y1="0" x2="0" y2="40"/>
    </g>
  </g>
  <g transform="translate(134, 88)">
    <g>${rot("25; -30; 25", 1.5)}
      <line class="upper-arm" x1="0" y1="0" x2="0" y2="40"/>
    </g>
  </g>
  <g transform="translate(111, 125)">
    <g>${rot("18; -18; 18", 1.5)}
      <line class="thigh" x1="0" y1="0" x2="0" y2="40"/>
      <line class="shin" x1="0" y1="40" x2="0" y2="80"/>
      <circle class="foot" cx="-3" cy="82" r="4"/>
    </g>
  </g>
  <g transform="translate(129, 125)">
    <g>${rot("-18; 18; -18", 1.5)}
      <line class="thigh" x1="0" y1="0" x2="0" y2="40"/>
      <line class="shin" x1="0" y1="40" x2="0" y2="80"/>
      <circle class="foot" cx="3" cy="82" r="4"/>
    </g>
  </g>
`);

// SPIN BIKE — pedals spin, rider's legs orbit crank
ANIMS.bike = () => wrap("bike", `
  <g class="machine">
    <line x1="65" y1="${GROUND_Y}" x2="175" y2="${GROUND_Y}"/>
    <circle cx="80" cy="180" r="20" fill="none" stroke-width="2.5"/>
    <circle cx="170" cy="180" r="20" fill="none" stroke-width="2.5"/>
    <line x1="80" y1="180" x2="125" y2="105" stroke-width="2.5"/>
    <line x1="170" y1="180" x2="125" y2="105" stroke-width="2.5"/>
    <line x1="125" y1="105" x2="115" y2="80" stroke-width="2.5"/>
    <rect x="100" y="70" width="30" height="6"/>
    <line x1="170" y1="180" x2="180" y2="105" stroke-width="2.5"/>
    <line x1="160" y1="100" x2="195" y2="100" stroke-width="3"/>
  </g>
  <circle class="head" cx="130" cy="50" r="13"/>
  <line class="torso-l" x1="130" y1="63" x2="110" y2="95"/>
  <line class="torso-r" x1="134" y1="63" x2="115" y2="100"/>
  <line class="upper-arm" x1="125" y1="80" x2="175" y2="100"/>
  <line class="upper-arm" x1="125" y1="80" x2="190" y2="100"/>
  <!-- pedals at crank (125, 130). Legs orbit the crank with foot on pedal -->
  <g transform="translate(125, 135)">
    <g><animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="1.4s" repeatCount="indefinite"/>
      <line class="thigh" x1="0" y1="0" x2="-22" y2="-30"/>
    </g>
  </g>
  <g transform="translate(125, 135)">
    <g><animateTransform attributeName="transform" type="rotate" from="180" to="540" dur="1.4s" repeatCount="indefinite"/>
      <line class="thigh" x1="0" y1="0" x2="-22" y2="-30"/>
    </g>
  </g>
`);

// STRETCH — arms gently sway up
ANIMS.stretch = () => wrap("stretch", `
  ${personNoArms()}
  <g transform="translate(106, 88)">
    <g>${rot("170; 190; 170", 3.0)}
      <line class="upper-arm" x1="0" y1="0" x2="0" y2="30"/>
      <line class="forearm" x1="0" y1="30" x2="0" y2="58"/>
      <circle class="hand" cx="0" cy="61" r="4"/>
    </g>
  </g>
  <g transform="translate(134, 88)">
    <g>${rot("190; 170; 190", 3.0)}
      <line class="upper-arm" x1="0" y1="0" x2="0" y2="30"/>
      <line class="forearm" x1="0" y1="30" x2="0" y2="58"/>
      <circle class="hand" cx="0" cy="61" r="4"/>
    </g>
  </g>
`);

// JUMPING JACK — arms+legs in/out
ANIMS.jack = () => wrap("jack", `
  <g>${trans("0 0; 0 -5; 0 0", 0.7)}
    <circle class="head" cx="120" cy="55" r="13"/>
    <line class="torso-l" x1="111" y1="68" x2="111" y2="125"/>
    <line class="torso-r" x1="129" y1="68" x2="129" y2="125"/>
    <!-- arms rotate out to sides (above head) -->
    <g transform="translate(106, 80)">
      <g>${rot("0; -150; 0", 0.7)}
        <line class="upper-arm" x1="0" y1="0" x2="0" y2="30"/>
        <line class="forearm" x1="0" y1="30" x2="0" y2="58"/>
        <circle class="hand" cx="0" cy="62" r="4"/>
      </g>
    </g>
    <g transform="translate(134, 80)">
      <g>${rot("0; 150; 0", 0.7)}
        <line class="upper-arm" x1="0" y1="0" x2="0" y2="30"/>
        <line class="forearm" x1="0" y1="30" x2="0" y2="58"/>
        <circle class="hand" cx="0" cy="62" r="4"/>
      </g>
    </g>
    <!-- legs out -->
    <g transform="translate(111, 125)">
      <g>${rot("0; -25; 0", 0.7)}
        <line class="thigh" x1="0" y1="0" x2="0" y2="36"/>
        <line class="shin" x1="0" y1="36" x2="0" y2="70"/>
        <circle class="foot" cx="-3" cy="72" r="4"/>
      </g>
    </g>
    <g transform="translate(129, 125)">
      <g>${rot("0; 25; 0", 0.7)}
        <line class="thigh" x1="0" y1="0" x2="0" y2="36"/>
        <line class="shin" x1="0" y1="36" x2="0" y2="70"/>
        <circle class="foot" cx="3" cy="72" r="4"/>
      </g>
    </g>
  </g>
`);

// HIGH KNEES — knees pump up alternating
ANIMS.knees = () => wrap("knees", `
  <circle class="head" cx="120" cy="60" r="13"/>
  <line class="torso-l" x1="111" y1="73" x2="111" y2="125"/>
  <line class="torso-r" x1="129" y1="73" x2="129" y2="125"/>
  <!-- arms pumping like running -->
  <g transform="translate(106, 88)">
    <g>${rot("60; -10; 60", 0.5)}
      <line class="upper-arm" x1="0" y1="0" x2="0" y2="30"/>
      <line class="forearm" x1="0" y1="30" x2="-2" y2="2"/>
    </g>
  </g>
  <g transform="translate(134, 88)">
    <g>${rot("-10; 60; -10", 0.5)}
      <line class="upper-arm" x1="0" y1="0" x2="0" y2="30"/>
      <line class="forearm" x1="0" y1="30" x2="2" y2="2"/>
    </g>
  </g>
  <!-- legs alternating pull up -->
  <g transform="translate(111, 125)">
    <g><animateTransform attributeName="transform" type="rotate" values="0;-90;0;0;0" keyTimes="0;0.25;0.5;0.75;1" dur="1s" repeatCount="indefinite"/>
      <line class="thigh" x1="0" y1="0" x2="0" y2="36"/>
      <g transform="translate(0, 36)">
        <g><animateTransform attributeName="transform" type="rotate" values="0;80;0;0;0" keyTimes="0;0.25;0.5;0.75;1" dur="1s" repeatCount="indefinite"/>
          <line class="shin" x1="0" y1="0" x2="0" y2="36"/>
          <circle class="foot" cx="-2" cy="38" r="4"/>
        </g>
      </g>
    </g>
  </g>
  <g transform="translate(129, 125)">
    <g><animateTransform attributeName="transform" type="rotate" values="0;0;0;90;0" keyTimes="0;0.25;0.5;0.75;1" dur="1s" repeatCount="indefinite"/>
      <line class="thigh" x1="0" y1="0" x2="0" y2="36"/>
      <g transform="translate(0, 36)">
        <g><animateTransform attributeName="transform" type="rotate" values="0;0;0;-80;0" keyTimes="0;0.25;0.5;0.75;1" dur="1s" repeatCount="indefinite"/>
          <line class="shin" x1="0" y1="0" x2="0" y2="36"/>
          <circle class="foot" cx="2" cy="38" r="4"/>
        </g>
      </g>
    </g>
  </g>
`);

// STEP UPS — figure steps onto box
ANIMS.step = () => wrap("step", `
  <rect class="machine" x="160" y="${GROUND_Y - 50}" width="60" height="50" rx="2"/>
  <g>${trans("0 0; 20 -12; 0 0", 2.0)}
    <circle class="head" cx="95" cy="65" r="13"/>
    <line class="torso-l" x1="86" y1="78" x2="92" y2="130"/>
    <line class="torso-r" x1="104" y1="78" x2="100" y2="130"/>
    <line class="upper-arm" x1="86" y1="90" x2="65" y2="130"/>
    <line class="upper-arm" x1="104" y1="90" x2="125" y2="130"/>
    <line class="thigh" x1="95" y1="128" x2="95" y2="165"/>
    <line class="shin" x1="95" y1="165" x2="95" y2="${GROUND_Y}"/>
  </g>
  <!-- stepping leg lifts onto box -->
  <g transform="translate(95, 130)">
    <g>${trans("0 30; 0 0; 0 30", 2.0)}
      <line class="thigh" x1="0" y1="0" x2="60" y2="20"/>
      <line class="shin" x1="60" y1="20" x2="80" y2="50"/>
      <circle class="foot" cx="82" cy="52" r="4"/>
    </g>
  </g>
`);

// SKIPPING — rope spins, body bobs
ANIMS.skip = () => wrap("skip", `
  <g transform="translate(120, 135)">
    <g><animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="0.6s" repeatCount="indefinite"/>
      <ellipse class="skip-rope" cx="0" cy="0" rx="62" ry="50" fill="none" stroke-dasharray="5 3"/>
    </g>
  </g>
  <g>${trans("0 0; 0 -4; 0 0", 0.6)}
    <circle class="head" cx="120" cy="58" r="13"/>
    <line class="torso-l" x1="111" y1="71" x2="111" y2="125"/>
    <line class="torso-r" x1="129" y1="71" x2="129" y2="125"/>
    <line class="upper-arm" x1="106" y1="88" x2="80" y2="118"/>
    <line class="upper-arm" x1="134" y1="88" x2="160" y2="118"/>
    <line class="thigh" x1="111" y1="125" x2="111" y2="160"/>
    <line class="thigh" x1="129" y1="125" x2="129" y2="160"/>
    <line class="shin" x1="111" y1="160" x2="111" y2="195"/>
    <line class="shin" x1="129" y1="160" x2="129" y2="195"/>
  </g>
`);

// =========================================================================
// CORE
// =========================================================================

// CRUNCH — upper body curls up
ANIMS.crunch = () => wrap("crunch", `
  <line class="thigh" x1="120" y1="180" x2="170" y2="155"/>
  <line class="shin" x1="170" y1="155" x2="170" y2="${GROUND_Y}"/>
  <circle class="foot" cx="173" cy="${GROUND_Y - 2}" r="4"/>
  <g transform="translate(120, 180)">
    <g>${rot("0; -40; 0", 2.4)}
      <line class="torso-l" x1="0" y1="0" x2="-55" y2="-9"/>
      <line class="torso-r" x1="0" y1="-5" x2="-55" y2="-14"/>
      <circle class="head" cx="-62" cy="-15" r="13"/>
      <line class="upper-arm" x1="-30" y1="-7" x2="-55" y2="-32"/>
      <line class="upper-arm" x1="-30" y1="-12" x2="-55" y2="-37"/>
    </g>
  </g>
`);

// LEG RAISE — legs rotate up from floor
ANIMS.legraise = () => wrap("legraise", `
  <circle class="head" cx="30" cy="170" r="13"/>
  <line class="torso-l" x1="43" y1="172" x2="125" y2="172"/>
  <line class="torso-r" x1="43" y1="177" x2="125" y2="177"/>
  <line class="upper-arm" x1="80" y1="174" x2="80" y2="${GROUND_Y}"/>
  <g transform="translate(125, 175)">
    <g>${rot("0; -80; 0", 2.4)}
      <line class="thigh" x1="0" y1="-3" x2="44" y2="-3"/>
      <line class="thigh" x1="0" y1="3" x2="44" y2="3"/>
      <line class="shin" x1="44" y1="-3" x2="88" y2="-3"/>
      <line class="shin" x1="44" y1="3" x2="88" y2="3"/>
      <circle class="foot" cx="90" cy="0" r="4"/>
    </g>
  </g>
`);

// SIDE BEND — body tilts side
ANIMS.sidebend = () => wrap("sidebend", `
  <g transform="translate(120, 200)">
    <g>${rot("0; 18; 0", 2.6)}
      <circle class="head" cx="0" cy="-145" r="13"/>
      <line class="torso-l" x1="-9" y1="-72" x2="-14" y2="-132"/>
      <line class="torso-r" x1="9" y1="-72" x2="14" y2="-132"/>
      <line class="torso-mid" x1="0" y1="-72" x2="0" y2="-132"/>
      <line class="upper-arm" x1="-14" y1="-112" x2="-30" y2="-72"/>
      <line class="upper-arm" x1="14" y1="-112" x2="14" y2="-56"/>
      <g transform="translate(14, -52)">${dbAt(24)}</g>
      <!-- legs -->
      <line class="thigh" x1="-9" y1="-72" x2="-9" y2="-36"/>
      <line class="thigh" x1="9" y1="-72" x2="9" y2="-36"/>
      <line class="shin" x1="-9" y1="-36" x2="-9" y2="0"/>
      <line class="shin" x1="9" y1="-36" x2="9" y2="0"/>
      <circle class="foot" cx="-11" cy="2" r="4"/>
      <circle class="foot" cx="11" cy="2" r="4"/>
    </g>
  </g>
`);

// SIDE PLANK — diagonal hold, top arm rises/lowers
ANIMS.sideplank = () => wrap("sideplank", `
  <circle class="head" cx="50" cy="90" r="13"/>
  <line class="torso-l" x1="62" y1="96" x2="190" y2="160"/>
  <line class="torso-r" x1="60" y1="100" x2="188" y2="164"/>
  <line class="upper-arm" x1="65" y1="100" x2="65" y2="160"/>
  <line class="forearm" x1="65" y1="160" x2="100" y2="${GROUND_Y}"/>
  <g transform="translate(65, 100)">
    <g>${rot("0; -25; 0", 3.0)}
      <line class="upper-arm" x1="0" y1="0" x2="0" y2="-50"/>
      <circle class="hand" cx="0" cy="-54" r="4"/>
    </g>
  </g>
  <line class="thigh" x1="190" y1="162" x2="200" y2="${GROUND_Y}"/>
`);

// PLANK — micro bob
ANIMS.plank = () => wrap("plank", `
  <g>${trans("0 0; 0 -3; 0 0", 3.0)}
    <circle class="head" cx="35" cy="135" r="13"/>
    <line class="torso-l" x1="48" y1="138" x2="175" y2="146"/>
    <line class="torso-r" x1="48" y1="143" x2="175" y2="151"/>
    <line class="thigh" x1="175" y1="148" x2="215" y2="155"/>
    <line class="shin" x1="215" y1="155" x2="222" y2="190"/>
    <circle class="foot" cx="222" cy="192" r="4"/>
    <line class="upper-arm" x1="55" y1="143" x2="55" y2="180"/>
    <line class="forearm" x1="55" y1="180" x2="90" y2="180"/>
    <line class="upper-arm" x1="90" y1="148" x2="90" y2="180"/>
  </g>
`);

function renderAnim(key) {
  const fn = ANIMS[key];
  if (!fn) return wrap("missing", `<text x="120" y="100" text-anchor="middle" fill="#888" font-size="12">${key}</text>`);
  return fn();
}
