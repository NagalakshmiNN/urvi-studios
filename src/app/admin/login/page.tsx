import AdminLoginForm from "./AdminLoginForm";

export default function AdminLoginPage() {
  return (
    <div className="admin-login-shell">
      <div className="auth-card">
        <div className="eyebrow" style={{ textAlign: "center", display: "block", marginBottom: 8 }}>Urvi Studios</div>
        <h1>Admin Login</h1>
        <AdminLoginForm />
      </div>
    </div>
  );
}
