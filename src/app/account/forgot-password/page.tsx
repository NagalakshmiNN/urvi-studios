import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import ForgotPasswordForm from "./ForgotPasswordForm";

export default function ForgotPasswordPage() {
  return (
    <>
      <SiteHeader />
      <div className="auth-page">
        <div className="container">
          <div className="auth-card">
            <div className="eyebrow" style={{ textAlign: "center", display: "block", marginBottom: 8 }}>Account Recovery</div>
            <h1>Forgot Password</h1>
            <p style={{ textAlign: "center", fontSize: 13.5, color: "var(--earth)", marginBottom: 20 }}>
              Enter your email and we&apos;ll send you a link to reset your password.
            </p>
            <ForgotPasswordForm />
            <p className="auth-switch">
              <a href="/account/login">Back to Login</a>
            </p>
          </div>
        </div>
      </div>
      <SiteFooter />
    </>
  );
}
