'use client'

/**
 * The map. First 'use client' component in the codebase — everything else is
 * server-rendered, and the timeline at /whats-on carries the same information
 * without JavaScript, so the map is enhancement rather than requirement.
 */
import { useEffect, useRef } from 'react'
import * as maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'

type Feature = {
  geometry: { coordinates: [number, number] }
  properties: { slug: string; title: string; startsAt: string; category: string | null; organiser: string | null; address: string | null }
}

const timeFmt = new Intl.DateTimeFormat('en-GB', {
  weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London',
})

export default function EventsMap({ features }: { features: Feature[] }) {
  const container = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!container.current) return
    const map = new maplibregl.Map({
      container: container.current,
      style: {
        version: 8,
        sources: {
          osm: {
            type: 'raster',
            tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
            tileSize: 256,
            attribution: '© OpenStreetMap contributors',
          },
        },
        layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
      },
      center: features[0]?.geometry.coordinates ?? [-2.24, 53.48],
      zoom: features.length ? 11 : 6,
    })
    map.addControl(new maplibregl.NavigationControl(), 'top-right')

    const bounds = new maplibregl.LngLatBounds()
    for (const f of features) {
      const [lng, lat] = f.geometry.coordinates
      bounds.extend([lng, lat])
      const p = f.properties
      const popup = new maplibregl.Popup({ offset: 18 }).setHTML(
        `<strong><a href="/e/${encodeURIComponent(p.slug)}">${escapeHtml(p.title)}</a></strong><br/>` +
          `${timeFmt.format(new Date(p.startsAt))}` +
          (p.address ? `<br/>${escapeHtml(p.address)}` : '') +
          (p.organiser ? `<br/><span style="opacity:.7">by ${escapeHtml(p.organiser)}</span>` : ''),
      )
      new maplibregl.Marker().setLngLat([lng, lat]).setPopup(popup).addTo(map)
    }
    if (features.length > 1) map.fitBounds(bounds, { padding: 60, maxZoom: 14 })

    return () => map.remove()
  }, [features])

  return <div ref={container} style={{ width: '100%', height: '70vh', borderRadius: '8px' }} />
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)
}
