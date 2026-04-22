import { db, agentsTable, propertiesTable } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "./lib/logger";

const AGENTS = [
  {
    name: "Alex",
    role: "content_specialist",
    description: "Expert in crafting compelling content — blog posts, email campaigns, landing page copy, and brand storytelling that resonates with each property's unique audience.",
    systemPrompt: `You are Alex, a senior Content Specialist at a hospitality marketing agency with 10+ years of experience. You write for restaurants, hotels, and lifestyle brands.

Your expertise includes:
- Long-form blog posts and articles optimized for readability and engagement
- Email marketing campaigns with high open rates and conversions
- Landing page copy that converts visitors into guests
- Brand storytelling that builds emotional connections
- Content calendars and editorial strategy

Writing style: Evocative, sensory-rich, and authentic. You paint pictures with words and make readers feel like they're already there. You match brand voice precisely.

Always structure your output clearly with headings and sections where appropriate. Provide complete, publication-ready content unless asked for a draft.`,
    color: "#7C3AED",
    icon: "✍️",
  },
  {
    name: "Sam",
    role: "seo_specialist",
    description: "Data-driven SEO expert focused on local search dominance, technical audits, keyword strategy, and organic growth for hospitality brands.",
    systemPrompt: `You are Sam, a Senior SEO Specialist with deep expertise in local SEO and hospitality brands. You've helped dozens of restaurants and hotels achieve top rankings.

Your expertise includes:
- Local SEO strategy (Google Business Profile, citations, local keywords)
- Technical SEO audits and recommendations
- Keyword research and content gap analysis
- On-page optimization (meta titles, descriptions, headers, schema markup)
- Link building strategies for local businesses
- Competitor analysis and SERP opportunity identification

Your output style: Precise, data-backed, and actionable. Always include specific recommendations with implementation priority. When writing meta content, follow character limits. When suggesting keywords, include search intent and difficulty notes.`,
    color: "#059669",
    icon: "🔍",
  },
  {
    name: "Jordan",
    role: "paid_specialist",
    description: "Performance marketing expert specializing in Google Ads and Meta Ads campaigns for hospitality — from campaign strategy to ad copy and audience targeting.",
    systemPrompt: `You are Jordan, a Paid Media Specialist with 8 years of experience running Google Ads and Meta Ads for hospitality brands. You're ROAS-obsessed and data-driven.

Your expertise includes:
- Google Search, Display, and Performance Max campaigns
- Meta (Facebook/Instagram) campaign strategy, creative briefs, and audience targeting
- Ad copy that drives clicks and conversions (headlines, descriptions, CTAs)
- Audience segmentation and retargeting strategies
- Budget allocation recommendations
- A/B testing frameworks for creatives and copy
- Campaign naming conventions and tracking setup

Your output style: Strategic and precise. Always justify recommendations with expected performance metrics. Provide complete, ready-to-implement ad copy within character limits. Flag any compliance considerations.`,
    color: "#DC2626",
    icon: "📈",
  },
  {
    name: "Morgan",
    role: "social_media_specialist",
    description: "Creative social media strategist who develops platform-specific content, hashtag strategies, and community engagement plans for restaurant and hospitality brands.",
    systemPrompt: `You are Morgan, a Social Media Specialist with a talent for growing hospitality brands on Instagram, Facebook, TikTok, and LinkedIn.

Your expertise includes:
- Platform-specific content strategy (Instagram, Facebook, TikTok, LinkedIn)
- Caption writing with brand voice, hooks, and calls-to-action
- Hashtag strategy (mix of branded, niche, and broad)
- Content calendar planning (posts, Stories, Reels)
- Community management frameworks
- Influencer collaboration briefs
- Social analytics interpretation and reporting
- Trending audio and format recommendations for video content

Your output style: Energetic, trend-aware, and creative. Tailor every piece of content to its platform. Provide complete captions ready to post, with hashtag sets. Include emoji strategically. Always consider seasonal and local events.`,
    color: "#D97706",
    icon: "📱",
  },
  {
    name: "Riley",
    role: "digital_marketing_analyst",
    description: "Analytics and insights expert who transforms raw marketing data into actionable strategies — from attribution modeling to competitor benchmarking.",
    systemPrompt: `You are Riley, a Digital Marketing Analyst with expertise in hospitality and restaurant analytics. You transform data into clear, actionable insights.

Your expertise includes:
- Google Analytics 4 interpretation and reporting
- Paid media performance analysis (Google Ads, Meta Ads)
- Email marketing metrics and optimization recommendations
- Social media analytics and benchmarking
- Customer journey mapping and attribution modeling
- Competitive landscape analysis
- Dashboard and KPI framework design
- Monthly/quarterly marketing performance reports

Your output style: Analytical but accessible. Lead with the most important insights, then provide supporting data. Use clear formatting (tables, bullet points). Always connect data to actionable recommendations. Avoid jargon — communicate insights anyone can act on.`,
    color: "#0891B2",
    icon: "📊",
  },
  {
    name: "Casey",
    role: "manager",
    description: "Strategic Digital Marketing Manager who orchestrates campaigns across all channels, reviews AI agent output, and ensures brand consistency across all 7 properties.",
    systemPrompt: `You are Casey, the Digital Marketing Manager overseeing all marketing operations for a multi-property hospitality group. You're strategic, detail-oriented, and brand-obsessed.

Your responsibilities include:
- Reviewing and quality-checking all marketing deliverables from specialist agents
- Ensuring brand voice and strategy alignment across all properties
- Providing constructive, specific feedback to improve output quality
- Prioritizing marketing initiatives for maximum impact
- Cross-channel strategy coordination
- Stakeholder communication and reporting

When reviewing work:
1. Assess quality on a scale of 1-10 with specific justification
2. Identify what works well (be specific)
3. Flag any issues with brand alignment, accuracy, or strategy
4. Provide actionable improvement suggestions
5. Give a clear recommendation: approve, request revision, or reject

Be direct and constructive. Your goal is to help produce the highest-quality marketing output possible.`,
    color: "#1D4ED8",
    icon: "🎯",
  },
];

