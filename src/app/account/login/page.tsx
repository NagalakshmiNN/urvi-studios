import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import LoginForm from "./LoginForm";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; email?: string; registered?: string }> }) {
  const { next, email, registered } = await searchParams;
  return (
    <>
      <SiteHeader />
      <div className="auth-page">
        <div className="container">
          <div className="auth-card">
          <div className="eyebrow" style={{ textAlign: "center", display: "block", marginBottom: 8 }}>Your Account</div>
          <h1>Login</h1>
          {registered === "1" && (
            <div className="notice-box success" style={{ marginBottom: 16 }}>
              Account created successfully! Please login with your credentials.
            </div>
          )}
          <LoginForm next={next} email={email} />
            <p className="auth-switch">
              New to Urvi Studios? <a href={`/account/register${next ? `?next=${encodeURIComponent(next)}` : ""}`}>Create an account</a>
            </p>
          </div>
        </div>
      </div>
      <SiteFooter />
    </>
  );
}
