// docs.on-chaindat.com is served by middleware rewriting to /docs/*. Browsers
// requesting /icon on the docs subdomain hit /docs/icon, so we need an icon
// file at this segment too. Re-export the root icon module so the visual stays
// identical and there's only one source of truth.
export { default, size, contentType } from "../icon";
