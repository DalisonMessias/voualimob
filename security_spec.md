# Security Specification - Vouali Support System

## Data Invariants
1. A support ticket must always have a valid `userId` matching the creator, unless created by a system process.
2. A support message must belong to a valid support ticket.
3. Only the ticket owner or an administrator can read or write to a ticket and its messages.
4. Support settings (AI and hours) can only be modified by administrators.
5. Users cannot modify the `unreadAdmin` flag (it should be restricted to admin writes, but for simplicity in this full-stack app we use Firestore security). Wait, actually users shouldn't be able to mark things as read for admins.

## The "Dirty Dozen" Payloads (Failed Attempts)
1. Creating a ticket for another user's UID.
2. Reading tickets belonging to another user.
3. Deleting tickets (restricted to admin).
4. Updating another user's ticket status.
5. Sending a message to a ticket the user doesn't own.
6. Reading messages from another user's ticket.
7. Modifying `settings/global` as a regular user.
8. Injection in `ticketId` (guarded by `isValidId`).
9. Creating a message with `senderRole: 'ai'` (users should not be able to spoof AI role).
10. Creating a message with `senderRole: 'admin'`.
11. Modifying `createdAt` during update.
12. Updating `supportSettings` in `settings/global` as a non-admin.

## Relationships
- `SupportMessage` (child) -> `SupportTicket` (parent): Access derived from parent ticket ownership.
