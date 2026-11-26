# Download engine for /download/ (Cobalt)

The page `waledoweida.com/download/` and `api/download.ts` are on Vercel, but Vercel can't fetch
videos from YouTube itself (YouTube blocks cloud servers, and functions are too short-lived for
big files). The actual downloading is done by **Cobalt** (open source, github.com/imputnet/cobalt),
running on its own small server. `api/download.ts` talks to it server-to-server, so its key never
reaches the browser.

## 1. A server
Any small Linux VPS with Docker (1 GB RAM is enough): Hetzner, Contabo, DigitalOcean… about $5/month.

## 2. Run Cobalt
```bash
mkdir cobalt && cd cobalt
# copy docker-compose.yml from this folder here
uuidgen                                   # this is your API key
# create keys.json like keys.example.json, with the key from uuidgen
docker compose up -d
```

## 3. A domain with HTTPS
In GoDaddy DNS add an `A` record: `dl` → the server's IP. Then put a reverse proxy in front of
port 9000 with a free certificate, e.g. Caddy:
```
dl.waledoweida.com {
    reverse_proxy localhost:9000
}
```
`API_URL` in docker-compose.yml must match this address.

## 4. Connect the site (Vercel → Settings → Environment Variables)
| Name | Value |
|---|---|
| `COBALT_API_URL` | `https://dl.waledoweida.com` |
| `COBALT_API_KEY` | the key from keys.json |

Redeploy. Until these are set the page shows "the service is being prepared".

## YouTube asking to sign in
YouTube sometimes blocks server IPs ("sign in to confirm you're not a bot"). If downloads from
YouTube fail with that, add cookies of a spare Google account as `cookies.json` and enable
`COOKIE_PATH` in docker-compose.yml (format: Cobalt docs, `docs/run-an-instance.md`). Other sites
(TikTok, Instagram, X, Facebook…) usually work without this.

## Limits
`api/download.ts` allows 20 links per 10 minutes per visitor address (Redis, same as the tracker).
