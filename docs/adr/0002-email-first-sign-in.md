# 0002. One email-first screen for sign-up and sign-in

- Status: Accepted (PM, 8 Oct 2026)
- Date: 2026-10-08
- Story: S0-3

## Context

The first design asked new organisers for their organisation name and email on one screen. That screen
had to behave differently for an email that already had an account, which tells anyone typing an email
whether it is registered (account enumeration).

## Decision

`/signup` and `/signin` show the same form: email only, or continue with Google. The api always answers
"check your email", whether or not the address has an account. After the magic link, an organiser with
no organisation is asked to name it on `/organiser/setup`.

## Consequences

- The first screen reveals nothing about which emails have accounts.
- Sign-up is one field shorter. New organisers name their organisation one step later.
- `/signup` and `/signin` differ only in copy and in the ABN notice shown on sign-up.
