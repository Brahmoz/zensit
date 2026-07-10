# 💠 Zensit — Personal Allergy Telemetry PWA

A mobile-first Progressive Web App for logging allergy symptoms with real-time climate telemetry. Built for MedGemma LLM clinical data analysis.

**Live App →** [zensit.vercel.app](https://zensit.vercel.app)

---

## ✨ Features

- **3-Step Symptom Wizard** — log patient profile, active symptoms, and environmental exposure
- **Real-time Climate Telemetry** — GPS-based ambient temperature & humidity via OpenWeather API
- **Sneezing Frequency Counter** — 10-second count window for quantified severity
- **Firebase Firestore** — structured JSON logs persisted in the cloud
- **Admin Console** — password-protected analytics dashboard with symptom distribution charts and climate trend graphs
- **MedGemma Export** — one-click JSON export formatted for LLM clinical analysis
- **PWA Ready** — installable on any mobile device, works offline

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Styling | Tailwind CSS + Custom CSS animations |
| Database | Firebase Firestore |
| Weather | OpenWeather API |
| Deployment | Vercel |
| PWA | @ducanh2912/next-pwa |

## 🚀 Getting Started

### 1. Clone the repo
```bash
git clone https://github.com/YOUR_USERNAME/zensit.git
cd zensit
```

### 2. Install dependencies
```bash
npm install
```

### 3. Set up environment variables
```bash
cp .env.local.example .env.local
```
Fill in your Firebase and OpenWeather credentials in `.env.local`.

### 4. Run the development server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000)

## 🔐 Environment Variables

See [`.env.local.example`](.env.local.example) for all required variables.

## 📁 Project Structure

```
app/
├── page.tsx          # Landing page with particle animation
├── wizard/           # 3-step symptom logging wizard
├── admin/            # Password-protected analytics console
├── api/weather/      # Server-side OpenWeather proxy
└── globals.css       # Design system + animations

lib/
└── firebase.ts       # Firebase client initialization

firestore.rules       # Firestore security rules
firestore.indexes.json
```

## 🔒 Firestore Security Rules

Paste contents of `firestore.rules` into your [Firebase Console → Firestore → Rules](https://console.firebase.google.com/project/_/firestore/rules).

## 📄 License

MIT — built for clinical telemetry research.
