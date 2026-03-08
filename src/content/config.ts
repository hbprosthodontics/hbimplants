import { defineCollection, z } from 'astro:content';

const blog = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    description: z.string().max(160),
    publishDate: z.date(),
    updatedDate: z.date().optional(),
    targetKeyword: z.string(),
    category: z.enum(['dental-implants', 'all-on-x', 'veneers', 'dentures', 'cosmetic', 'general', 'prosthodontics']),
    author: z.string().default('Huntington Beach Prosthodontics'),
    draft: z.boolean().default(false),
    featuredImage: z.string().optional(),
    featuredImageAlt: z.string().optional(),
    faqs: z.array(z.object({
      question: z.string(),
      answer: z.string(),
    })).optional(),
  }),
});

export const collections = { blog };
