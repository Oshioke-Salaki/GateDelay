# Gatedelay Frontend

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app), built using React 19, TypeScript, and Tailwind CSS.

## Getting Started

### 1. Environment Setup

Copy the environment variables example file to `.env.local` and configure your local settings:

```bash
cp .env.example .env.local
```

Modify `.env.local` to fit your local development environment:
- `NEXT_PUBLIC_API_URL` specifies the backend API target for the local proxy (defaults to `http://localhost:8080`).
- `NEXT_PUBLIC_BACKEND_URL` specifies the backend URL for WebSocket connections (defaults to `http://localhost:8080`).

### 2. Run the Development Server

First, install the dependencies:

```bash
npm install
```

Then, run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

---

## Local API Proxy Setup & Rewrites

To prevent Cross-Origin Resource Sharing (CORS) issues and simplify local development, Next.js is configured with a secure local proxy via rewrites in `next.config.ts`.

### How it Works

When the frontend makes a request to:
- `/api/v1/:path*`
- `/backend/:path*`

Next.js will transparently proxy/rewrite those requests to your target backend URL (defined by `NEXT_PUBLIC_API_URL`, falling back to `http://localhost:8080` if not set).

#### Example:
A client-side fetch request to `/api/v1/markets` will be routed under the hood to `http://localhost:8080/api/v1/markets` during local development, keeping cookies and request headers intact without triggering CORS pre-flight blocks.

### Security Check & Secret Leakage Prevention

- **Zero Legacy Exposure:** Legacy Next.js config features like `publicRuntimeConfig` are not used. This ensures that no server-side secrets or system environment variables are accidentally serialized and sent to the client.
- **Client-Bundle Protection:** Only safe, non-sensitive public configuration variables prefixed with `NEXT_PUBLIC_` are permitted to be bundled into browser code. Do NOT prefix database passwords, private keys, or third-party service credentials with `NEXT_PUBLIC_`.

---

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.
