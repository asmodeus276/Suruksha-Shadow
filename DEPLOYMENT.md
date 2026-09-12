# Suraksha Shadow — Production Deployment & Cloud Setup Guide

This guide outlines how to deploy the **Suraksha Shadow** platform to production with the Vite frontend on **Vercel** and the Express backend on **Render** (or Railway).

---

## 1. Architectural Overview

```
[ Visitor / Phone Browser ]
         │
         ├─── (Static Assets & React App) ────► Vercel (Vite Client)
         │                                       │
         └─── (REST API, SOS, Audio, Sahara) ───► Render / Railway (Express Server)
                                                   │
                                                   └──► Supabase DB & Fast2SMS Gateway
```

---

## 2. Deploying the Backend (Express API) to Render

1. Sign up or log into [Render.com](https://render.com) (Free tier available).
2. Click **New +** ➔ **Web Service**.
3. Connect your GitHub repository: `asmodeus276/Suruksha-Shadow`.
4. Configure the service settings:
   - **Name:** `suraksha-shadow-backend`
   - **Root Directory:** `server`
   - **Environment:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
5. Add Environment Variables in Render:
   - `PORT`: `4000` (or leave default, Render automatically injects `PORT`)
   - `SUPABASE_URL`: Your Supabase Project URL (`https://xyz.supabase.co`)
   - `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase Service Role Secret
<<<<<<< HEAD
=======
   - `TEXTBEE_API_KEY`: *(Recommended)* Your API key from [textbee.dev](https://textbee.dev)
   - `TEXTBEE_DEVICE_ID`: *(Optional)* Your Textbee Android device ID (or leave empty for default device)
   - `SMS_PROVIDER`: `textbee` (or `twilio`, `fast2sms`, `demo`)
>>>>>>> c2e7849a6003318640d9e7aa82668477f1172799
   - `FAST2SMS_API_KEY`: *(Optional)* Your Fast2SMS quick route API key (or leave empty for Demo Mode)
   - `SMS_DEMO_MODE`: `false` (set `true` to simulate SMS sends without burning balance)
   - `LEDGER_HMAC_SECRET`: Cryptographically random 256-bit hex/base64 key for BSA 2023 evidence countersigning
6. Click **Deploy Web Service**.
7. Copy your public backend URL once deployed, for example:  
   `https://suraksha-shadow-backend.onrender.com`

---

## 3. Deploying 100% on Vercel (All-in-One Serverless)

If you are deploying **only on Vercel** (without Render), the included root [`vercel.json`](file:///c:/Dev/Suraksha%20Shadow/vercel.json) automatically serves the React/Vite frontend and routes `/api/*` requests through the Express backend via [`api/index.js`](file:///c:/Dev/Suraksha%20Shadow/api/index.js) as Vercel Serverless Functions.

1. Push your changes to GitHub: `git push origin main`.
2. In the [Vercel Dashboard](https://vercel.com):
   - Click **Add New…** ➔ **Project** ➔ Import `Suruksha-Shadow`.
   - Keep **Root Directory** as `./` (the root containing `vercel.json`).
3. Under **Environment Variables**, add all required keys:
   - `SUPABASE_URL`: Your Supabase Project URL (`https://xyz.supabase.co`)
   - `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase Service Role Secret
   - `VITE_SUPABASE_URL`: Your Supabase Project URL
   - `VITE_SUPABASE_ANON_KEY`: Your Supabase Public Anon Key
<<<<<<< HEAD
=======
   - `TEXTBEE_API_KEY`: *(Recommended)* Your Textbee API Key from [app.textbee.dev](https://app.textbee.dev)
   - `TEXTBEE_DEVICE_ID`: *(Optional)* Textbee device ID
   - `SMS_PROVIDER`: `textbee`
>>>>>>> c2e7849a6003318640d9e7aa82668477f1172799
   - `FAST2SMS_API_KEY`: *(Optional)* Fast2SMS quick route key (or leave empty for Demo Mode)
   - `SMS_DEMO_MODE`: `false` (or `true` for demo logs)
   - `LEDGER_HMAC_SECRET`: 256-bit cryptographic signing key for BSA §63 evidence countersignatures
   - `CLIENT_URL`: Your Vercel deployment URL (e.g. `https://suruksha-shadow.vercel.app`)
   *(Note: Leave `VITE_API_BASE_URL` empty or omitted so the app automatically uses same-origin `/api`)*.
4. Click **Deploy**.

---

## 4. Map API Keys & Tile Providers

Suraksha Shadow uses **Leaflet** with **CartoDB Dark Matter tiles**:
- **Default (No API Key Required):**  
  The app renders `https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png`. This works immediately with zero keys or billing requirements.
- **Reverse Geocoding (Address Lookup):**  
  Uses the OpenStreetMap Nominatim endpoint with client-side caching to translate GPS coordinates into readable street names (e.g., "Connaught Place, New Delhi") with zero API keys required.
- **Upgrading to Stadia Maps (Optional):**  
  If you scale to heavy traffic, register a free account at [Stadia Maps](https://stadiamaps.com/) and replace the tile URL in [`client/src/components/LiveMap.jsx`](file:///c:/Dev/Suraksha%20Shadow/client/src/components/LiveMap.jsx) with your Stadia API key.

---

## 5. Pre-Flight Production Checklist

- [ ] Backend is live and `https://<YOUR_BACKEND>/health` returns `{"ok": true}`.
- [ ] `VITE_API_BASE_URL` in Vercel points to your public backend URL (not `http://localhost:4000`).
- [ ] Supabase SQL migrations ([`Schema.sql`](file:///c:/Dev/Suraksha%20Shadow/Schema.sql), [`schema-fr11-guided-steps.sql`](file:///c:/Dev/Suraksha%20Shadow/schema-fr11-guided-steps.sql), [`schema-fr12-knowledge-base.sql`](file:///c:/Dev/Suraksha%20Shadow/schema-fr12-knowledge-base.sql), [`schema-fr13-checkin.sql`](file:///c:/Dev/Suraksha%20Shadow/schema-fr13-checkin.sql), [`schema-p0-security.sql`](file:///c:/Dev/Suraksha%20Shadow/schema-p0-security.sql)) have been executed in your Supabase SQL editor.
- [ ] Supabase Storage bucket `vault_evidence` has been created (private bucket for BSA evidence chain-of-custody).
- [ ] Trusted Contacts have been saved with valid 10-digit Indian mobile numbers (`91XXXXXXXXXX`).
- [ ] Test the **Guardian Live Tracking** link on an actual smartphone to verify GPS updates, audio playback, and 1-tap Google Maps navigation.
