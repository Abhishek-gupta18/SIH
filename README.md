# BHUMI-TWIN Backend

Backend prototype for the SIH 2026 land-acquisition digital twin demo.

## Stack

- Node.js and Express
- Prisma ORM
- PostgreSQL
- JWT authentication with simplified demo RBAC

## Setup

```powershell
npm install
Copy-Item .env.example .env
```

Set `DATABASE_URL` and `JWT_SECRET` in `.env` before starting the app.

Apply the existing Prisma database setup when required:

```powershell
npx prisma generate
npx prisma migrate dev --name init
```

Start the development server:

```powershell
npm run dev
```

The server listens on `http://localhost:3000` by default.

## Demo Data

Seed the project, parcel, person, acquisition-event, compensation, and R&R demo data with:

```powershell
npx prisma db seed
```

or:

```powershell
npm run db:seed
```

Create or refresh the demo accounts:

```powershell
node scripts/createDemoUsers.js
```

Run `node scripts/createDemoUsers.js` again any time the database has been reseeded — parcel IDs change on every reseed, so the citizen demo user's link must be refreshed after that.

The script preserves existing admin and officer users and refreshes the citizen user's linked parcel.

## Demo Accounts

- Admin: `admin@bhumitwin.demo` / `demo1234`
- Officer: `officer@bhumitwin.demo` / `demo1234`
- Citizen: `citizen@bhumitwin.demo`, authenticated with its current linked parcel ID as `caseId`

Citizen case IDs can change after reseeding. Run the demo-user script to print the current linked parcel.

## API Endpoints

### Health

```http
GET /health
GET /health/db
```

### Authentication

Admin and officer login:

```http
POST /auth/login
Content-Type: application/json

{
  "email": "admin@bhumitwin.demo",
  "password": "demo1234"
}
```

Citizen demo login:

```http
POST /auth/login
Content-Type: application/json

{
  "caseId": "<current-linked-parcel-id>"
}
```

Check the current JWT:

```http
GET /auth/me
Authorization: Bearer <token>
```

### Citizen Portal

```http
GET /citizen/case/:caseId
Authorization: Bearer <citizen-token>
```

Citizens can access only the parcel ID linked to their own JWT.

### Field Verification

Create a field verification event:

```http
POST /field/parcels/:id/evidence
Authorization: Bearer <admin-or-officer-token>
Content-Type: application/json

{
  "observation": "Boundary markers verified",
  "gpsLat": 18.4821,
  "gpsLng": 76.8214,
  "photoNote": "boundary_marker_1024.jpg"
}
```

View verification history:

```http
GET /field/parcels/:id/evidence-history
Authorization: Bearer <admin-or-officer-token>
```

`photoNote` is a text placeholder for a future photo upload; real file uploads are not implemented in this prototype.

## Available Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Express server with nodemon |
| `npm run db:seed` | Run the Prisma seed script |
| `npm run prisma:studio` | Open Prisma Studio |
| `node scripts/createDemoUsers.js` | Create or refresh demo users |

## Notes

This is a hackathon prototype. Citizen case-ID login is intentionally simplified and is not production-grade authentication. Replace the development JWT secret before any real deployment.
# SIH
