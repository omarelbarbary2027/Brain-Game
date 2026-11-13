# Mnemon Security Specification

## 1. Data Invariants
1. Every document under `/users/{userId}` and its subcollections (`dailyRecords`, `sessions`) is strictly private to `request.auth.uid == userId`.
2. Every written document must set `uid == request.auth.uid`, and `uid` and `createdAt` are immutable once created.
3. No unauthenticated access or cross-user `get` / `list` reads are permitted anywhere in Firestore.
4. All strings enforce strict `.size()` bounds and ID/date patterns (`^[a-zA-Z0-9_\\-]+$`, `^[0-9]{4}-[0-9]{2}-[0-9]{2}$`).
5. All server timestamps (`createdAt`, `updatedAt`) must equal `request.time` at write time; client-forged timestamps are rejected.
6. Subcollection writes (`dailyRecords`, `sessions`) verify parent `/users/{userId}` document existence and ownership.
7. Unknown/shadow fields are rejected via `keys().hasAll(...) && keys().hasOnly(...)` and `affectedKeys().hasOnly(...)`.

## 2. Adversarial "Dirty Dozen" Payloads (Expected: PERMISSION_DENIED)
1. **Unauthenticated read/write**: Read `/users/u1` with `request.auth == null` -> DENIED.
2. **Cross-user read**: Signed-in `u2` reads `/users/u1` -> DENIED.
3. **Cross-user session write**: Signed-in `u2` writes `/users/u1/sessions/s1` with `uid: "u2"` -> DENIED.
4. **UID spoofing**: Signed-in `u1` creates `/users/u1` with `uid: "u2"` -> DENIED.
5. **Shadow field injection**: `u1` creates `/users/u1` with extra field `isAdmin: true` -> DENIED.
6. **Oversized ID poisoning**: `u1` writes `/users/u1/sessions/` with a 200-char ID -> DENIED.
7. **Invalid username chars/length**: `u1` creates `/users/u1` with `username: "a"` (<3 chars) or `"<script>"` -> DENIED.
8. **Client-forged server timestamp**: `u1` creates `/users/u1` with `createdAt: Timestamp(2020-01-01)` != `request.time` -> DENIED.
9. **Immutable field mutation**: `u1` updates `/users/u1` attempting to modify `createdAt` or `uid` -> DENIED.
10. **Invalid score/accuracy value poisoning**: `u1` writes `/users/u1/sessions/s1` with `accuracy: 999` or `score: -50` -> DENIED.
11. **Orphan subcollection write**: `u1` creates `/users/u1/sessions/s1` before `/users/u1` exists -> DENIED.
12. **Blanket list scraping**: Signed-in `u2` queries `/users/u1/sessions` -> DENIED.
