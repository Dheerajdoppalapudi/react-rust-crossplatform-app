// All client-side route paths in one place.
// Import from here instead of scattering string literals across the app.

export const ROUTES = {
  HOME:        '/',
  LOGIN:       '/login',
  REGISTER:    '/register',
  STUDIO:      '/studio',
  STUDIO_CONV: '/studio/:convId',
  SETTINGS:    '/settings',
}

/** Build the studio URL for a specific conversation. */
export const studioConvUrl = (convId) => `/studio/${convId}`
