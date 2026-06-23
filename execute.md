Read @plutus_v1_plan.md fully. Your source of truth is Section 14 (Implementation Phases).



## Rules

- After completing each task, immediately mark it done in plan.md: `- [x]`

- If a session ends mid-phase, the next session reads plan.md, finds the first `- [ ]` in the current phase, and resumes there

- Do NOT proceed to Phase 2 unless explicitly told to



## Phase 1 — Execute Now



Spawn parallel sub-agents for independent workstreams. Suggested split:



**Agent: backend-core**

- Scaffold backend/ structure per Section 4

- All SQLAlchemy models (Section 5) with user_id FK

- Alembic initial migration

- core/security.py — bcrypt, JWT, token hash, SameSite cookie

- core/rate_limiter.py — slowapi

- Security headers middleware

- seed_data.py — default categories + subcategories (Section 9)



**Agent: backend-auth**

(depends on backend-core models — start once models are done)

- All auth endpoints (register, login, refresh+rotation, logout, me, update-me, delete-all-sessions)

- get_current_user + get_owned_resource dependencies

- Bank Accounts CRUD

- Credit Cards CRUD

- Basic Transactions CRUD + ownership check



**Agent: frontend**

- Scaffold frontend/ structure per Section 4

- tailwind.config.js with full Midnight·Gold token set (Section 3.6)

- theme.css with CSS variables for dark + light themes (Sections 3.2 + 3.3)

- index.html with Playfair Display + Inter fonts + iOS meta tags

- AuthContext + Axios interceptors (JWT in memory, refresh via httpOnly cookie) + logout cache clear

- Protected route guard

- Login + Register pages

- Basic Dashboard (numbers only, no charts yet)



## On completion of Phase 1

- All Phase 1 checkboxes in plan.md should be `- [x]`

- Give a summary of what was built and what environment variables need to be set

- Stop. Do not begin Phase 2.