# My tickets (S2-4)

S2-4 connects the merged SEC-4 attendee API to a runtime-gated My tickets frontend.
The first slice covers email lookup, secure fragment redemption, Upcoming/Past orders,
QR display and sign-out. The attendee session remains read-only. Ticket release needs
tegs's decision on separate authorisation and is not enabled by this claim.

Use the existing `FEATURE_ATTENDEE_TICKETS` flag on both API and web. The portal must
not persist attendee credentials or ticket data in browser storage. Full implementation
notes and test evidence will be added before review.
