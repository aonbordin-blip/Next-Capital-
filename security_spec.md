# Security Specification & Red-Team Audit Plan (Phase 0)

## 1. Data Invariants
1. **Strict Ownership & PII Isolation**:
   - `/users/{userId}` holds verified user email and officer preferences. Only the authenticated, email-verified user whose `request.auth.uid == userId` may `get`, `create`, or `update`. `list` and `delete` are denied (`list` prevents user directory enumeration).
   - `/users/{userId}/cases/{caseId}` holds customer names, phone numbers, income, locations, and lease records. Only the verified owner (`request.auth.uid == userId`) whose parent `/users/{userId}` doc exists (or for `create`/`update`, `ownerUid == request.auth.uid`) may read, list (`resource.data.ownerUid == request.auth.uid`), create, update, or delete.
2. **Email Verification Enforcement**:
   - All read and write operations require `request.auth != null && request.auth.token.email_verified == true`.
3. **Immutable Ownership & Temporal Integrity**:
   - `ownerUid`, `id`, `recordCreatedAt`, and `createdAt` cannot be modified after document creation.
   - Server `createdAt` must equal `request.time` on create; server `updatedAt` must equal `request.time` on create and update.
4. **Strict Key & Size Enforcement**:
   - Every string length, number range, enum value, and nested map size is bounded to prevent shadow fields, type poisoning, and 1MB payload exhaustion.
   - `approvalDoc` stores metadata only (`name`, `size`, `uploadedAt`, optional `type`); base64 binary `dataUrl` blobs are never allowed in Firestore.

## 2. Dirty Dozen Attack Payloads (Must All Fail with PERMISSION_DENIED)
1. **Unauthenticated Read**: Read `/users/u1/cases/case-1` with `request.auth == null`.
2. **Unverified Email Write**: Create `/users/u1/cases/case-1` with `email_verified: false`.
3. **Cross-Tenant Read**: User `u2` reads `/users/u1/cases/case-1`.
4. **Cross-Tenant List**: User `u2` lists `/users/u1/cases` without owning `u1`.
5. **User Enumeration**: Any user lists `/users`.
6. **Identity Spoofing on Create**: User `u1` creates `/users/u1/cases/case-1` with `ownerUid: "u2"`.
7. **ID Poisoning**: User `u1` creates `/users/u1/cases/bad..id$123` (fails `isValidId`).
8. **Shadow Field Injection**: Create case with extra ghost field `isAdmin: true`.
9. **Immutable Field Tampering**: Update `ownerUid`, `id`, `createdAt`, or `recordCreatedAt` on existing case.
10. **Forged Server Timestamp**: Create/update case with client `Date.now()` instead of `request.time` in `createdAt`/`updatedAt`.
11. **String / Map Exhaustion (Value Poisoning)**: Inject 5,000-char `googleMapsLocation` or oversized `snapshot` map.
12. **Type Poisoning**: Set `vehiclePrice: "free"` or invalid `proposalKey: "hacked"`.
