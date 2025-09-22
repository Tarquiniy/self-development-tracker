// frontend/vercel.routes.js
export default function (req, res, next) {
  if (req.url.startsWith('/api') || 
      req.url.startsWith('/_next') || 
      req.url.startsWith('/static') ||
      req.url.includes('.')) {
    return next();
  }
  
  res.setHeader('Content-Type', 'text/html');
  res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Positive Theta</title>
        <link rel="icon" type="image/svg+xml" href="/vite.svg" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <script type="module" src="/src/main.tsx"></script>
      </head>
      <body>
        <div id="root"></div>
      </body>
    </html>
  `);
}