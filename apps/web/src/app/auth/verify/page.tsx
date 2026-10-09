import type { Metadata } from 'next';
import { Logo } from '@/components/Logo';
import styles from '@/components/screen.module.css';
import { VerifyLink } from './VerifyLink';

export const metadata: Metadata = { title: 'Signing you in', robots: { index: false } };

export default function VerifyPage() {
  return (
    <div className={styles.screen}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Logo />
        </div>
      </header>
      <VerifyLink />
    </div>
  );
}
