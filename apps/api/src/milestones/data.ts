/**
 * Age-keyed developmental milestone library — the engine behind the per-child
 * timeline. Curated, general guidance (CDC/AAP-style typical ranges); NOT a
 * diagnostic checklist. Every range varies child to child, so the UI frames these
 * as "around X" and Day defers health concerns to a pediatrician.
 *
 * `age_months` is the typical/median age. The timeline computes past/now/upcoming
 * from the child's age; the `milestones` table records what a parent marks done.
 */
export interface MilestoneDef {
  /** Stable slug used as milestone_key in the milestones table. */
  key: string;
  label: string;
  description: string;
  /** One of the 7 app categories (for chip styling on the client). */
  category: "sleep" | "feeding" | "development" | "learning_play" | "emotional" | "behavior" | "safety";
  /** Typical age in months. */
  age_months: number;
  /** Prefilled question for "Ask Day about this". */
  ask_prompt: string;
}

export const MILESTONES: readonly MilestoneDef[] = [
  // First year
  { key: "first_checkup", label: "First well-baby checkup", description: "The first pediatric visit (usually within a few days of birth) checks weight, feeding, and jaundice.", category: "safety", age_months: 0, ask_prompt: "What should I expect at my baby's first checkup?" },
  { key: "social_smile", label: "First social smile", description: "Around 2 months, babies start smiling in response to your face and voice — their first real 'conversation'.", category: "emotional", age_months: 2, ask_prompt: "When do babies start smiling socially, and how can I encourage it?" },
  { key: "head_control", label: "Holds head up", description: "By about 3–4 months most babies hold their head steady during tummy time and when held upright.", category: "development", age_months: 3, ask_prompt: "How can I help my baby build head and neck strength?" },
  { key: "coos_babbles", label: "Coos and babbles", description: "Vowel sounds ('ooh', 'aah') around 3 months grow into babbling ('bababa') by 6 months.", category: "learning_play", age_months: 4, ask_prompt: "How do I encourage my baby's early talking sounds?" },
  { key: "rolls_over", label: "Rolls over", description: "Many babies roll from tummy to back, then back to tummy, around 4–6 months.", category: "development", age_months: 5, ask_prompt: "My baby is starting to roll — what safety changes should I make?" },
  { key: "starts_solids", label: "Ready for solid foods", description: "Around 6 months — when baby has good head control, sits with support, and shows interest in food — is the typical window to start solids alongside milk/formula.", category: "feeding", age_months: 6, ask_prompt: "How do I know my baby is ready for solids, and where do I start?" },
  { key: "sits_unsupported", label: "Sits without support", description: "Independent sitting usually emerges between 6 and 8 months.", category: "development", age_months: 7, ask_prompt: "When should my baby be sitting up on their own?" },
  { key: "responds_to_name", label: "Responds to their name", description: "By 6–9 months babies often turn toward their name and familiar voices.", category: "emotional", age_months: 8, ask_prompt: "Should my baby respond to their name by now?" },
  { key: "object_permanence", label: "Understands object permanence", description: "Around 8 months babies learn things still exist when hidden — why peekaboo becomes magic.", category: "learning_play", age_months: 8, ask_prompt: "What games help my baby's thinking skills right now?" },
  { key: "crawls", label: "Crawls / scoots", description: "Crawling (or scooting/bottom-shuffling) commonly appears around 8–10 months. Some babies skip crawling entirely.", category: "development", age_months: 9, ask_prompt: "My baby isn't crawling yet — is that okay?" },
  { key: "pincer_grasp", label: "Pincer grasp", description: "Picking up small items with thumb and finger around 9–10 months — a sign fine motor skills are developing.", category: "development", age_months: 9, ask_prompt: "What finger-food and play ideas build fine motor skills?" },
  { key: "pulls_to_stand", label: "Pulls to stand", description: "Babies often pull up on furniture around 9–11 months, then start cruising sideways.", category: "development", age_months: 10, ask_prompt: "How do I baby-proof now that my baby is pulling up?" },
  { key: "first_words", label: "First words", description: "A meaningful 'mama', 'dada', or other first word typically arrives around 12 months.", category: "learning_play", age_months: 12, ask_prompt: "When should I expect first words, and how can I help language along?" },
  { key: "waves_bye", label: "Waves bye-bye / gestures", description: "Waving, pointing, and clapping around 9–12 months are early communication wins.", category: "emotional", age_months: 12, ask_prompt: "How do gestures fit into my baby's communication?" },
  { key: "first_dental", label: "First dental visit", description: "The AAP/ADA suggest a first dental visit by the first birthday or within 6 months of the first tooth.", category: "safety", age_months: 12, ask_prompt: "When should my child first see a dentist and how do I prep them?" },

  // Toddler
  { key: "walks", label: "First steps", description: "Independent walking commonly starts between 12 and 15 months, though anywhere up to ~18 months is typical.", category: "development", age_months: 13, ask_prompt: "When do toddlers usually start walking?" },
  { key: "drinks_from_cup", label: "Drinks from an open/straw cup", description: "Around 12–15 months toddlers can start moving from bottle to cup.", category: "feeding", age_months: 14, ask_prompt: "How do I transition my toddler off the bottle?" },
  { key: "follows_instructions", label: "Follows simple instructions", description: "By 12–18 months toddlers can follow one-step directions like 'give me the ball'.", category: "learning_play", age_months: 16, ask_prompt: "How can I tell if my toddler understands me?" },
  { key: "tantrums_begin", label: "Tantrums begin", description: "Big feelings outpace words around 18 months — tantrums are normal and peak in the toddler years.", category: "behavior", age_months: 18, ask_prompt: "How should I handle my toddler's tantrums?" },
  { key: "runs", label: "Runs and climbs", description: "Running, climbing stairs with help, and kicking a ball emerge around 18–24 months.", category: "development", age_months: 20, ask_prompt: "What gross-motor play is good for my busy toddler?" },
  { key: "two_word_phrases", label: "Two-word phrases", description: "By around 24 months many toddlers combine words ('more milk', 'daddy go').", category: "learning_play", age_months: 24, ask_prompt: "My 2-year-old isn't combining words yet — should I worry?" },
  { key: "parallel_play", label: "Plays alongside other kids", description: "Around age 2, toddlers play near (not yet with) peers — 'parallel play' is a normal stage.", category: "emotional", age_months: 24, ask_prompt: "How do I help my toddler learn to play with others?" },
  { key: "potty_readiness", label: "Signs of potty-training readiness", description: "Between 2 and 3 years many children show readiness: staying dry longer, interest in the potty, telling you when they go.", category: "behavior", age_months: 30, ask_prompt: "How do I know my child is ready to potty train?" },

  // Preschool
  { key: "pedals_trike", label: "Pedals a tricycle", description: "Around age 3, children often manage pedaling and steering a trike.", category: "development", age_months: 36, ask_prompt: "What active play suits my 3-year-old?" },
  { key: "turn_taking", label: "Shares and takes turns", description: "Cooperative play, sharing, and turn-taking develop across ages 3–4.", category: "emotional", age_months: 40, ask_prompt: "How do I teach my preschooler to share?" },
  { key: "draws_shapes", label: "Draws shapes and people", description: "By age 4 many children copy simple shapes and draw a person with a few body parts.", category: "learning_play", age_months: 48, ask_prompt: "What activities build my preschooler's drawing and pre-writing skills?" },
  { key: "dresses_self", label: "Dresses with little help", description: "Around age 4 children manage most dressing — big buttons and zippers come a bit later.", category: "development", age_months: 48, ask_prompt: "How can I encourage independence with dressing?" },
  { key: "kindergarten_ready", label: "Kindergarten readiness", description: "Around age 5, look for letters/numbers interest, following routines, and managing separations — not perfection.", category: "learning_play", age_months: 60, ask_prompt: "Is my child ready for kindergarten?" },

  // School age
  { key: "reading_begins", label: "Begins reading", description: "Between 5 and 7, most children move from letter sounds to reading simple words and sentences.", category: "learning_play", age_months: 66, ask_prompt: "How can I support my early reader at home?" },
  { key: "loses_first_tooth", label: "Loses first tooth", description: "The first baby tooth usually wiggles loose around age 6.", category: "development", age_months: 72, ask_prompt: "What should I know about my child losing baby teeth?" },
  { key: "homework_routines", label: "Builds homework & independence", description: "Early school years are about routines, responsibility, and friendships — support without taking over.", category: "behavior", age_months: 84, ask_prompt: "How do I help my child build good homework habits?" },
  { key: "puberty_talks", label: "Early puberty & body talks", description: "Puberty can begin as early as 8–10. Open, ongoing conversations help kids feel prepared and safe.", category: "emotional", age_months: 114, ask_prompt: "How and when should I start talking with my child about puberty?" },

  // Tween / teen
  { key: "social_media", label: "Social media & peer pressure", description: "Around 11–14, navigating online life and peer pressure becomes central. Clear values and trust matter more than rules alone.", category: "behavior", age_months: 144, ask_prompt: "How do I set healthy boundaries around phones and social media?" },
  { key: "independence_teen", label: "Growing independence", description: "Teens push for autonomy — part-time work, more freedom, identity. Stay connected while widening the leash.", category: "emotional", age_months: 192, ask_prompt: "How do I balance freedom and safety with my teenager?" },
];

/** Whole months between a birthdate (YYYY-MM-DD) and now. */
export function ageMonths(birthdate: string, now: Date): number {
  const b = new Date(`${birthdate}T00:00:00Z`);
  let m = (now.getUTCFullYear() - b.getUTCFullYear()) * 12 + (now.getUTCMonth() - b.getUTCMonth());
  if (now.getUTCDate() < b.getUTCDate()) m -= 1;
  return Math.max(0, m);
}
