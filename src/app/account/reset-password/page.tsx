import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import ResetPasswordForm from "./ResetPasswordForm";

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;

  return (
    <>
      <SiteHeader />
      <div className="auth-page">
        <div className="container">
          <div className="auth-card">
            <div className="eyebrow" style={{ textAlign: "center", display: "block", marginBottom: 8 }}>Account Recovery</div>
            <h1>Set New Password</h1>
            {token ? (
              <ResetPasswordForm token={token} />
            ) : (
              <div className="notice-box error">
                Invalid reset link. Please <a href="/account/forgot-password">request a new one</a>.
              </div>
            )}
          </div>
        </div>
      </div>
      <SiteFooter />
    </>
  );
}
