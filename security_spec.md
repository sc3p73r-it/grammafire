# GrammaFire Security Specification & Threat Model

This document outlines the security specifications, data invariants, and adversarial payloads tested to ensure Zero-Trust Attribute-Based Access Control (ABAC) for GrammaFire.

## 1. Data Invariants
- **User Integrity**: Users can only create or edit their own profile (`/users/{userId}`). They cannot change their subscription tier (e.g., from `free` to `pro`) through client SDKs. This must be a read-only or server-managed field.
- **Document Ownership & Collaboration**: Only the document owner (`ownerId`) or specified `collaborators` (by email or userId) can view or modify a document.
- **Revision Control**: Document revisions can only be added under a document if the authenticated user has access to that document. Revisions are immutable after creation.
- **Server Timestamps**: `createdAt` and `updatedAt` field tracking must match `request.time` exactly on any changes.

---

## 2. The "Dirty Dozen" Threat Payloads

1. **Privilege Escalation**: A standard user attempts to write to `/users/alice_uid` with `{ tier: "pro", displayName: "Alice" }` to bypass the paid tier paywall.
2. **Identity Spoofing (Owner hijack)**: User `bob` attempts to create a document with `{ ownerId: "alice", title: "Bob's hijacked Doc" }` to charge creation count to Alice.
3. **Dirty Update (Shadow write)**: Bob tries to update Alice's document properties (e.g. content) using client SDK.
4. **Anonymity Bypass**: An unauthenticated user tries to query `/documents` to scrap other users' drafts.
5. **No Verification Write**: A user with an unverified email address attempts to create metadata / documents.
6. **Denial of Wallet (Huge Document ID)**: An attacker attempts to create `/documents/VERY_LONG_GARBAGE_KEY_12345...` with a massive doc ID to trigger Firestore overhead.
7. **Revision Hijack**: Bob tries to write a grammar correction history revision into Alice's document `/documents/alice_doc_id/revisions/rev1`.
8. **Field Injection (Ghost Fields)**: Bob writes to his own document, but injects a forbidden system field `{ adminLock: true }` which isn't in the schema.
9. **Spamming Collaborators List**: Bob updates collaborators with a massive array size `[100,000 values]` to inflate database usage.
10. **Immutable Value Modification**: Alice attempts to change the `createdAt` timestamp of a document during an update.
11. **Malicious ID Poisioning**: Using special strings like `../` or SQL style characters as paths.
12. **Bypassing App Restrictions**: An attacker bypasses UI controls and directly writes raw non-string values to text fields (e.g. `{ content: { fake_map: true } }`).

---

## 3. Test Cases Configuration

Tests verify that:
- Any CRUD operations exceeding the scope are immediately locked with `PERMISSION_DENIED`.
- Email validation (`email_verified == true`) is enforced.
- Key sizes and limits are constrained.
