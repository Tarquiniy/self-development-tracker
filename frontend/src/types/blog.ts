export type Post = {
  slug: string;
  title: string;
  excerpt?: string;
  featured_image?: string;
  og_image?: string;
  published_at: string;
  categories?: { title: string; slug: string }[];
  reading_time?: number;
};

export type Category = {
  id: number;
  title: string;
  slug: string;
  description?: string;
};

export type Tag = {
  id: number;
  title: string;
  slug: string;
};