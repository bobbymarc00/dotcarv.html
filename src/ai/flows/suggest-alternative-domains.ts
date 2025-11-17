'use server';

/**
 * @fileOverview A flow to suggest alternative domain names using AI, considering brand fit and semantic similarity.
 *
 * - suggestAlternativeDomains - A function that suggests alternative domain names.
 * - SuggestAlternativeDomainsInput - The input type for the suggestAlternativeDomains function.
 * - SuggestAlternativeDomainsOutput - The return type for the suggestAlternativeDomains function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SuggestAlternativeDomainsInputSchema = z.object({
  desiredDomain: z
    .string()
    .describe('The domain name the user initially wanted to claim.'),
});
export type SuggestAlternativeDomainsInput = z.infer<
  typeof SuggestAlternativeDomainsInputSchema
>;

const SuggestAlternativeDomainsOutputSchema = z.object({
  suggestedDomains: z
    .array(z.string())
    .describe('An array of suggested alternative domain names.'),
});
export type SuggestAlternativeDomainsOutput = z.infer<
  typeof SuggestAlternativeDomainsOutputSchema
>;

export async function suggestAlternativeDomains(
  input: SuggestAlternativeDomainsInput
): Promise<SuggestAlternativeDomainsOutput> {
  return suggestAlternativeDomainsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'suggestAlternativeDomainsPrompt',
  input: {schema: SuggestAlternativeDomainsInputSchema},
  output: {schema: SuggestAlternativeDomainsOutputSchema},
  prompt: `The user wants to register the domain name {{desiredDomain}}.carv but it is unavailable. Suggest five alternative domain names that are similar in meaning and brand fit to {{desiredDomain}}, returning only the domain name without the .carv suffix. Return them as a JSON array of strings. Do not return any other text.`,
});

const suggestAlternativeDomainsFlow = ai.defineFlow(
  {
    name: 'suggestAlternativeDomainsFlow',
    inputSchema: SuggestAlternativeDomainsInputSchema,
    outputSchema: SuggestAlternativeDomainsOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
