import { useEffect, useState } from 'react'
import { Box, Typography, useTheme } from '@mui/material'
import { MapContainer, TileLayer, Marker, Popup, Polyline, Polygon, Circle, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { TYPOGRAPHY, RADIUS, PALETTE } from '../../../theme/tokens'

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconUrl:       new URL('leaflet/dist/images/marker-icon.png',    import.meta.url).href,
  iconRetinaUrl: new URL('leaflet/dist/images/marker-icon-2x.png', import.meta.url).href,
  shadowUrl:     new URL('leaflet/dist/images/marker-shadow.png',  import.meta.url).href,
})

const TILE_LAYERS = {
  osm:       { url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',                                              attribution: '© OpenStreetMap contributors' },
  satellite: { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',   attribution: '© Esri' },
  terrain:   { url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',                                                attribution: '© OpenTopoMap contributors' },
  dark:      { url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',                                   attribution: '© CartoDB' },
  light:     { url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',                                  attribution: '© CartoDB' },
}

function coloredDivIcon(color = '#4B72FF') {
  return L.divIcon({
    className: '',
    html: `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="30" viewBox="0 0 22 30">
      <path d="M11 0C4.925 0 0 4.925 0 11c0 8.25 11 19 11 19s11-10.75 11-19C22 4.925 17.075 0 11 0z" fill="${color}" stroke="white" stroke-width="1.5"/>
      <circle cx="11" cy="11" r="4" fill="white"/>
    </svg>`,
    iconSize: [22, 30], iconAnchor: [11, 30], popupAnchor: [0, -30],
  })
}

function BoundsController({ bounds }) {
  const map = useMap()
  useEffect(() => { if (bounds) map.fitBounds(bounds) }, [map, bounds])
  return null
}

function InteractionDisabler() {
  const map = useMap()
  useEffect(() => {
    map.dragging.disable()
    map.touchZoom.disable()
    map.doubleClickZoom.disable()
    map.scrollWheelZoom.disable()
    map.keyboard.disable()
    return () => {
      map.dragging.enable()
      map.touchZoom.enable()
      map.doubleClickZoom.enable()
      map.scrollWheelZoom.disable() // keep scroll zoom off always
      map.keyboard.enable()
    }
  }, [map])
  return null
}

export default function MapViewer({
  center,
  zoom        = 4,
  height      = 380,
  tileLayer   = 'osm',
  markers     = [],
  paths       = [],
  polygons    = [],
  circles     = [],
  bounds,
  interactive = true,
  caption,
}) {
  const theme  = useTheme()
  const isDark = theme.palette.mode === 'dark'

  const [selectedMarker, setSelectedMarker] = useState(null)

  if (!center || !Array.isArray(center) || center.length < 2) {
    return (
      <Box sx={{ p: 2, color: 'error.main', fontSize: TYPOGRAPHY.sizes.caption }}>
        map_viewer: "center" prop [lat, lng] is required
      </Box>
    )
  }

  const tile = TILE_LAYERS[tileLayer] ?? TILE_LAYERS.osm

  const activeMarker = selectedMarker !== null ? markers[selectedMarker] : null

  return (
    <Box>
      <Box sx={{
        height,
        borderRadius: `${RADIUS.lg}px`,
        overflow: 'hidden',
        border: `1px solid ${isDark ? PALETTE.borderDark : PALETTE.borderCream}`,
        '& .leaflet-container': { height: '100%', width: '100%' },
        '& .leaflet-control-attribution': { fontSize: '9px', opacity: 0.6 },
      }}>
        <MapContainer center={center} zoom={zoom} style={{ height: '100%', width: '100%' }} scrollWheelZoom={false}>
          {tileLayer !== 'none' && <TileLayer url={tile.url} attribution={tile.attribution} />}
          {bounds && <BoundsController bounds={bounds} />}
          {!interactive && <InteractionDisabler />}

          {markers.map((m, i) => (
            <Marker
              key={i}
              position={[m.lat, m.lng]}
              icon={coloredDivIcon(m.color)}
              eventHandlers={{ click: () => setSelectedMarker(selectedMarker === i ? null : i) }}
            >
              {(m.label || m.tooltip) && (
                <Popup>
                  {m.label && <strong>{m.label}</strong>}
                  {m.tooltip && <div style={{ fontSize: 12, marginTop: m.label ? 4 : 0 }}>{m.tooltip}</div>}
                </Popup>
              )}
            </Marker>
          ))}

          {paths.map((p, i) => (
            <Polyline key={i} positions={p.points} color={p.color ?? '#4B72FF'} weight={p.weight ?? 3} opacity={p.opacity ?? 0.85}>
              {p.label && <Popup>{p.label}</Popup>}
            </Polyline>
          ))}

          {polygons.map((pg, i) => (
            <Polygon
              key={i} positions={pg.points}
              color={pg.strokeColor ?? '#4B72FF'} fillColor={pg.fillColor ?? '#4B72FF'}
              fillOpacity={pg.opacity ?? 0.3} weight={pg.weight ?? 2}
            >
              {(pg.label || pg.tooltip) && (
                <Popup>
                  {pg.label && <strong>{pg.label}</strong>}
                  {pg.tooltip && <div style={{ fontSize: 12, marginTop: pg.label ? 4 : 0 }}>{pg.tooltip}</div>}
                </Popup>
              )}
            </Polygon>
          ))}

          {circles.map((c, i) => (
            <Circle
              key={i} center={[c.lat, c.lng]} radius={c.radius}
              color={c.color ?? '#f59e0b'} fillColor={c.fillColor ?? c.color ?? '#f59e0b'}
              fillOpacity={c.fillOpacity ?? 0.2} weight={c.weight ?? 2}
            >
              {c.tooltip && <Popup>{c.tooltip}</Popup>}
            </Circle>
          ))}
        </MapContainer>
      </Box>

      {/* Marker info panel */}
      {activeMarker?.info && (
        <Box sx={{
          mt: 1, px: 2, py: 1.25,
          borderRadius: `${RADIUS.md}px`,
          border: `1px solid ${isDark ? PALETTE.borderDark : PALETTE.borderCream}`,
          backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
          borderLeft: `3px solid ${activeMarker.color ?? '#4B72FF'}`,
        }}>
          {activeMarker.label && (
            <Typography sx={{
              fontSize: TYPOGRAPHY.sizes.caption, fontWeight: 600,
              color: activeMarker.color ?? '#4B72FF', mb: 0.5,
            }}>
              {activeMarker.label}
            </Typography>
          )}
          <Typography sx={{
            fontSize: TYPOGRAPHY.sizes.caption,
            color: isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.55)',
            lineHeight: 1.5,
          }}>
            {activeMarker.info}
          </Typography>
        </Box>
      )}

      {caption && (
        <Typography sx={{
          mt: 1, fontSize: TYPOGRAPHY.sizes.caption, textAlign: 'center',
          color: isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)',
        }}>
          {caption}
        </Typography>
      )}
    </Box>
  )
}
