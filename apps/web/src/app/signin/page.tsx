import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Logo } from '@/components/Logo';
import styles from '@/components/screen.module.css';
import { getSession } from '@/lib/session';
import { parseInitialError, SignupForm } from '../signup/SignupForm';
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
            <p>We&apos;ll email you a link to sign in. No password needed.</p>
          </div>
        </div>
      </header>
      <SignupForm mode="signin" initialError={parseInitialError(error)} />
    </div>
  );
}
