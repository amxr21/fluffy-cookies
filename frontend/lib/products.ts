/** A card in the "Discover the Collection" section — filled from the
 *  dashboard menu by DiscoverSection. */
export type CollectionItem = {
  id: string;
  name: string;
  description: string;
  image: string;
  href?: string;
};
