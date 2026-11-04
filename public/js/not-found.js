// Reports which address was requested but does not exist, as its own event, so
// broken links and mistyped URLs show up as a list in the dashboard. Only the
// path is sent, never the query string.
window.mlz?.track("not-found", { path: window.location.pathname });
