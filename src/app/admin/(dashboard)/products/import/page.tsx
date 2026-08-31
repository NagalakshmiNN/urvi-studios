import ImportForm from "./ImportForm";

export default function ImportProductsPage() {
  return (
    <>
      <div className="admin-header">
        <h1>Import Products</h1>
      </div>
      <div className="admin-card admin-form-card">
        <ImportForm />
      </div>
    </>
  );
}
