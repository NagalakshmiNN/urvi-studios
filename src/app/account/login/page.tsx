import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import LoginForm from "./LoginForm";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <>
      <SiteHeader />
      <div className="container">
        <div className="auth-card">
          <div className="eyebrow" style={{ textAlign: "center", display: "block", marginBottom: 8 }}>Welcome back</div>
          <h1>Login</h1>
          <LoginForm next={next} />
          <p className="auth-switch">
            New to Urvi Studios? <a href={`/account/register${next ? `?next=${encodeURIComponent(next)}` : ""}`}>Create an account</a>
          </p>
        </div>
      </div>
      <SiteFooter />
    </>
  );
}
