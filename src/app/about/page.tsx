import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";

const HER_EDITIONS = [
  { title: "The Leader", desc: "Structured, sharp, in control" },
  { title: "Everyday Woman", desc: "Effortless, easy, unhurried" },
  { title: "Social Butterfly", desc: "Festive, radiant, celebratory" },
  { title: "The Minimalist", desc: "Clean, considered, quiet" },
  { title: "The Dreamer", desc: "Soft, fluid, romantic" },
];

export default function AboutPage() {
  return (
    <>
      <SiteHeader active="Our Story" />

      <section className="hero" style={{ padding: 0 }}>
        <div className="hero-inner" style={{ padding: "80px 24px" }}>
          <div className="eyebrow" style={{ color: "var(--gold-light)" }}>Our Story</div>
          <h1>Two women.<br />One idea of confidence.</h1>
        </div>
      </section>

      <section className="section">
        <div className="container split">
          <div>
            <div className="eyebrow">How it started</div>
            <h2>Built by Nagalakshmi &amp; Shilpa</h2>
            <p className="lede">
              Urvi Studios began with a simple frustration: it was hard to find clothes that felt both rooted in
              Indian craft and easy to wear in a modern, everyday life. So we started sourcing directly — from
              small manufacturers and craftspeople across India — the pieces we ourselves wanted to wear to work,
              to weddings, and to everything in between.
            </p>
            <p className="lede">
              Every piece on Urvi Studios is chosen by the two of us. We look for fabric that feels good against
              skin, construction that holds up to real life, and a silhouette that makes you stand a little taller.
            </p>
          </div>
          <img src="/logo-ivory.png" alt="Urvi Studios emblem" />
        </div>
      </section>

      <section className="section" style={{ background: "var(--sand)" }}>
        <div className="container" style={{ textAlign: "center" }}>
          <div className="eyebrow">The Her Edit</div>
          <h2>Different versions of HER</h2>
          <p className="lede" style={{ margin: "0 auto" }}>
            The two women in our emblem represent this — feminine connection, individuality, and the many moods a
            single woman moves through in one day.
          </p>
          <div className="her-editions">
            {HER_EDITIONS.map((e) => (
              <div className="her-edition" key={e.title}>
                <h4>{e.title}</h4>
                <p>{e.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container" style={{ textAlign: "center", maxWidth: 800, margin: "0 auto" }}>
          <div className="eyebrow">Our Promise</div>
          <h2>Confidence, worn.</h2>
          <p className="lede devanagari" style={{ margin: "0 auto 20px", fontSize: 19 }}>आत्मविश्वासवस्त्रम्</p>
          <p className="lede" style={{ margin: "0 auto" }}>
            The clothing is not simply something she wears; it is part of the woman she chooses to become. That&apos;s
            the promise behind every piece we source, and every order we personally pack.
          </p>
          <div className="values-grid">
            <div className="value-item"><div className="num">100%</div><p>Sourced across India</p></div>
            <div className="value-item"><div className="num">2</div><p>Founders who personally check every order</p></div>
            <div className="value-item"><div className="num">3</div><p>Collections — Everyday, Office, Occasion</p></div>
          </div>
        </div>
      </section>

      <SiteFooter />
    </>
  );
}