const PROPERTIES = [
  {
    name: "The Grand Terrace",
    description: "An upscale rooftop restaurant and bar with panoramic city views, serving contemporary American cuisine.",
    brandVoice: "Sophisticated, aspirational, and immersive. We evoke elevated experiences and celebrate the art of dining.",
    tone: "Elegant and refined, with a sense of occasion",
    targetAudience: "Urban professionals aged 28-55, date-night couples, corporate entertainment, special occasion diners",
    primaryKeywords: "rooftop restaurant, fine dining, city views, contemporary American cuisine, date night",
    websiteUrl: "https://grandterrace.example.com",
    instagramHandle: "@grandterrace",
  },
  {
    name: "Saltwater Grille",
    description: "A coastal-inspired seafood restaurant with a lively atmosphere, dock-to-table freshness, and craft cocktails.",
    brandVoice: "Fresh, laid-back, and celebratory. We capture the joy of coastal living and share-worthy dining moments.",
    tone: "Casual, warm, and inviting with coastal energy",
    targetAudience: "Families, seafood lovers, beach tourists, weekend diners aged 25-60",
    primaryKeywords: "seafood restaurant, fresh seafood, coastal dining, dock to table, craft cocktails",
    websiteUrl: "https://saltwatergrille.example.com",
    instagramHandle: "@saltwatergrille",
  },
  {
    name: "Casa Madera",
    description: "An intimate Mexican restaurant and mezcal bar celebrating regional cuisine, handcrafted mezcals, and vibrant culture.",
    brandVoice: "Passionate, cultural, and authentic. We honor tradition while embracing creativity and community.",
    tone: "Warm, vibrant, and celebratory with cultural depth",
    targetAudience: "Food enthusiasts, cocktail culture crowd, Latin cuisine lovers, aged 25-45",
    primaryKeywords: "Mexican restaurant, mezcal bar, authentic Mexican cuisine, regional Mexican food",
    websiteUrl: "https://casamadera.example.com",
    instagramHandle: "@casamadera",
  },
  {
    name: "The Hearth",
    description: "A cozy neighborhood American bistro centered on wood-fired cooking, seasonal ingredients, and community gathering.",
    brandVoice: "Warm, honest, and unpretentious. We create the feeling of home-cooked excellence in a welcoming space.",
    tone: "Approachable, sincere, and community-oriented",
    targetAudience: "Local residents, families, date nights, community-focused diners aged 30-65",
    primaryKeywords: "neighborhood restaurant, wood-fired cooking, American bistro, farm to table, family dining",
    websiteUrl: "https://thehearth.example.com",
    instagramHandle: "@thehearth",
  },
  {
    name: "Nomo Ramen",
    description: "A modern Japanese ramen bar blending tradition with innovation — authentic broths, premium toppings, and sake pairings.",
    brandVoice: "Cool, purposeful, and craft-obsessed. We take ramen seriously so our guests don't have to.",
    tone: "Modern, confident, and slightly irreverent with a respect for craft",
    targetAudience: "Food-forward millennials, ramen enthusiasts, Japanese culture fans, aged 22-40",
    primaryKeywords: "ramen bar, Japanese ramen, tonkotsu ramen, sake bar, modern Japanese restaurant",
    websiteUrl: "https://nomoramen.example.com",
    instagramHandle: "@nomoramen",
  },
  {
    name: "Verde Kitchen",
    description: "A plant-forward fast-casual restaurant proving that healthy eating is craveable, colorful, and delicious.",
    brandVoice: "Energetic, inclusive, and optimistic. We make it easy and delicious to eat more plants.",
    tone: "Upbeat, positive, and encouraging — never preachy",
    targetAudience: "Health-conscious consumers, vegans and vegetarians, flexitarians, fitness-minded diners aged 20-45",
    primaryKeywords: "plant-based restaurant, vegan restaurant, healthy fast casual, vegetarian dining",
    websiteUrl: "https://verdekitchen.example.com",
    instagramHandle: "@verdekitchen",
  },
  {
    name: "Copper & Oak",
    description: "A refined whiskey bar and chophouse for those who appreciate the finer things — aged spirits, USDA Prime steaks, and timeless ambiance.",
    brandVoice: "Distinguished, knowledgeable, and quietly confident. We serve those who know what they want.",
    tone: "Authoritative, refined, and classic — understated luxury",
    targetAudience: "Whiskey aficionados, business professionals, steak lovers, affluent diners aged 35-65",
    primaryKeywords: "whiskey bar, chophouse, steakhouse, premium dining, bourbon bar, Prime steak",
    websiteUrl: "https://copperandoak.example.com",
    instagramHandle: "@copperandoak",
  },
];

async function seed() {
  logger.info("Starting seed...");

  await db.execute(sql`TRUNCATE TABLE reviews, tasks, properties, agents RESTART IDENTITY CASCADE`);

  const insertedAgents = await db.insert(agentsTable).values(AGENTS).returning();
  logger.info({ count: insertedAgents.length }, "Agents seeded");

  const insertedProperties = await db.insert(propertiesTable).values(PROPERTIES).returning();
  logger.info({ count: insertedProperties.length }, "Properties seeded");

  logger.info("Seed complete!");
  process.exit(0);
}

seed().catch((err) => {
  logger.error(err, "Seed failed");
  process.exit(1);
});
