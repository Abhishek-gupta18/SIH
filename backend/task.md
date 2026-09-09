# BHUMI-TWIN Backend — Task Log

Sequence mein tasks maintain honge. Jo complete ho, uska status update karo.
Status legend: `[ ]` pending · `[~]` in progress · `[x]` done

---

## Phase 0 — Setup
- [x] Backend folder structure create (`app/models`, `app/schemas`, `app/api/v1`, `app/services`, `app/ml`, `app/core`, `app/utils`)
- [ ] `requirements.txt` + dependencies finalize
- [ ] `docker-compose.yml` (Postgres + PostGIS)
- [ ] `app/config.py` — env vars / settings
- [ ] `app/database.py` — DB session + PostGIS setup
- [ ] Alembic init + first migration setup

## Phase 1 — Core Data Models (Digital Twin foundation)
- [ ] `models/project.py` — Project, District, Zone
- [ ] `models/parcel.py` — Parcel (with PostGIS geometry column)
- [ ] `models/owner.py` — Owner, Tenant, AffectedFamily
- [ ] `models/acquisition.py` — Notification, Survey, Objection, Award events
- [ ] `models/compensation.py` — Compensation, R&R records
- [ ] `models/field_evidence.py` — Field officer uploads, GPS, photos
- [ ] `models/risk.py` — Risk scores, risk history
- [ ] `models/audit.py` — Append-only event log
- [ ] `models/user.py` — Roles (central/state/district/field/citizen)
- [ ] Corresponding Pydantic schemas in `schemas/`

## Phase 2 — Core APIs
- [ ] `api/v1/auth.py` — login, JWT, role-based access
- [ ] `api/v1/projects.py` — CRUD
- [ ] `api/v1/parcels.py` — CRUD + geometry queries
- [ ] `api/v1/acquisition.py` — workflow stage updates

## Phase 3 — Differentiator Features
- [ ] `services/simulator_service.py` + `api/v1/simulator.py` — What-If Simulator
- [ ] `services/risk_engine.py` + `api/v1/risk.py` — Risk score + explanation
- [ ] `ml/feature_engineering.py` + `ml/train_risk_model.py`

## Phase 4 — Supporting Features
- [ ] `services/anomaly_detector.py` — compensation anomaly detection
- [ ] `services/delay_predictor.py` — predictive delay engine
- [ ] `services/satellite_service.py` — change detection (stub first)
- [ ] `services/rag_service.py` — AI copilot (stub first)

## Phase 5 — Portals
- [ ] `api/v1/field.py` — field officer endpoints
- [ ] `api/v1/citizen.py` — public parcel status lookup

## Phase 6 — Data & Polish
- [ ] `utils/synthetic_data_gen.py` — demo dataset generator
- [ ] `core/security.py` + `core/permissions.py` — RBAC
- [ ] Audit log immutability enforcement
- [ ] Seed demo district + project (100–500 parcels)
- [ ] Tests for critical endpoints

---

## Log
- **[Setup]** Backend folder structure created under `bhumi-twin-backend/app/`.
