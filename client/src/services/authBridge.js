/**
 * authBridge.js — shared token state between AuthContext and api.js.
 *
 * Both modules import from here; neither imports from the other.
 * This breaks the circular dependency that would occur if they imported each other.
 */

let _token   = null
let _refresh = null
let _logout  = null

export const getAccessToken = () => _token
export const setAccessToken = (token) => { _token = token }

export function setAuthCallbacks(refresh, logout) {
  _refresh = refresh
  _logout  = logout
}

export const getRefreshCallback = () => _refresh
export const getLogoutCallback  = () => _logout
