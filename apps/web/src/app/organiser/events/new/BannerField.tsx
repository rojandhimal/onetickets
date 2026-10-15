'use client';

import {
  BANNER_CONTENT_TYPES,
  type BannerDto,
  EVENT_LIMITS,
  type EventDraftDto,
} from '@onetickets/shared';
import { type ChangeEvent, type PointerEvent, useId, useRef, useState } from 'react';
import { Icon } from '@/components/Icon';
import { removeBanner, uploadBanner } from '@/lib/events-client';
import styles from './wizard.module.css';

type Focus = BannerDto['focus'];

export const BANNER_ERRORS = {
  tooLarge: 'That file is over 10 MB. Try a smaller photo.',
  wrongType: 'Use a JPG, PNG or HEIC image.',
  offline: "We couldn't upload that. Check your connection and try again.",
  failed: "We couldn't upload that. Try again.",
  removeFailed: "We couldn't remove the banner. Try again.",
};

/**
 * Listed without HEIC on purpose: iPhones then hand over a JPEG copy of a HEIC photo, which the
 * api can read. A HEIC file picked on a computer gets the wrong-type error.
 */
const ACCEPT = BANNER_CONTENT_TYPES.join(',');

/** How much of the 2:1 banner's height the widest event page hero (1040 × 320) shows. */
const CROP_WINDOW = Math.round(((2 * 320) / 1040) * 100);

/** Artboard 7 banner: upload or take a photo, then Replace, Adjust crop or Remove. */
export function BannerField({
  event,
  onUploaded,
  onFocusChange,
}: {
  event: Pick<EventDraftDto, 'id' | 'organisationId' | 'banner'>;
  /** The api's copy of the event after an upload or removal. */
  onUploaded: (event: EventDraftDto) => void;
  onFocusChange: (focus: Focus) => void;
}) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<'uploading' | 'removing' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cropOpen, setCropOpen] = useState(false);
  const [focus, setFocus] = useState<Focus>(event.banner?.focus ?? { x: 0.5, y: 0.5 });
  const banner = event.banner;
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;

  async function pick(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!(BANNER_CONTENT_TYPES as readonly string[]).includes(file.type)) {
      setError(BANNER_ERRORS.wrongType);
      return;
    }
    if (file.size > EVENT_LIMITS.bannerBytes) {
      setError(BANNER_ERRORS.tooLarge);
      return;
    }
    setError(null);
    setBusy('uploading');
    const result = await uploadBanner(event, file);
    setBusy(null);
    if (result.ok) {
      setFocus(result.event.banner?.focus ?? { x: 0.5, y: 0.5 });
      onUploaded(result.event);
      return;
    }
    setError(
      result.kind === 'too-large'
        ? BANNER_ERRORS.tooLarge
        : result.kind === 'wrong-type'
          ? BANNER_ERRORS.wrongType
          : BANNER_ERRORS[result.kind],
    );
  }

  async function remove() {
    setError(null);
    setBusy('removing');
    const result = await removeBanner(event);
    setBusy(null);
    if (!result.ok) {
      setError(BANNER_ERRORS.removeFailed);
      return;
    }
    setCropOpen(false);
    onUploaded(result.event);
    // The banner and its buttons are gone; keep keyboard users on the field.
    inputRef.current?.focus();
  }

  function moveFocus(y: number) {
    const next = { x: focus.x, y: Math.round(Math.min(1, Math.max(0, y)) * 100) / 100 };
    setFocus(next);
    onFocusChange(next);
  }

  function pointAt(e: PointerEvent<HTMLDivElement>) {
    const box = e.currentTarget.getBoundingClientRect();
    moveFocus((e.clientY - box.top) / box.height);
  }

  const describedBy = error ? `${errorId} ${hintId}` : hintId;
  const input = (
    <input
      ref={inputRef}
      id={id}
      type="file"
      accept={ACCEPT}
      className="visually-hidden"
      aria-describedby={describedBy}
      aria-invalid={error ? true : undefined}
      disabled={busy !== null}
      onChange={pick}
    />
  );

  return (
    <div className={styles.field}>
      {banner ? (
        <>
          <span className={styles.legend}>Banner image</span>
          {/* Shows the crop the event page uses; the controls below describe it in words. */}
          <img
            src={banner.url}
            alt=""
            className={styles.bannerPreview}
            style={{ objectPosition: `${focus.x * 100}% ${focus.y * 100}%` }}
          />
          <div className={styles.bannerActions}>
            {input}
            <label htmlFor={id} className={styles.bannerAction}>
              Replace
            </label>
            <button
              type="button"
              className={styles.bannerAction}
              aria-expanded={cropOpen}
              aria-controls={`${id}-crop`}
              onClick={() => setCropOpen((o) => !o)}
            >
              Adjust crop
            </button>
            <button
              type="button"
              className={styles.bannerAction}
              disabled={busy !== null}
              onClick={() => void remove()}
            >
              Remove
            </button>
          </div>
          <div id={`${id}-crop`} hidden={!cropOpen} className={styles.crop}>
            <div
              className={styles.cropImage}
              onPointerDown={pointAt}
              onPointerMove={(e) => e.buttons === 1 && pointAt(e)}
              aria-hidden="true"
            >
              <img src={banner.url} alt="" />
              <span
                className={styles.cropWindow}
                style={{ top: `${focus.y * (100 - CROP_WINDOW)}%`, height: `${CROP_WINDOW}%` }}
              />
            </div>
            <label htmlFor={`${id}-y`}>Crop position, top to bottom</label>
            <input
              id={`${id}-y`}
              type="range"
              min={0}
              max={100}
              step={5}
              value={Math.round(focus.y * 100)}
              aria-valuetext={`${Math.round(focus.y * 100)}% from the top`}
              onChange={(e) => moveFocus(Number(e.target.value) / 100)}
            />
          </div>
        </>
      ) : (
        <>
          {input}
          <label htmlFor={id} className={styles.bannerEmpty}>
            <Icon name="image" size={22} />
            <span className={styles.bannerEmptyText}>
              <strong>Add a banner image</strong>
              <span>Upload or take a photo. Without one we use your template colour.</span>
            </span>
          </label>
        </>
      )}
      {error && (
        <span id={errorId} className={styles.fieldError}>
          <Icon name="alert" size={16} />
          {error}
        </span>
      )}
      <span id={hintId} className={styles.hint}>
        2:1 works best (2160 × 1080 px). JPG, PNG or HEIC up to 10 MB.
      </span>
      <span role="status" className="visually-hidden">
        {busy === 'uploading' ? 'Uploading banner…' : busy === 'removing' ? 'Removing banner…' : ''}
      </span>
    </div>
  );
}
