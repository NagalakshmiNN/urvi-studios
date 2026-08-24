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
          <h1>Two women.<br />One shared eye for beautiful clothes.</h1>
        </div>
      </section>

      <section className="section">
        <div className="container split">
          <div>
            <div className="eyebrow">How it started</div>
            <h2>Built by Nagalakshmi &amp; Shilpa</h2>
            <p className="lede">
              URVI STUDIOS was born from a belief that getting dressed should feel effortless, expressive and
              entirely your own.
            </p>
            <p className="lede">
              We wanted to create a destination for women who love the richness of Indian fashion but also want
              pieces that belong naturally in modern life — from a Monday morning at work to a festive evening,
              a quiet dinner to a celebration that calls for something unforgettable.
            </p>
            <p className="lede">
              We travel through the world of Indian fashion looking for pieces that make us pause — beautiful
              fabrics, thoughtful details, flattering silhouettes and craftsmanship that deserves to be noticed.
              Every piece is personally discovered and carefully curated by us, with one question always in mind.
            </p>
          </div>
          <img src="/logo-ivory.png" alt="Urvi Studios emblem" />
        </div>
      </section>

      <section className="section" style={{ background: "var(--sand)" }}>
        <div className="container">
          <p className="pull-quote">&ldquo;Would we want to wear this?&rdquo;</p>
          <p className="lede" style={{ margin: "22px auto 0", textAlign: "center" }}>
            If the answer is yes, it earns a place at URVI.
          </p>
        </div>
      </section>

      <section className="section">
        <div className="container" style={{ textAlign: "center", maxWidth: 800, margin: "0 auto" }}>
          <div className="eyebrow">What we believe</div>
          <h2>This feels like me.</h2>
          <p className="lede" style={{ margin: "0 auto 16px" }}>
            We believe style isn&apos;t about following every trend. It&apos;s about finding that feeling when you
            look in the mirror and think, &ldquo;This feels like me.&rdquo;
          </p>
          <p className="lede" style={{ margin: "0 auto" }}>
            That is what we want every URVI piece to give you — confidence without trying too hard, elegance
            without being expected to dress a certain way, and fashion that moves with the many versions of you.
          </p>
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
        <div className="container" style={{ textAlign: "center", maxWidth: 700, margin: "0 auto" }}>
          <h2>Welcome to URVI STUDIOS.</h2>
          <p className="lede" style={{ margin: "0 auto", fontSize: 19 }}>
            Curated for you. Chosen with intention.
            <br />
            Made to make you feel extraordinary.
          </p>
        </div>
      </section>

      <SiteFooter />
    </>
  );
}
