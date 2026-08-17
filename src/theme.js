// Outdoor court at dusk: deep blue-green surface, crisp white court lines,
// ball yellow reserved for one job only — a claimed block of time.
export const C = {
  deep: '#0A2532',
  panel: '#0F3546',
  panelHi: '#15455A',
  line: '#DCE9E7',
  hair: 'rgba(220,233,231,0.22)',
  ball: '#D9E63C',
  dim: '#6E8D9A',
  coral: '#FF7A59',
  ink: '#04161F',
};

// Ball yellow at a given opacity — how a grid cell draws "this many people are
// free". Kept here so the one raw rgb triple in the app lives beside the token
// it comes from.
export const ballAlpha = (a) => `rgba(217,230,60,${a})`;

// No webfonts on purpose: the scoreboard/court-signage feel comes from the
// system mono face, and skipping the network request keeps first paint instant.
export const MONO = 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace';
export const SANS = 'system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, sans-serif';
