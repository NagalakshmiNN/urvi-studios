// The homepage's "How Will You Wear It?" cards (formerly a purely
// decorative "Who Are You Today?" persona grid that didn't link anywhere —
// this is what replaced it). Each entry is a real, clickable styling
// guide keyed to an occasion — "how do I dress for X" — rather than an
// abstract personality type, with a curated product edit pulled straight
// from the matching category so the guide is actually shoppable, not just
// a blog post.
//
// To add a new occasion: add an entry here (pick an existing category
// slug from src/db/seed.ts / Admin → Categories to source products from),
// then add its card to the homepage grid in src/app/page.tsx. No schema
// change needed — this deliberately reuses the existing category
// structure rather than a new per-product tagging system, so it works
// with the catalog on day one.

export type StyleGuide = {
  slug: string;
  mark: string; // the circle letter on the homepage card
  cardTitle: string;
  cardSubtitle: string;
  eyebrow: string;
  heading: string;
  intro: string;
  tips: { title: string; body: string }[];
  categorySlug: string; // which category's products this guide features
  closingNote: string;
};

export const STYLE_GUIDES: StyleGuide[] = [
  {
    slug: "the-big-meeting",
    mark: "M",
    cardTitle: "The Big Meeting",
    cardSubtitle: "Boardroom-ready, in minutes",
    eyebrow: "Style Guide",
    heading: "How to Dress for the Big Meeting",
    intro:
      "The kind of meeting where you want the room to remember what you said, not what you wore — and the easiest way there is structure. A sharp shoulder and a clean line do a lot of the talking before you say a word.",
    tips: [
      { title: "Start with structure", body: "A blazer or a co-ord set holds its shape through a long day — pick one over anything that needs constant adjusting." },
      { title: "One statement, not three", body: "Let the tailoring be the statement. Keep jewellery and prints minimal so nothing competes with it." },
      { title: "Colour with intent", body: "Olive, earth and ivory read as considered, not corporate-beige. Save the brights for after 6pm." },
      { title: "Shoes you can actually walk in", body: "Between the parking lot and the boardroom, comfort is part of confidence." },
    ],
    categorySlug: "office-wear",
    closingNote: "The edit below is built entirely from our Office Wear line — every piece cut for a room that's paying attention.",
  },
  {
    slug: "ganesh-chaturthi",
    mark: "G",
    cardTitle: "Ganesh Chaturthi",
    cardSubtitle: "Festive, grounded, glowing",
    eyebrow: "Style Guide",
    heading: "How to Dress for Ganesh Chaturthi",
    intro:
      "A festival that moves between the puja room, the pandal, and family visits over one long day — the outfit has to keep up. This is where richness meets ease: fabrics that photograph beautifully and still let you sit cross-legged on the floor without a second thought.",
    tips: [
      { title: "Drape over structure", body: "Sarees and pre-draped sets move with you through a day of aarti, prasad and photographs — easier than anything fitted at the waist." },
      { title: "Zari catches the diya light", body: "Gold and antique-gold detailing genuinely glow under lamplight — it's not just for the camera." },
      { title: "Layer for the whole day", body: "A lighter dupatta or stole means you're comfortable at home in the morning and put-together by the visarjan procession." },
      { title: "Comfort is not optional", body: "You'll be on your feet more than you plan to be — choose the fabric you'd actually want to wear for eight hours, not just eight photos." },
    ],
    categorySlug: "festive-wear",
    closingNote: "Pulled from our Festive Wear line — pieces built for exactly this kind of long, joyful day.",
  },
  {
    slug: "wedding-guest",
    mark: "W",
    cardTitle: "Wedding Guest",
    cardSubtitle: "Never outshine the bride — but close",
    eyebrow: "Style Guide",
    heading: "How to Dress as a Wedding Guest",
    intro:
      "There's a real skill to wedding-guest dressing: festive enough for the dance floor, refined enough for the family photos, and never in danger of upstaging the couple. Fusion pieces are the sweet spot — Indian richness with a western silhouette that photographs from every angle.",
    tips: [
      { title: "Check the dress code first", body: "A quick ask about the couple's colour theme saves you from clashing with the mandap or the bridal party." },
      { title: "Pick your one drama piece", body: "Cape sleeves, a dramatic drape, a bold sleeve — choose one focal point and keep the rest of the outfit quiet around it." },
      { title: "Dance-floor tested", body: "If you can't move your arms above your head in the trial fitting, you won't be able to on the night either." },
      { title: "Pack a flat pair for later", body: "Even the best heels get retired by the second function — a pretty juttis or flats swap keeps the night going." },
    ],
    categorySlug: "fusion-edit",
    closingNote: "From our Fusion Edit — Indian craft, western ease, built for exactly this kind of night.",
  },
  {
    slug: "weekend-off-duty",
    mark: "O",
    cardTitle: "Weekend Off-Duty",
    cardSubtitle: "Effortless, unhurried, still you",
    eyebrow: "Style Guide",
    heading: "How to Dress for a Weekend Off-Duty",
    intro:
      "No meetings, no functions — just errands, a market run, brunch with the girls. This is the easiest outfit of the week to get wrong by overdressing it, and the easiest to get right with one good wrap dress and shoes you don't think about.",
    tips: [
      { title: "One-and-done pieces", body: "A wrap dress or shift needs zero styling decisions — pull it on and you're already dressed." },
      { title: "Breathable fabric, honestly", body: "Cotton and linen forgive a long day outdoors in a way stiffer fabrics don't." },
      { title: "Pockets are a feature", body: "If it can hold your phone and keys, you'll actually reach for it on a Tuesday, not just a Sunday." },
      { title: "Let print do the work", body: "A botanical or tiered print needs almost no accessorising — that's the whole point of off-duty." },
    ],
    categorySlug: "casual-wear",
    closingNote: "Straight from our Casual Wear line — made for the days with nowhere in particular to be.",
  },
  {
    slug: "festive-mornings",
    mark: "F",
    cardTitle: "Festive Mornings",
    cardSubtitle: "Puja at home, family at the door",
    eyebrow: "Style Guide",
    heading: "How to Dress for Festive Mornings at Home",
    intro:
      "Not every festival occasion calls for the full nine yards — sometimes it's a puja at home, family dropping by, a small gathering that still deserves to feel special. A well-made kurta set does exactly that: festive without the formality.",
    tips: [
      { title: "Block print over embellishment", body: "Hand block-printed cotton feels celebratory without asking you to sit carefully all day." },
      { title: "Straight-cut for ease", body: "You'll be moving between the kitchen, the puja corner and the door all morning — a straight-cut kurta with side slits moves with you." },
      { title: "Gold thread, used sparingly", body: "A little embroidery at the yoke or neckline reads festive in photos without feeling like a costume for a Tuesday morning." },
      { title: "Keep three on rotation", body: "A kurta set worth repeating is worth owning in more than one colour — this is the piece you'll actually reach for most." },
    ],
    categorySlug: "kurta",
    closingNote: "Featuring our Kurta edit — the pieces every URVI woman keeps more than one of.",
  },
  {
    slug: "college-sweetheart",
    mark: "C",
    cardTitle: "College Sweetheart",
    cardSubtitle: "Cute, easy, unmistakably you",
    eyebrow: "Style Guide",
    heading: "How to Dress Like a College Sweetheart",
    intro:
      "Between lectures, canteen runs and the walk across campus, this is dressing for a day that moves fast and doesn't wait for you to fuss over it. Easy, pretty, a little playful — the whole point is looking put-together without looking like you tried.",
    tips: [
      { title: "Balance the proportions", body: "A short top works best paired with something with more coverage below — high-waisted denim, a flowy skirt, wide-leg pants." },
      { title: "Let the print flirt for you", body: "A cute floral or check top needs almost no accessorising — it's already doing the talking." },
      { title: "One light layer, always", body: "A denim jacket or an oversized shirt tied at the waist covers you for the AC classroom and the sunny quad in the same day." },
      { title: "Sneakers over heels", body: "Comfort wins every single campus day — save the heels for the evening plans after." },
    ],
    categorySlug: "short-tops",
    closingNote: "Every piece here comes straight from our Short Tops line — made for days that move fast and still look good.",
  },
  {
    slug: "office-stories",
    mark: "S",
    cardTitle: "Office Stories",
    cardSubtitle: "Every day at your desk, dressed right",
    eyebrow: "Style Guide",
    heading: "How to Dress for Office Stories, Day After Day",
    intro:
      "Not every office day is the big meeting — most of them are just Tuesday. This is about a work wardrobe that actually carries you through the whole week without a fresh outfit decision every single morning.",
    tips: [
      { title: "Build around three pieces you can remix", body: "A blazer, a good pair of trousers, and a versatile top rotate into a week's worth of different-feeling outfits." },
      { title: "One third piece changes everything", body: "A jacket, stole or waistcoat can turn the same base outfit into something new — cheaper than buying five separate looks." },
      { title: "Keep flats at your desk", body: "For the days your feet vote no on heels by 3pm — no one's ever regretted having a backup pair around." },
      { title: "Let accessories carry the personality", body: "Keep the clothes classic and considered; let a bold earring or a good bag be the part that's unmistakably yours." },
    ],
    categorySlug: "office-wear",
    closingNote: "Pulled from our Office Wear line — built for the whole week, not just the one big day.",
  },
  {
    slug: "meeting-the-parents",
    mark: "P",
    cardTitle: "Meeting the Parents",
    cardSubtitle: "Make the right impression, effortlessly",
    eyebrow: "Style Guide",
    heading: "How to Dress for Meeting the Parents",
    intro:
      "There's a particular kind of nervous that comes with this one — you want to look put-together and respectful, without looking like you're performing for the occasion. The right outfit does the quiet work of putting everyone at ease, starting with you.",
    tips: [
      { title: "Let the fabric do the modesty", body: "A good drape that sits well without needing constant adjusting reads as effortless, not overthought." },
      { title: "Choose warm over bold", body: "Earth tones and soft pastels feel welcoming in a way that sharp brights don't — save the statement colour for later." },
      { title: "Skip anything too fitted or too bare", body: "This is a first-impression outfit, not a night-out one — comfort and coverage read as confidence here." },
      { title: "A dupatta or stole earns its place", body: "It's the easiest way to look considered without looking like you overdressed for the occasion." },
    ],
    categorySlug: "fusion-edit",
    closingNote: "From our Fusion Edit — polished, respectful, and genuinely comfortable to sit through a long lunch in.",
  },
  {
    slug: "evening-dates",
    mark: "D",
    cardTitle: "Evening Dates",
    cardSubtitle: "Relaxed, romantic, ready by seven",
    eyebrow: "Style Guide",
    heading: "How to Dress for an Evening Date",
    intro:
      "Somewhere between trying too hard and not trying at all is the actual sweet spot for a date night outfit — pretty, comfortable enough to forget you're wearing it, and easy to get ready in without a two-hour production.",
    tips: [
      { title: "Let one dress do the deciding", body: "A well-cut dress does the work of an entire outfit's worth of decisions in one piece — no separates to coordinate." },
      { title: "Match the shoe to the plan", body: "Block heels or flats for anywhere with walking involved; save the heels for a sit-down dinner." },
      { title: "One statement piece of jewellery is enough", body: "A good earring or a fine chain finishes the look — more than that starts to compete with it." },
      { title: "Carry small", body: "A little bag keeps your hands free and the whole look lighter — leave the everyday tote at home." },
    ],
    categorySlug: "casual-wear",
    closingNote: "From our Casual Wear line — easy enough to actually enjoy your evening in.",
  },
  {
    slug: "festive-mood",
    mark: "V",
    cardTitle: "Festive Mood",
    cardSubtitle: "When every day feels like a celebration",
    eyebrow: "Style Guide",
    heading: "How to Dress When You're in a Festive Mood",
    intro:
      "Not every festive outfit needs a festival on the calendar to justify it — sometimes you just want to dress like something good is happening. This is about carrying that feeling into an outfit, any day it shows up.",
    tips: [
      { title: "Let colour lead", body: "Jewel tones and soft metallics feel festive on their own, even without heavy embellishment doing the work." },
      { title: "Mix one rich texture with a plain base", body: "A richly worked piece against something simple reads elevated — pairing two busy pieces just competes with itself." },
      { title: "Comfort still matters", body: "Festive doesn't have to mean restrictive — the best festive pieces are ones you actually want to keep wearing past the first hour." },
      { title: "Repeat your favourites", body: "A piece that made you feel good once is always worth reaching for again — festive dressing isn't a one-wear rule." },
    ],
    categorySlug: "festive-wear",
    closingNote: "From our Festive Wear line — for the days that feel like a celebration, calendar or not.",
  },
];

export function getStyleGuide(slug: string): StyleGuide | undefined {
  return STYLE_GUIDES.find((g) => g.slug === slug);
}
