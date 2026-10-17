import { parseBrowseFilters } from '@/lib/browse';
import { isEventBannerShown } from '@/lib/flags';
import { browseEvents } from '@/lib/public-events';
import { Browse } from './Browse';

type SearchParams = Promise<{
  city?: string | string[];
  when?: string | string[];
  price?: string | string[];
}>;

// S1-5, design artboard 1 Discover: public browse of upcoming published events.
export default async function Home({ searchParams }: { searchParams?: SearchParams } = {}) {
  const filters = parseBrowseFilters(await searchParams);
  const { items } = await browseEvents(filters);
  return <Browse initialFilters={filters} initialItems={items} showBanner={isEventBannerShown()} />;
}
