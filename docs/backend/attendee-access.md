# Attendee ticket access (SEC-4)

SEC-4 implements the backend foundation for S2-4 behind the default-off runtime
`FEATURE_ATTENDEE_TICKETS` flag. Keep it off until S2-4 supplies the request form,
fragment-clearing redemption page and My tickets portal. Existing confirmation links
continue to open one order.

The contract uses `/attendee/magic-link`, `/attendee/magic-link/verify`,
`/attendee/session`, `/attendee/sign-out`, `/attendee/orders` and
`/attendee/orders/:orderId/tickets`. Attendee sessions can read tickets for their verified
email only; they grant no organiser access or release permission. Link tokens expire
in 15 minutes and work once. Session expiry follows the existing platform defaults:
7 days idle, 30 days absolute. The implementation and test evidence will be recorded here
before review.
