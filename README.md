# czynalive

Klon funkcjonalności czynaczas.pl jako React SPA (Vite + MUI + MapLibre), zasilany API zbiorkom.live (`/api6`).

## Uruchomienie

```bash
npm install
npm run dev          # http://localhost:5173
npm run build        # statyczny build w dist/
```

Adres API: domyślnie `https://api.zbiorkom.live/api6`, nadpisywany przez `VITE_API_BASE` (np. `VITE_API_BASE=http://localhost:3000/api6 npm run dev`).

## Cloudflare Pages

- Build command: `npm run build`
- Build output directory: `dist`
- `public/_redirects` (`/* /index.html 200`) obsługuje routing SPA.

## Backend

Część funkcji (komunikaty miasta, odwołane kursy, opóźnienia, ranking miast, brygady całego miasta, opóźnienia na mapie) korzysta z tymczasowych endpointów `/api6/.../cnc/...` z `backend/src/server/endpoints/v6/cnc-joke.ts`. Dopóki nie są wdrożone, strony pokazują „Brak danych” albo liczą to po stronie frontendu. Referencja API: `docs/api6.md`.
