import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Logo } from '@/components/Logo';
import styles from '@/components/screen.module.css';
import { getSession } from '@/lib/session';
import { parseInitialError, SignupForm } from './SignupForm';
import local from './signup.module.css';

export const metadata: Metadata = { title: 'Sign up as an organiser' };

type Props = { searchParams: Promise<{ error?: string }> };

export default async function SignupPage({ searchParams }: Props) {
  // Already signed in: skip straight to the organiser home.
  const session = await getSession().catch(() => null);
  if (session) redirect('/organiser');

  const { error } = await searchParams;

  return (
    <div className={styles.screen}>
      <header className={styles.header}>
        <div className={`${styles.headerInner} ${local.heroHeader}`}>
          <Logo />
          <div className={local.hero}>
            <h1 className={styles.display}>Run your first event tonight</h1>
            <p>Free events cost nothing. Sign up with just your email.</p>
          </div>
        </div>
      </header>
      <SignupForm initialError={parseInitialError(error)} />
    </div>
  );
}
