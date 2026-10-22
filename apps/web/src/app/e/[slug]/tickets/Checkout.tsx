'use client';

import { useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { HoldDto, PublicEventDto, PublicTicketTypeDto } from '@onetickets/shared';
import {
  checkoutButtonLabel,
  holdNoticeText,
  releaseHold,
  renewHold,
  reserveHold,
  submitFreeOrder,
  validateCheckoutForm,
} from '@/lib/checkout';
import styles from './checkout.module.css';

interface CheckoutProps {
  event: PublicEventDto;
}

export function Checkout({ event }: CheckoutProps) {
  const router = useRouter();
  const alertRef = useRef<HTMLDivElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const emailInputRef = useRef<HTMLInputElement>(null);

  // Form field IDs for accessibility
  const nameId = useId();
  const nameErrorId = useId();
  const emailId = useId();
  const emailErrorId = useId();
  const emailHelpId = useId();
  const optInId = useId();

  // Stable client-side idempotency key for this checkout session (INV-5).
  const [idempotencyKey] = useState(() => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return '00000000-0000-4000-8000-000000000000';
  });

  // Initialise stepper selection:
  // Arriving from the event page with one ticket type preselects 1.
  // With several types, the first available type starts at 1, the rest at 0.
  const [quantities, setQuantities] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    const availableTypes = event.ticketTypes.filter(
      (t) => t.onSale && !t.soldOut && t.spotsLeft > 0,
    );
    for (const t of event.ticketTypes) {
      initial[t.id] = 0;
    }
    if (availableTypes.length > 0) {
      initial[availableTypes[0]!.id] = 1;
    }
    return initial;
  });

  const [activeHold, setActiveHold] = useState<HoldDto | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [optIn, setOptIn] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; email?: string }>({});
  const [submittedOnce, setSubmittedOnce] = useState(false);
  const [isBooking, setIsBooking] = useState(false);
  const [alert, setAlert] = useState<{
    heading?: string;
    message: string;
    isSoldOut?: boolean;
  } | null>(null);

  // Total tickets currently selected across all types
  const totalQuantity = Object.values(quantities).reduce((sum, q) => sum + q, 0);

  // Selected ticket type (for single-type hold reservation)
  const selectedType = event.ticketTypes.find((t) => (quantities[t.id] ?? 0) > 0);

  // Keep a ref to hold credentials for cleanup on unmount
  const activeHoldRef = useRef<HoldDto | null>(null);
  activeHoldRef.current = activeHold;

  // Track user activity on the page to power hold renewal
  const lastActiveRef = useRef(Date.now());
  useEffect(() => {
    const onActivity = () => {
      lastActiveRef.current = Date.now();
    };
    window.addEventListener('focus', onActivity);
    window.addEventListener('keydown', onActivity);
    window.addEventListener('pointerdown', onActivity);
    window.addEventListener('input', onActivity);
    return () => {
      window.removeEventListener('focus', onActivity);
      window.removeEventListener('keydown', onActivity);
      window.removeEventListener('pointerdown', onActivity);
      window.removeEventListener('input', onActivity);
    };
  }, []);

  // Heartbeat: renew hold every 5 minutes while user has focus/activity (up to 20m total)
  useEffect(() => {
    const interval = setInterval(
      async () => {
        const hold = activeHoldRef.current;
        if (!hold) return;
        const inactiveMs = Date.now() - lastActiveRef.current;
        // Only renew if user was active within the last 5 minutes
        if (inactiveMs < 5 * 60 * 1000) {
          await renewHold(hold.id, hold.token);
        }
      },
      5 * 60 * 1000,
    );
    return () => clearInterval(interval);
  }, []);

  // Manage hold when quantity changes
  useEffect(() => {
    let cancelled = false;

    async function syncHold() {
      if (totalQuantity === 0) {
        if (activeHoldRef.current) {
          const holdToRelease = activeHoldRef.current;
          setActiveHold(null);
          await releaseHold(holdToRelease.id, holdToRelease.token);
        }
        return;
      }

      if (!selectedType) return;

      const previousHold = activeHoldRef.current;
      const res = await reserveHold({
        ticketTypeId: selectedType.id,
        quantity: totalQuantity,
        previousHoldId: previousHold?.id,
        previousToken: previousHold?.token,
      });

      if (cancelled) return;

      if (res.ok) {
        setActiveHold(res.hold);
      } else if (res.status === 409 && typeof res.spotsLeft === 'number') {
        const spots = res.spotsLeft;
        const noun = spots === 1 ? 'ticket was' : 'tickets were';
        setQuantities((prev) => ({ ...prev, [selectedType.id]: spots }));
        setAlert({
          heading: `Only ${spots} ${selectedType.name} ${noun} left.`,
          message: `We've changed your order to ${spots}. Check it and try again.`,
        });
        setTimeout(() => alertRef.current?.focus(), 50);
      }
    }

    void syncHold();

    return () => {
      cancelled = true;
    };
  }, [totalQuantity, selectedType?.id]);

  // Release hold on page leave/unmount
  useEffect(() => {
    return () => {
      if (activeHoldRef.current) {
        void releaseHold(activeHoldRef.current.id, activeHoldRef.current.token);
      }
    };
  }, []);

  const handleStepperChange = (type: PublicTicketTypeDto, delta: number) => {
    setAlert(null);
    const current = quantities[type.id] ?? 0;
    const maxAvailable = Math.min(type.maxPerOrder, type.spotsLeft);
    const next = Math.max(0, Math.min(maxAvailable, current + delta));

    // In S2 free checkout, order is for one selected ticket type
    const updated: Record<string, number> = {};
    for (const t of event.ticketTypes) {
      updated[t.id] = t.id === type.id ? next : 0;
    }
    setQuantities(updated);
  };

  const handleBlur = (field: 'name' | 'email') => {
    if (!submittedOnce) return;
    const formErrors = validateCheckoutForm({ name, email });
    setErrors((prev) => ({ ...prev, [field]: formErrors[field] }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isBooking || totalQuantity === 0) return;

    setSubmittedOnce(true);
    const formErrors = validateCheckoutForm({ name, email });
    setErrors(formErrors);

    if (formErrors.name) {
      nameInputRef.current?.focus();
      return;
    }
    if (formErrors.email) {
      emailInputRef.current?.focus();
      return;
    }

    setIsBooking(true);
    setAlert(null);

    // If hold is missing or lapsed, try to re-reserve silently first
    let hold = activeHoldRef.current;
    if (!hold && selectedType) {
      const res = await reserveHold({
        ticketTypeId: selectedType.id,
        quantity: totalQuantity,
      });
      if (res.ok) {
        hold = res.hold;
        setActiveHold(hold);
      } else {
        setIsBooking(false);
        const spots = res.spotsLeft ?? 0;
        if (spots === 0) {
          setAlert({
            heading: 'Those tickets have just gone.',
            message: 'Nothing was booked.',
            isSoldOut: true,
          });
        } else {
          const noun = spots === 1 ? 'ticket was' : 'tickets were';
          setQuantities((prev) => ({ ...prev, [selectedType.id]: spots }));
          setAlert({
            heading: `Only ${spots} ${selectedType.name} ${noun} left.`,
            message: `We've changed your order to ${spots}. Check it and try again.`,
          });
        }
        setTimeout(() => alertRef.current?.focus(), 50);
        return;
      }
    }

    if (!hold) {
      setIsBooking(false);
      return;
    }

    // Submit the free order
    const result = await submitFreeOrder({
      eventId: event.id,
      holdId: hold.id,
      holdToken: hold.token,
      idempotencyKey,
      attendeeName: name.trim(),
      attendeeEmail: email.trim(),
      optInOrganiser: optIn,
    });

    if (result.ok) {
      // Clear hold ref so unmount cleanup does not release the converted hold
      activeHoldRef.current = null;
      router.push(`/tickets/${encodeURIComponent(result.order.orderRef)}`);
      return;
    }

    setIsBooking(false);

    if (result.status === 409 && typeof result.spotsLeft === 'number' && selectedType) {
      const spots = result.spotsLeft;
      const noun = spots === 1 ? 'ticket was' : 'tickets were';
      setQuantities((prev) => ({ ...prev, [selectedType.id]: spots }));
      setAlert({
        heading: `Only ${spots} ${selectedType.name} ${noun} left.`,
        message: `We've changed your order to ${spots}. Check it and try again.`,
      });
      setTimeout(() => alertRef.current?.focus(), 50);
    } else if (result.status === 409 || result.status === 410) {
      setAlert({
        heading: 'Those tickets have just gone.',
        message: 'Nothing was booked.',
        isSoldOut: true,
      });
      setTimeout(() => alertRef.current?.focus(), 50);
    } else {
      setAlert({
        message:
          "We couldn't reach OneTickets. Check your connection and try again. Nothing was booked twice.",
      });
      setTimeout(() => alertRef.current?.focus(), 50);
    }
  };

  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <header className={styles.header}>
          <Link href={`/e/${encodeURIComponent(event.slug)}`} className={styles.backLink}>
            ← {event.name}
          </Link>
          <h1 className={styles.title}>Get your tickets</h1>
        </header>

        {alert && (
          <div
            ref={alertRef}
            role="alert"
            tabIndex={-1}
            className={styles.alertBanner}
            aria-live="assertive"
          >
            {alert.heading && <strong>{alert.heading}</strong>}
            <div>{alert.message}</div>
            {alert.isSoldOut && (
              <Link href={`/e/${encodeURIComponent(event.slug)}`} className={styles.alertLink}>
                Back to the event
              </Link>
            )}
          </div>
        )}

        {totalQuantity > 0 && (
          <div role="status" className={styles.holdNotice}>
            {holdNoticeText(totalQuantity)}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <section className={styles.card} aria-labelledby="tickets-heading">
            <h2 id="tickets-heading" className={styles.sectionHeading}>
              Tickets
            </h2>
            <ul className={styles.ticketList}>
              {event.ticketTypes.map((type) => {
                const isSoldOut = type.soldOut || type.spotsLeft <= 0;
                const qty = quantities[type.id] ?? 0;
                const maxAvailable = Math.min(type.maxPerOrder, type.spotsLeft);

                return (
                  <li key={type.id} className={styles.ticketRow}>
                    <div className={styles.ticketInfo}>
                      <div className={styles.ticketName}>{type.name}</div>
                      <div className={styles.ticketMeta}>
                        {isSoldOut
                          ? 'Free · all taken'
                          : `Free · up to ${type.maxPerOrder} per order`}
                      </div>
                    </div>

                    {isSoldOut ? (
                      <span className={styles.soldOutChip}>Sold out</span>
                    ) : (
                      <div className={styles.stepper}>
                        <button
                          type="button"
                          className={styles.stepperButton}
                          onClick={() => handleStepperChange(type, -1)}
                          disabled={qty <= 0 || isBooking}
                          aria-label={`Decrease quantity for ${type.name}`}
                        >
                          −
                        </button>
                        <span className={styles.stepperCount} aria-live="polite">
                          {qty}
                        </span>
                        <button
                          type="button"
                          className={styles.stepperButton}
                          onClick={() => handleStepperChange(type, 1)}
                          disabled={qty >= maxAvailable || isBooking}
                          aria-label={`Increase quantity for ${type.name}`}
                        >
                          +
                        </button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>

          <section className={styles.card} aria-labelledby="details-heading">
            <h2 id="details-heading" className={styles.sectionHeading}>
              Who's the ticket for?
            </h2>
            <p className={styles.sectionHint}>Both fields are required.</p>

            <div className={styles.fieldGroup}>
              <label htmlFor={nameId} className={styles.label}>
                Name
              </label>
              <input
                ref={nameInputRef}
                id={nameId}
                type="text"
                name="name"
                autoComplete="name"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }));
                }}
                onBlur={() => handleBlur('name')}
                className={`${styles.input} ${errors.name ? styles.inputError : ''}`}
                aria-invalid={!!errors.name}
                aria-describedby={errors.name ? nameErrorId : undefined}
                disabled={isBooking}
                required
              />
              {errors.name && (
                <div id={nameErrorId} className={styles.fieldError} role="alert">
                  {errors.name}
                </div>
              )}
            </div>

            <div className={styles.fieldGroup}>
              <label htmlFor={emailId} className={styles.label}>
                Email address
              </label>
              <input
                ref={emailInputRef}
                id={emailId}
                type="email"
                name="email"
                autoComplete="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (errors.email) setErrors((prev) => ({ ...prev, email: undefined }));
                }}
                onBlur={() => handleBlur('email')}
                className={`${styles.input} ${errors.email ? styles.inputError : ''}`}
                aria-invalid={!!errors.email}
                aria-describedby={errors.email ? `${emailErrorId} ${emailHelpId}` : emailHelpId}
                disabled={isBooking}
                required
              />
              {errors.email && (
                <div id={emailErrorId} className={styles.fieldError} role="alert">
                  {errors.email}
                </div>
              )}
              <div id={emailHelpId} className={styles.reassurance}>
                We'll email your tickets here. No account or password needed.
              </div>
            </div>

            <div className={styles.optInRow}>
              <input
                id={optInId}
                type="checkbox"
                checked={optIn}
                onChange={(e) => setOptIn(e.target.checked)}
                className={styles.checkbox}
                disabled={isBooking}
              />
              <label htmlFor={optInId} className={styles.optInLabel}>
                Send me news about future events from {event.organiser.name} (optional)
              </label>
            </div>
          </section>

          <section className={styles.card} aria-label="Order summary">
            <div className={styles.summaryRow}>
              <span>Total</span>
              <span>Free</span>
            </div>

            <button
              type="submit"
              className={styles.submitButton}
              disabled={totalQuantity === 0 || isBooking}
              aria-disabled={isBooking}
            >
              {checkoutButtonLabel(totalQuantity, isBooking)}
            </button>

            <p className={styles.footnote}>
              Free tickets can be released any time before the event. (Use the organiser's policy
              when it differs.)
            </p>
          </section>
        </form>
      </div>
    </main>
  );
}
