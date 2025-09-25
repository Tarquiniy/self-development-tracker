export default function Footer() {
  return (
    <footer className="border-t bg-muted py-6 mt-12">
      <div className="max-w-6xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
        <p>&copy; {new Date().getFullYear()} Positive Theta. Все права защищены.</p>
        <div className="flex gap-4">
          <a href="https://github.com/" target="_blank" rel="noreferrer" className="hover:text-primary">
            GitHub
          </a>
          <a href="https://t.me/" target="_blank" rel="noreferrer" className="hover:text-primary">
            Telegram
          </a>
        </div>
      </div>
    </footer>
  );
}
