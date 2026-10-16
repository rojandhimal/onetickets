-- Organisation names are public (the organiser on event pages and link previews) and are now
-- stored as one line of plain text, like event names (SEC-3, QA's #23 review). This cleans the
-- names stored before the api did that.
--
-- pg_temp.plain_line repeats the api's toPlainLine (src/text/plain-text.ts) for this one run; the
-- api stays the only place new text is cleaned, and test/plain-text-sql.int.test.ts checks the two
-- agree. A name that cleans to nothing (it was only markup) becomes "Unnamed organisation", which
-- its owner can see and change.

create function pg_temp.plain_line(input text) returns text
  language plpgsql immutable
  as $$
  declare
    t text := input;
    previous text;
    ws constant text :=
      E'[\\t\\n\\v\\f\\r \\u00A0\\u1680\\u2000-\\u200A\\u2028\\u2029\\u202F\\u205F\\u3000\\uFEFF]';
  begin
    t := regexp_replace(t, E'\r\n?', E'\n', 'g');
    -- Control characters except tab and newline, then zero-width, bidi and BOM characters.
    t := regexp_replace(t, E'[\\x01-\\x08\\x0B\\x0C\\x0E-\\x1F\\x7F-\\x9F]', '', 'g');
    t := regexp_replace(t, E'[\\u200B-\\u200F\\u202A-\\u202E\\u2060-\\u2069\\uFEFF]', '', 'g');
    loop
      previous := t;
      t := regexp_replace(t, '<!--.*?(-->|$)', '', 'g');
      t := regexp_replace(t, '</?[a-zA-Z][^<>]*>', '', 'g');
      if t = previous then
        t := regexp_replace(t, '<(?=[a-zA-Z/!?])', '', 'g');
      end if;
      exit when t = previous;
    end loop;
    t := regexp_replace(t, E'[ \t]+\n', E'\n', 'g');
    t := regexp_replace(t, E'\n{3,}', E'\n\n', 'g');
    -- JavaScript's \s and trim(), spelled out so the result doesn't depend on the locale.
    t := regexp_replace(t, '^' || ws || '+|' || ws || '+$', '', 'g');
    return regexp_replace(t, ws || '+', ' ', 'g');
  end
  $$;

-- FORCE ROW LEVEL SECURITY fences the migration role too, so a backfill policy lets it in for
-- this one update and is dropped in the same transaction (docs/backend/tenancy-and-access.md).
create policy backfill on identity.organisations to current_user using (true) with check (true);

update identity.organisations
   set name = coalesce(nullif(pg_temp.plain_line(name), ''), 'Unnamed organisation'),
       updated_at = now()
 where name is distinct from pg_temp.plain_line(name);

drop policy backfill on identity.organisations;
