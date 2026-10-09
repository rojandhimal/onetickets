import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Logo } from '@/components/Logo';
import screen from '@/components/screen.module.css';
import { getSession } from '@/lib/session';
import local from '../../signup/signup.module.css';
import { OrganisationNameForm } from './OrganisationNameForm';

export const metadata: Metadata = { title: 'Name your organisation' };

// New organisers land here after their first sign-in, before the empty organiser home.
export default async function OrganiserSetupPage() {
  const session = await getSession();
  if (!session) redirect('/signin');
  if (session.organisation) redirect('/organiser');

  return (
    <div className={screen.screen}>
      <header className={screen.header}>
        <div className={`${screen.headerInner} ${local.heroHeader}`}>
          <Logo />
          <div className={local.hero}>
            <h1 className={screen.display}>One last thing</h1>
            <p>Tell us who&apos;s running your events.</p>
          </div>
        </div>
      </header>
      <OrganisationNameForm suggestion={session.user.name ?? ''} />
    </div>
  );
}
