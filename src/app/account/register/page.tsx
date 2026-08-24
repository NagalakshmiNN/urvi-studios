import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import RegisterForm from "./RegisterForm";

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <>
      <SiteHeader />
      <div className="container">
        <div className="auth-card">
          <div className="eyebrow" style={{ textAlign: "center", display: "block", marginBottom: 8 }}>Join Urvi Studios</div>
          <h1>Create an account</h1>
          <RegisterForm next={next} />
          <p className="auth-switch">
            Already have an account? <a href={`/account/login${next ? `?next=${encodeURIComponent(next)}` : ""}`}>Login</a>
          </p>
        </div>
      </div>
      <SiteFooter />
    </>
  );
}
