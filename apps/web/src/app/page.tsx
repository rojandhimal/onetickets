import { redirect } from 'next/navigation';

// Public browse arrives in Sprint 1 (S1-5). Until then the site is the organiser app.
export default function Home() {
  redirect('/signup');
}
