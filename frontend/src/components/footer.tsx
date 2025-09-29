// frontend/src/components/footer.tsx
export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="container">
        <div style={{ display: "flex", justifyContent: "center", gap: 16, alignItems: "center", marginBottom: 8 }}>
        </div>
        <div>© {new Date().getFullYear()} Positive Theta. Все права защищены.</div>
      </div>
    </footer>
  );
}
