import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Logo } from '@/components/Logo';
import styles from '@/components/screen.module.css';
import { getSession } from '@/lib/session';
import { parseInitialError } from '@/lib/auth-errors';
import { SignupForm } from '../signup/SignupForm';
import local from '../signup/signup.module.css';

export const metadata: Metadata = { title: 'Sign in' };

type Props = { searchParams: Promise<{ error?: string }> };

export default async function SigninPage({ searchParams }: Props) {
  const session = await getSession().catch(() => null);
  if (session) redirect('/organiser');

  const { error } = await searchParams;

  return (
    <div className={styles.screen}>
      <header className={styles.header}>
        <div className={`${styles.headerInner} ${local.heroHeader}`}>
          <Logo />
          <div className={local.hero}>
            <h1 className={styles.display}>Welcome back</h1>
            <p>Sign in with Google or get a link by email.</p>
          </div>
        </div>
      </header>
      <SignupForm mode="signin" initialError={parseInitialError(error)} />
    </div>
  );
}
